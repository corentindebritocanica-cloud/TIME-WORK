/**
 * Migration des données héritées (document unique `users/{uid}.kv`, ou cache local
 * du navigateur de l'ancienne version) vers le modèle `users/{uid}` + `months/{AAAA-MM}`.
 *
 * Sécurité des données :
 *  1. l'appelant télécharge une sauvegarde JSON AVANT d'appeler `migrate()` ;
 *  2. écriture par lots (≤ 400 opérations), en attendant l'accusé du serveur ;
 *  3. relecture DEPUIS LE SERVEUR et comparaison des totaux ;
 *  4. seulement si tout concorde : suppression de `kv` + pose de `migratedAt` (une seule écriture).
 *  En cas d'écart ou d'erreur : rien n'est supprimé, une nouvelle tentative réécrit les mêmes documents.
 */
import { db, fsMod } from './firebase.js';
import { canonAffaire, canonEntry, canonDay, monthOf } from './store.js';

const { doc, collection, writeBatch, serverTimestamp, deleteField, updateDoc, getDocFromServer, getDocsFromServer } = fsMod;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMEOUT_MS = 30000;

const withTimeout = (p, what) => Promise.race([p, new Promise((_, rej) =>
    setTimeout(() => rej(new Error(what + ' : pas de réponse du serveur (connexion ?)')), TIMEOUT_MS))]);

/**
 * Lit des données au format de l'ancienne version.
 * @param {Object<string,string>} kv clés `sp_affaires`, `sp_entries`, `h_*`, `m_*`, `r_*` (chaînes)
 * @returns {{affaires: object[], entries: object[], cegid: Object<string,string>}}
 */
export function legacyFromKv(kv) {
    const parse = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
    const cegid = {};
    Object.keys(kv || {}).forEach(k => { if (/^(h_|m_|r_)/.test(k)) cegid[k] = String(kv[k] ?? ''); });
    return { affaires: parse(kv?.sp_affaires), entries: parse(kv?.sp_entries), cegid };
}

/**
 * Convertit des données héritées en maps canoniques du nouveau modèle.
 * @param {{affaires: object[], entries: object[], cegid: Object<string,string>}} src
 * @returns {{affaires: Object<string,object>, entries: Object<string,object>, days: Object<string,object>, dropped: number}}
 */
export function fromLegacy(src) {
    /* global normalizeData — défini dans index.html (validation partagée avec les imports) */
    const norm = normalizeData(src.affaires, src.entries);
    const affaires = {}, entries = {}, days = {};
    norm.affaires.forEach(a => {
        affaires[a.id] = canonAffaire({ ...a, createdAt: Number(a.createdAt) || Number(a.id) || Date.now() });
    });
    norm.entries.forEach(e => {
        entries[e.id] = canonEntry({ ...e, createdAt: Number(e.createdAt) || Number(e.id) || 0 });
    });
    const isos = new Set(Object.keys(src.cegid || {}).map(k => k.slice(2)).filter(iso => DAY_RE.test(iso)));
    isos.forEach(iso => {
        const h = parseInt(src.cegid['h_' + iso], 10) || 0;
        const m = parseInt(src.cegid['m_' + iso], 10) || 0;
        const r = src.cegid['r_' + iso];
        const reason = (r === 'ferie' || r === 'conge') ? r : null;
        if (h || m || reason) days[iso] = canonDay({ h, m, reason });
    });
    return { affaires, entries, days, dropped: norm.dropped };
}

/** Totaux de contrôle d'un jeu de données canonique. */
export function summarize({ affaires, entries, days }) {
    const ents = Object.values(entries), ds = Object.values(days);
    return {
        affaires: Object.keys(affaires).length,
        entries: ents.length,
        minutes: ents.reduce((s, e) => s + e.minutes, 0),
        days: ds.length,
        dayMinutes: ds.reduce((s, d) => s + d.h * 60 + d.m, 0),
        reasons: ds.filter(d => d.reason).length
    };
}

/**
 * Migre des données héritées vers le nouveau modèle.
 * @param {string} uid
 * @param {{affaires: object[], entries: object[], cegid: Object<string,string>}} legacy
 * @returns {Promise<object>} totaux migrés
 * @throws {Error} si l'écriture échoue ou si les totaux relus ne concordent pas (rien n'est alors supprimé)
 */
export async function migrate(uid, legacy) {
    const data = fromLegacy(legacy);
    const expected = summarize(data);
    const userRef = doc(db, 'users', uid);
    const monthsRef = collection(userRef, 'months');

    const byMonth = new Map();
    const bucket = mid => { if (!byMonth.has(mid)) byMonth.set(mid, { entries: {}, days: {} }); return byMonth.get(mid); };
    Object.entries(data.entries).forEach(([id, e]) => { bucket(monthOf(e.date)).entries[id] = e; });
    Object.entries(data.days).forEach(([iso, d]) => { bucket(monthOf(iso)).days[iso] = d; });

    const ops = [b => b.set(userRef, { affaires: data.affaires, settings: {}, updatedAt: serverTimestamp() },
                             { mergeFields: ['affaires', 'settings', 'updatedAt'] })];
    byMonth.forEach((mo, mid) => ops.push(b => b.set(doc(monthsRef, mid), { ...mo, updatedAt: serverTimestamp() })));
    for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(db);
        ops.slice(i, i + 400).forEach(op => op(b));
        await withTimeout(b.commit(), 'Écriture');
    }

    // Relecture depuis le serveur et contrôle
    const uSnap = await withTimeout(getDocFromServer(userRef), 'Relecture');
    const mSnap = await withTimeout(getDocsFromServer(monthsRef), 'Relecture');
    const got = { affaires: {}, entries: {}, days: {} };
    Object.entries(uSnap.data()?.affaires || {}).forEach(([id, a]) => { got.affaires[id] = canonAffaire(a); });
    mSnap.forEach(m => {
        const d = m.data();
        Object.entries(d.entries || {}).forEach(([id, e]) => { got.entries[id] = canonEntry(e); });
        Object.entries(d.days || {}).forEach(([iso, day]) => { got.days[iso] = canonDay(day); });
    });
    const actual = summarize(got);
    const diffs = Object.keys(expected).filter(k => expected[k] !== actual[k]);
    if (diffs.length) {
        throw new Error('Contrôle des totaux en échec (' + diffs.map(k => k + ' : attendu ' + expected[k] + ', relu ' + actual[k]).join(' ; ') + ')');
    }

    await withTimeout(updateDoc(userRef, { kv: deleteField(), migratedAt: serverTimestamp() }), 'Finalisation');
    return { ...expected, dropped: data.dropped };
}
