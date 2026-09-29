/**
 * Store TIME-WORK — source unique des données de l'app.
 *
 * Modèle Firestore (orienté requêtes) :
 *   users/{uid}                 { settings, affaires: { [id]: affaire }, updatedAt }
 *   users/{uid}/months/{AAAA-MM} { entries: { [id]: saisie }, days: { [AAAA-MM-JJ]: { h, m, reason } }, updatedAt }
 *
 * Règles :
 *  - écritures ciblées par champ (jamais de réécriture d'un bloc entier) → pas d'écrasement entre postes ;
 *  - toute mutation met d'abord à jour la mémoire (affichage immédiat), puis part vers Firestore
 *    (file persistante du SDK : fonctionne hors ligne) ;
 *  - les instantanés Firestore sont comparés à la mémoire : seuls les vrais changements venus
 *    d'ailleurs (autre poste, autre onglet) déclenchent une notification `subscribe()`.
 */
import { db, fsMod } from './firebase.js';

const {
    doc, collection, onSnapshot, setDoc, writeBatch, deleteField, serverTimestamp, FieldPath
} = fsMod;

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_MAX = 400;

/** Nouvel identifiant (affaire ou saisie). */
export const newId = () => crypto.randomUUID();

/** « AAAA-MM-JJ » → identifiant de document mensuel « AAAA-MM ». */
export const monthOf = iso => String(iso).slice(0, 7);

const str = v => (v === null || v === undefined) ? '' : String(v);
const sortObj = o => Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => a.localeCompare(b)));
/** Sérialisation stable (clés triées récursivement) pour comparer deux valeurs. */
const sig = v => JSON.stringify(v, (k, val) =>
    (val && typeof val === 'object' && !Array.isArray(val)) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val);

/** Forme canonique d'une affaire (celle écrite dans Firestore et gardée en mémoire). */
export function canonAffaire(a) {
    const budgets = {};
    Object.entries(a.budgets || {}).forEach(([k, v]) => { const n = Number(v); if (n > 0) budgets[k] = n; });
    return {
        client: str(a.client), num: str(a.num), machine: str(a.machine),
        loads: Array.isArray(a.loads) ? a.loads.map(String) : [],
        budgets: sortObj(budgets),
        productive: !!a.productive, unbilled: !!a.unbilled,
        createdAt: Number(a.createdAt) || 0
    };
}

/** Forme canonique d'une saisie. */
export function canonEntry(e) {
    return {
        affaireId: str(e.affaireId), date: str(e.date), type: str(e.type),
        minutes: Math.round(Number(e.minutes)) || 0, createdAt: Number(e.createdAt) || 0
    };
}

/** Forme canonique d'une journée de pointage CEGID. */
export function canonDay(d) {
    return { h: Number(d.h) || 0, m: Number(d.m) || 0, reason: d.reason || null };
}

/* ─────────────────────────── État ─────────────────────────── */
let userRef = null, monthsRef = null;
let unsubs = [];
const affaires = new Map();          // id → affaire canonique
const months = new Map();            // AAAA-MM → { entries: Map(id → saisie), days: Map(iso → jour) }
let settings = {};
let cacheAff = null, cacheEnt = null;
const listeners = new Set();
const statusListeners = new Set();
let pending = 0;
let lastError = null;
const dayTimers = new Map();         // écritures de jours différées (saisie au clavier)

function invalidate() { cacheAff = null; cacheEnt = null; }
function month(id) {
    if (!months.has(id)) months.set(id, { entries: new Map(), days: new Map() });
    return months.get(id);
}
function monthRef(id) { return doc(monthsRef, id); }
function findEntry(id) {
    for (const [mid, mo] of months) if (mo.entries.has(id)) return { mid, entry: mo.entries.get(id) };
    return null;
}
function emit(info) { listeners.forEach(fn => { try { fn(info); } catch (e) { console.error(e); } }); }
function emitStatus() { const s = status(); statusListeners.forEach(fn => { try { fn(s); } catch (e) { console.error(e); } }); }

/** Suit une écriture Firestore (compteur « en attente » + erreurs). */
function track(promise, rethrow = false) {
    pending++; emitStatus();
    return promise
        .then(() => { lastError = null; })
        .catch(err => { lastError = err; console.error('[store] écriture refusée', err); if (rethrow) throw err; })
        .finally(() => { pending--; emitStatus(); });
}

/** Exécute des opérations par lots de ≤ 400 (limite Firestore : 500). */
function commitOps(ops, rethrow = false) {
    const chunks = [];
    for (let i = 0; i < ops.length; i += BATCH_MAX) chunks.push(ops.slice(i, i + BATCH_MAX));
    return Promise.all(chunks.map(chunk => {
        const b = writeBatch(db);
        chunk.forEach(op => op(b));
        return track(b.commit(), rethrow);
    }));
}
const touchUser = b => b.set(userRef, { updatedAt: serverTimestamp() }, { merge: true });
const setAffaireOp = (id, value) => b => b.update(userRef, new FieldPath('affaires', id), value, 'updatedAt', serverTimestamp());
const monthMergeOp = (mid, data) => b => b.set(monthRef(mid), { ...data, updatedAt: serverTimestamp() }, { merge: true });

/* ─────────────────────── Instantanés Firestore ─────────────────────── */
function applyUserSnap(snap) {
    const data = snap.exists() ? snap.data() : {};
    let changed = false;
    const incoming = new Map(Object.entries(data.affaires || {}).filter(([id]) => ID_RE.test(id)).map(([id, a]) => [id, canonAffaire(a)]));
    const same = incoming.size === affaires.size && [...incoming].every(([id, a]) => affaires.has(id) && sig(affaires.get(id)) === sig(a));
    if (!same) { affaires.clear(); incoming.forEach((a, id) => affaires.set(id, a)); invalidate(); changed = true; }
    const s = data.settings || {};
    if (sig(s) !== sig(settings)) { settings = s; changed = true; }
    return changed;
}

function applyMonthDoc(mid, data) {
    // Clés invalides ignorées : elles finissent dans des attributs HTML (id=…)
    const entries = new Map(Object.entries((data && data.entries) || {}).filter(([id, e]) => ID_RE.test(id) && DAY_RE.test(e?.date)).map(([id, e]) => [id, canonEntry(e)]));
    const days = new Map(Object.entries((data && data.days) || {}).filter(([iso]) => DAY_RE.test(iso)).map(([iso, d]) => [iso, canonDay(d)]));
    const cur = months.get(mid);
    // Pointages tapés localement mais pas encore envoyés (écriture différée) : la mémoire prime.
    dayTimers.forEach((_, iso) => {
        if (monthOf(iso) !== mid) return;
        const local = cur?.days.get(iso);
        if (local) days.set(iso, local); else days.delete(iso);
    });
    const newSig = sig([[...entries].sort(), [...days].sort()]);
    const oldSig = cur ? sig([[...cur.entries].sort(), [...cur.days].sort()]) : sig([[], []]);
    if (newSig === oldSig) return false;
    if (!entries.size && !days.size) months.delete(mid);
    else months.set(mid, { entries, days });
    invalidate();
    return true;
}

/**
 * Démarre l'écoute temps réel pour un utilisateur.
 * @param {string} uid
 * @param {(err: Error) => void} onError erreur d'écoute (ex. permission refusée)
 * @returns {Promise<void>} résolue après le premier chargement complet
 */
export function start(uid, onError) {
    stop();
    userRef = doc(db, 'users', uid);
    monthsRef = collection(userRef, 'months');
    let gotUser = false, gotMonths = false, ready = false;
    return new Promise((resolve, reject) => {
        const done = () => { if (gotUser && gotMonths && !ready) { ready = true; resolve(); } };
        const fail = err => { if (!ready) reject(err); else onError?.(err); };
        unsubs.push(onSnapshot(userRef, snap => {
            const changed = applyUserSnap(snap);
            gotUser = true;
            if (ready && changed) emit({ remote: true });
            done();
        }, fail));
        unsubs.push(onSnapshot(monthsRef, qs => {
            let changed = false;
            qs.docChanges().forEach(ch => {
                if (ch.type === 'removed') { if (months.delete(ch.doc.id)) { invalidate(); changed = true; } }
                else if (applyMonthDoc(ch.doc.id, ch.doc.data())) changed = true;
            });
            gotMonths = true;
            if (ready && changed) emit({ remote: true });
            done();
        }, fail));
    });
}

/** Arrête l'écoute et vide la mémoire. */
export function stop() {
    flushDays();
    unsubs.forEach(u => u()); unsubs = [];
    affaires.clear(); months.clear(); settings = {}; invalidate();
}

/* ─────────────────────────── Lecture ─────────────────────────── */
/** @returns {object[]} affaires triées par date de création (copies). */
export function getAffaires() {
    if (!cacheAff) cacheAff = [...affaires].map(([id, a]) => ({ id, ...a, loads: [...a.loads], budgets: { ...a.budgets } }))
        .sort((x, y) => (x.createdAt - y.createdAt) || x.id.localeCompare(y.id));
    return cacheAff.map(a => ({ ...a, loads: [...a.loads], budgets: { ...a.budgets } }));
}
/** @returns {object[]} toutes les saisies (copies). */
export function getEntries() {
    if (!cacheEnt) {
        cacheEnt = [];
        months.forEach(mo => mo.entries.forEach((e, id) => cacheEnt.push({ id, ...e })));
        cacheEnt.sort((x, y) => (x.createdAt - y.createdAt) || x.id.localeCompare(y.id));
    }
    return cacheEnt.map(e => ({ ...e }));
}
/** Pointage d'une journée ou null. @param {string} iso */
export function getDay(iso) {
    const d = months.get(monthOf(iso))?.days.get(iso);
    return d ? { ...d } : null;
}
/** Tous les jours pointés : { iso: {h, m, reason} }. */
export function getDays() {
    const out = {};
    months.forEach(mo => mo.days.forEach((d, iso) => { out[iso] = { ...d }; }));
    return out;
}
export function getSettings() { return JSON.parse(JSON.stringify(settings)); }

/* ─────────────────────────── Écriture ─────────────────────────── */
/** Crée une affaire. @returns {object} l'affaire créée (avec id) */
export function createAffaire(data) {
    const id = newId();
    const a = canonAffaire({ ...data, createdAt: Date.now() });
    affaires.set(id, a); invalidate();
    commitOps([touchUser, setAffaireOp(id, a)]);
    return { id, ...a };
}

/** Met à jour une affaire (champs fournis uniquement). */
export function updateAffaire(id, patch) {
    const cur = affaires.get(id); if (!cur) return;
    const a = canonAffaire({ ...cur, ...patch, createdAt: cur.createdAt });
    if (sig(a) === sig(cur)) return;
    affaires.set(id, a); invalidate();
    commitOps([touchUser, setAffaireOp(id, a)]);
}

/** Supprime une affaire et toutes ses saisies. */
export function deleteAffaire(id) {
    if (!affaires.has(id)) return;
    affaires.delete(id);
    const byMonth = {};
    months.forEach((mo, mid) => mo.entries.forEach((e, eid) => {
        if (e.affaireId === id) { mo.entries.delete(eid); (byMonth[mid] ||= {})[eid] = deleteField(); }
    }));
    invalidate();
    commitOps([touchUser, setAffaireOp(id, deleteField()),
        ...Object.entries(byMonth).map(([mid, del]) => monthMergeOp(mid, { entries: del }))]);
}

/** Ajoute une saisie. @returns {object} la saisie créée (avec id) */
export function addEntry(data) {
    const id = newId();
    const e = canonEntry({ ...data, createdAt: Date.now() });
    const mid = monthOf(e.date);
    month(mid).entries.set(id, e); invalidate();
    commitOps([monthMergeOp(mid, { entries: { [id]: e } })]);
    return { id, ...e };
}

/** Modifie une saisie (type, durée, date…). */
export function updateEntry(id, patch) {
    const found = findEntry(id); if (!found) return;
    const e = canonEntry({ ...found.entry, ...patch, createdAt: found.entry.createdAt });
    if (sig(e) === sig(found.entry)) return;
    const mid = monthOf(e.date);
    const ops = [];
    if (mid !== found.mid) {
        months.get(found.mid).entries.delete(id);
        ops.push(monthMergeOp(found.mid, { entries: { [id]: deleteField() } }));
    }
    month(mid).entries.set(id, e); invalidate();
    ops.push(monthMergeOp(mid, { entries: { [id]: e } }));
    commitOps(ops);
}

/** Supprime une saisie. */
export function deleteEntry(id) {
    const found = findEntry(id); if (!found) return;
    months.get(found.mid).entries.delete(id); invalidate();
    commitOps([monthMergeOp(found.mid, { entries: { [id]: deleteField() } })]);
}

/** Retire un Load d'une affaire : budget supprimé, saisies du Load reclassées en CD (un seul lot). */
export function removeLoad(affId, load) {
    const cur = affaires.get(affId); if (!cur) return;
    const key = 'CD_LOAD_' + load;
    const budgets = { ...cur.budgets }; delete budgets[key];
    const a = canonAffaire({ ...cur, loads: cur.loads.filter(l => l !== load), budgets });
    affaires.set(affId, a);
    const byMonth = {};
    months.forEach((mo, mid) => mo.entries.forEach((e, eid) => {
        if (e.affaireId === affId && e.type === key) {
            const ne = { ...e, type: 'CD' }; mo.entries.set(eid, ne); (byMonth[mid] ||= {})[eid] = ne;
        }
    }));
    invalidate();
    commitOps([touchUser, setAffaireOp(affId, a),
        ...Object.entries(byMonth).map(([mid, ents]) => monthMergeOp(mid, { entries: ents }))]);
}

/**
 * Pointage d'une journée. Écriture différée de 500 ms (frappe au clavier).
 * @param {string} iso
 * @param {{h:number,m:number,reason?:string|null}|null} day null = effacer
 */
export function setDay(iso, day) {
    const mid = monthOf(iso);
    const d = day ? canonDay(day) : null;
    const empty = !d || (!d.h && !d.m && !d.reason);
    if (empty) { months.get(mid)?.days.delete(iso); } else { month(mid).days.set(iso, d); }
    clearTimeout(dayTimers.get(iso));
    dayTimers.set(iso, setTimeout(() => writeDay(iso), 500));
    emitStatus();
}
function writeDay(iso) {
    dayTimers.delete(iso);
    const d = getDay(iso);
    commitOps([monthMergeOp(monthOf(iso), { days: { [iso]: d ? canonDay(d) : deleteField() } })]);
}
/** Envoie immédiatement les pointages en attente (fermeture de fenêtre, déconnexion). */
export function flushDays() { [...dayTimers.keys()].forEach(iso => { clearTimeout(dayTimers.get(iso)); writeDay(iso); }); }

/** Réglages synchronisés (ex. filtre du Dashboard). */
export function setSettings(patch) {
    settings = { ...settings, ...patch };
    commitOps([b => b.set(userRef, { settings: patch, updatedAt: serverTimestamp() }, { merge: true })]);
}

/**
 * Ajout en masse (import CSV) : nouvelles affaires + saisies, regroupées par mois.
 * @param {object[]} newAffaires [{ tempId, client, num, … }] → ids générés
 * @param {object[]} newEntries  [{ affaireId | tempAffId, date, type, minutes }]
 * @returns {{affaires: number, entries: number}}
 */
export function bulkAdd(newAffaires, newEntries) {
    const tempToId = new Map();
    const ops = [];
    if (newAffaires.length) ops.push(touchUser);
    const now = Date.now();
    newAffaires.forEach((na, i) => {
        const id = newId(); tempToId.set(na.tempId, id);
        const a = canonAffaire({ ...na, createdAt: now + i });
        affaires.set(id, a); ops.push(setAffaireOp(id, a));
    });
    const byMonth = {};
    newEntries.forEach((ne, i) => {
        const id = newId();
        const e = canonEntry({ ...ne, affaireId: ne.affaireId || tempToId.get(ne.tempAffId), createdAt: now + i });
        const mid = monthOf(e.date);
        month(mid).entries.set(id, e); (byMonth[mid] ||= {})[id] = e;
    });
    Object.entries(byMonth).forEach(([mid, ents]) => ops.push(monthMergeOp(mid, { entries: ents })));
    invalidate();
    commitOps(ops);
    return { affaires: newAffaires.length, entries: newEntries.length };
}

/**
 * Remplace toutes les données (restauration d'une sauvegarde).
 * @param {{affaires: Object<string,object>, entries: Object<string,object>, days: Object<string,object>}} data
 *        maps canoniques indexées par id / date ISO
 * @returns {Promise<void>} résolue quand le serveur a tout confirmé
 */
export function replaceAll(data) {
    const newMonths = new Map();
    Object.entries(data.entries).forEach(([id, e]) => {
        const mid = monthOf(e.date);
        if (!newMonths.has(mid)) newMonths.set(mid, { entries: {}, days: {} });
        newMonths.get(mid).entries[id] = canonEntry(e);
    });
    Object.entries(data.days).forEach(([iso, d]) => {
        const mid = monthOf(iso);
        if (!newMonths.has(mid)) newMonths.set(mid, { entries: {}, days: {} });
        newMonths.get(mid).days[iso] = canonDay(d);
    });
    const affMap = Object.fromEntries(Object.entries(data.affaires).map(([id, a]) => [id, canonAffaire(a)]));
    const ops = [b => b.set(userRef, { affaires: affMap, updatedAt: serverTimestamp() }, { mergeFields: ['affaires', 'updatedAt'] })];
    months.forEach((_, mid) => { if (!newMonths.has(mid)) ops.push(b => b.delete(monthRef(mid))); });
    newMonths.forEach((mo, mid) => ops.push(b => b.set(monthRef(mid), { ...mo, updatedAt: serverTimestamp() })));
    // mémoire
    affaires.clear(); Object.entries(affMap).forEach(([id, a]) => affaires.set(id, a));
    months.clear();
    newMonths.forEach((mo, mid) => months.set(mid, {
        entries: new Map(Object.entries(mo.entries)), days: new Map(Object.entries(mo.days))
    }));
    invalidate();
    return commitOps(ops, true).then(() => {});
}

/* ─────────────────────────── Abonnements ─────────────────────────── */
/** Notifié à chaque changement venu d'un autre poste/onglet. @returns {() => void} désabonnement */
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** État de synchronisation. */
export function status() { return { pending: pending + dayTimers.size, error: lastError }; }
export function onStatus(fn) { statusListeners.add(fn); fn(status()); return () => statusListeners.delete(fn); }
