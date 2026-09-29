/**
 * Amorçage cloud : connexion Google, migration éventuelle, démarrage du store,
 * état de synchronisation (en-tête). Aucune variable globale (hors hooks de test en mode émulateur).
 */
import { auth, authMod, db, fsMod, EMULATOR } from './firebase.js';
import * as store from './store.js';
import { migrate, legacyFromKv, fromLegacy, summarize } from './migrate.js';
import { ask } from './ui/dialog.js';
import { toast } from './ui/toast.js';

const { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
        onAuthStateChanged, signOut, signInWithCredential } = authMod;
const { doc, getDoc, getDocs, collection, query, limit } = fsMod;

const el = id => document.getElementById(id);
let nextLoginMsg = '';
let currentUser = null;
let hooks = {};

/* ───────────────────────── Écran de connexion ───────────────────────── */
function showLogin(msg, err) {
    el('login').hidden = false;
    el('login-msg').textContent = msg || 'Connecte-toi pour accéder à tes heures et tes affaires.';
    el('login-err').textContent = err || '';
    el('login-btn').hidden = false;
    renderStatus();
}
function busy(msg) {
    el('login').hidden = false;
    el('login-msg').textContent = msg;
    el('login-err').textContent = '';
    el('login-btn').hidden = true;
}
const hideLogin = () => { el('login').hidden = true; };

/* ───────────────────────── État de synchronisation ───────────────────────── */
function renderStatus() {
    const box = el('sync');
    if (!box) return;
    box.hidden = !currentUser;
    if (!currentUser) return;
    const s = store.status();
    let state = 'ok', label = 'Synchronisé';
    if (s.error) { state = 'error'; label = 'Erreur de synchro'; }
    else if (!navigator.onLine) { state = 'pending'; label = s.pending ? 'Hors ligne — enregistré sur ce poste' : 'Hors ligne'; }
    else if (s.pending) { state = 'pending'; label = 'Enregistrement…'; }
    box.dataset.s = state;
    el('sync-txt').textContent = label;
    box.title = (currentUser.email || '') + (s.error ? ' — ' + (s.error.message || s.error) : '');
}

/** Télécharge un objet en JSON. */
function download(obj, prefix) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = prefix + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const backupPayload = legacy => ({ exportedAt: new Date().toISOString(), affaires: legacy.affaires, entries: legacy.entries, cegid: legacy.cegid });

/* ───────────────── Données héritées du cache local (ancienne version) ───────────────── */
const LEGACY_KEY_RE = /^(sp_affaires|sp_entries|h_|m_|r_)/;
function legacyLocal() {
    const kv = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && LEGACY_KEY_RE.test(k)) kv[k] = localStorage.getItem(k);
    }
    return legacyFromKv(kv);
}
function clearLegacyLocal() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /^(sp_|h_|m_|r_|__tw_)/.test(k)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
}

/* ───────────────────────── Connexion ───────────────────────── */
/** Connexion Google (popup, repli en redirection). */
export async function login() {
    el('login-err').textContent = '';
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
        await signInWithPopup(auth, provider);
    } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
            return signInWithRedirect(auth, provider);
        }
        if (e.code === 'auth/unauthorized-domain') {
            el('login-err').textContent = 'Domaine non autorisé : ajoute « ' + location.hostname +
                ' » dans Firebase → Authentication → Settings → Authorized domains.';
        } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            el('login-err').textContent = 'Connexion impossible : ' + (e.message || e.code);
        }
    }
}

/** Déconnexion (avertit si des modifications ne sont pas encore confirmées). */
export async function logout() {
    store.flushDays();
    if (store.status().pending) {
        const c = await ask({ title: 'Modifications en cours d\'envoi',
            text: 'Certaines modifications ne sont pas encore confirmées par le serveur. Se déconnecter maintenant peut les perdre.',
            buttons: [{ id: 'stay', label: 'Rester connecté', kind: 'primary' }, { id: 'out', label: 'Se déconnecter quand même' }],
            cancel: 'stay' });
        if (c !== 'out') return;
    }
    await signOut(auth);
    location.reload();
}

/** Force la synchronisation et affiche le résultat. */
export async function syncNow() {
    try { await store.sync(); toast('Tout est synchronisé.'); }
    catch (e) { toast('Synchronisation en attente : ' + (e.message || e), { kind: 'error' }); }
}

async function quitWithoutChange() {
    nextLoginMsg = 'Déconnecté — aucune donnée n\'a été modifiée.';
    await signOut(auth);
}

/* ─────────────────────── Arrivée d'un utilisateur ─────────────────────── */
async function onUser(user) {
    currentUser = user;
    if (!user) { store.stop(); showLogin(nextLoginMsg); nextLoginMsg = ''; hooks.onSignedOut?.(); return; }
    busy('Chargement des données…');
    const userRef = doc(db, 'users', user.uid);

    let snap;
    try {
        snap = await getDoc(userRef);
    } catch (e) {
        if (e.code === 'permission-denied') return deny(user);
        return showLogin('', 'Impossible de joindre Firestore (première connexion sur ce poste ?). Vérifie ta connexion puis recharge la page.');
    }
    const data = snap.exists() ? snap.data() : null;

    // 1. Ancien format dans le cloud → migration (connexion requise)
    if (data?.kv && !data.migratedAt) {
        const legacy = legacyFromKv(data.kv);
        const s = summarize(fromLegacy(legacy));
        const c = await ask({ title: 'Mise à jour du stockage',
            text: 'Tes données (' + s.affaires + ' affaires, ' + s.entries + ' saisies, ' + s.days + ' jours pointés) passent au nouveau format ' +
                '(synchronisation en temps réel entre postes). Une sauvegarde JSON est téléchargée avant toute modification ; ' +
                'l\'ancien format n\'est supprimé qu\'après vérification des totaux.',
            buttons: [{ id: 'go', label: 'Lancer la mise à jour', kind: 'primary' }, { id: 'cancel', label: 'Plus tard (se déconnecter)' }] });
        if (c !== 'go') return quitWithoutChange();
        download(backupPayload(legacy), 'backup_avant_migration_');
        if (!(await runMigration(user, legacy))) return;
    } else if (!data?.migratedAt && !(await hasNewData(userRef, data))) {
        // 2. Cloud vide + données de l'ancienne version dans ce navigateur : choix explicite
        const legacy = legacyLocal();
        const s = summarize(fromLegacy(legacy));
        if (s.affaires || s.entries || s.days) {
            const c = await ask({ title: 'Espace cloud vide',
                text: 'Ce navigateur contient des données de l\'ancienne version (' + s.affaires + ' affaires, ' + s.entries +
                    ' saisies, ' + s.days + ' jours pointés). Que veux-tu en faire ?',
                buttons: [{ id: 'upload', label: 'Envoyer vers le cloud', kind: 'primary' },
                          { id: 'reset', label: 'Télécharger une sauvegarde puis repartir de zéro' },
                          { id: 'cancel', label: 'Annuler (se déconnecter)' }] });
            if (c === 'cancel') return quitWithoutChange();
            download(backupPayload(legacy), c === 'upload' ? 'backup_local_avant_envoi_' : 'backup_local_');
            if (c === 'upload') { if (!(await runMigration(user, legacy))) return; }
            else clearLegacyLocal();
        }
    }

    // 3. Écoute temps réel
    try {
        await store.start(user.uid, err => {
            console.error('[cloud] écoute interrompue', err);
            if (err.code === 'permission-denied') deny(user);
            else toast('Synchronisation interrompue : ' + (err.message || err), { kind: 'error' });
        });
    } catch (e) {
        if (e.code === 'permission-denied') return deny(user);
        return showLogin('', 'Chargement impossible : ' + (e.message || e));
    }
    el('sync-user').textContent = user.email || '';
    hideLogin(); renderStatus();
    hooks.onReady?.(user);
}

async function hasNewData(userRef, data) {
    if (data && Object.keys(data.affaires || {}).length) return true;
    try { return !(await getDocs(query(collection(userRef, 'months'), limit(1)))).empty; }
    catch { return false; }
}

async function runMigration(user, legacy) {
    busy('Conversion des données… ne ferme pas la fenêtre.');
    try {
        const r = await migrate(user.uid, legacy);
        clearLegacyLocal();
        toast('Données converties : ' + r.affaires + ' affaires, ' + r.entries + ' saisies, ' + r.days + ' jours pointés.');
        return true;
    } catch (e) {
        console.error('[migration]', e);
        showLogin('', (e.code === 'permission-denied'
            ? 'Migration refusée par Firestore : publie d\'abord les nouvelles règles Firestore dans la console Firebase (voir README).'
            : 'Migration interrompue : ' + (e.message || e)) +
            '\nTes données d\'origine sont intactes (et sauvegardées). Recharge la page pour réessayer.');
        return false;
    }
}

function deny(user) {
    store.stop();
    showLogin('', 'Accès refusé par Firestore pour « ' + (user.email || '?') + ' ».\n' +
        'Seul le compte de la liste blanche des règles Firestore est autorisé, et les règles doivent être publiées dans la console.');
}

/**
 * Démarre la couche cloud.
 * @param {{onReady?: (user) => void, onData?: () => void, onSignedOut?: () => void}} h
 */
export function startCloud(h) {
    hooks = h;
    store.onStatus(renderStatus);
    store.subscribe(() => hooks.onData?.());
    addEventListener('online', renderStatus);
    addEventListener('offline', renderStatus);
    addEventListener('pagehide', () => store.flushDays());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flushDays(); });
    el('login-btn').addEventListener('click', login);
    if (EMULATOR) {
        // Hooks de test (émulateur uniquement)
        window.__twTestSignIn = email => signInWithCredential(auth, GoogleAuthProvider.credential(
            JSON.stringify({ sub: 'test-' + email, email, email_verified: true })));
        window.__tw = { store };
    }
    getRedirectResult(auth).catch(e => { el('login-err').textContent = e.message || e.code; });
    onAuthStateChanged(auth, u => { onUser(u).catch(e => showLogin('', 'Erreur : ' + (e.message || e))); });
}

export { store };
