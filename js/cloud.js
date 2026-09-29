/**
 * Amorçage cloud : connexion Google, migration éventuelle, démarrage du store,
 * pastille d'état de synchronisation. Expose `window.TWCloud` et `window.TWStore`
 * pour le script principal de index.html.
 */
import { auth, authMod, db, fsMod, EMULATOR } from './firebase.js';
import * as store from './store.js';
import { migrate, legacyFromKv, fromLegacy, summarize } from './migrate.js';

const { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
        onAuthStateChanged, signOut, signInWithCredential } = authMod;
const { doc, getDoc, getDocs, collection, query, limit } = fsMod;

const el = id => document.getElementById(id);
let nextLoginMsg = '';
let currentUser = null;

/* ───────────────────────── Interface ───────────────────────── */
function showLogin(msg, err) {
    el('tw-login').style.display = 'flex';
    el('tw-login-msg').textContent = msg || 'Connecte-toi pour accéder à tes heures et tes affaires.';
    el('tw-login-err').textContent = err || '';
    el('tw-login-btn').style.display = '';
    el('tw-status').style.display = 'none';
}
function busy(msg) {
    el('tw-login').style.display = 'flex';
    el('tw-login-msg').textContent = msg;
    el('tw-login-err').textContent = '';
    el('tw-login-btn').style.display = 'none';
}
function hideLogin() { el('tw-login').style.display = 'none'; }

function renderStatus() {
    const box = el('tw-status');
    if (!currentUser) { box.style.display = 'none'; return; }
    const s = store.status();
    const online = navigator.onLine;
    let state = 'ok', label = 'Synchronisé';
    if (s.error) { state = 'error'; label = 'Erreur de synchronisation'; }
    else if (!online) { state = 'pending'; label = s.pending ? 'Hors ligne — enregistré sur ce poste' : 'Hors ligne'; }
    else if (s.pending) { state = 'pending'; label = 'Enregistrement…'; }
    box.style.display = 'flex'; box.dataset.s = state;
    el('tw-status-txt').textContent = label;
    box.title = s.error ? String(s.error.message || s.error) : '';
}

/**
 * Choix modal (<dialog> natif). Échap = dernier bouton.
 * @param {string} title @param {string} text
 * @param {{id:string,label:string,primary?:boolean}[]} buttons
 * @returns {Promise<string>}
 */
function askChoice(title, text, buttons) {
    const dlg = el('tw-choice');
    el('tw-choice-title').textContent = title;
    el('tw-choice-text').textContent = text;
    const box = el('tw-choice-actions');
    box.replaceChildren(...buttons.map(b => {
        const btn = document.createElement('button');
        btn.type = 'submit'; btn.value = b.id; btn.textContent = b.label;
        if (b.primary) btn.className = 'primary';
        return btn;
    }));
    return new Promise(resolve => {
        dlg.addEventListener('close', () => resolve(dlg.returnValue || buttons[buttons.length - 1].id), { once: true });
        dlg.returnValue = '';
        dlg.showModal();
        box.querySelector('.primary')?.focus();
    });
}

/** Télécharge un objet en JSON. */
function download(obj, prefix) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = prefix + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Sauvegarde au format « Sauvegarder » (compatible avec « Importer »). */
const backupPayload = legacy => ({ exportedAt: new Date().toISOString(), affaires: legacy.affaires, entries: legacy.entries, cegid: legacy.cegid });

/* ───────────────── Données héritées du cache local ───────────────── */
const LEGACY_KEY_RE = /^(sp_affaires|sp_entries|h_|m_|r_)/;
function legacyLocal() {
    const kv = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && LEGACY_KEY_RE.test(k)) kv[k] = localStorage.getItem(k);
    }
    return legacyFromKv(kv);
}
/** Efface l'ancien cache de données (le cache Firestore IndexedDB le remplace). */
function clearLegacyLocal() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /^(sp_|h_|m_|r_|__tw_)/.test(k)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
}

/* ───────────────────────── Connexion ───────────────────────── */
async function login() {
    el('tw-login-err').textContent = '';
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
        await signInWithPopup(auth, provider);
    } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
            return signInWithRedirect(auth, provider);
        }
        if (e.code === 'auth/unauthorized-domain') {
            el('tw-login-err').textContent = 'Domaine non autorisé : ajoute « ' + location.hostname +
                ' » dans Firebase → Authentication → Settings → Authorized domains.';
        } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            el('tw-login-err').textContent = 'Connexion impossible : ' + (e.message || e.code);
        }
    }
}

async function logout() {
    store.flushDays();
    if (store.status().pending) {
        const c = await askChoice('Modifications en cours d\'envoi',
            'Certaines modifications ne sont pas encore confirmées par le serveur. Se déconnecter maintenant peut les perdre.',
            [{ id: 'stay', label: 'Rester connecté', primary: true }, { id: 'out', label: 'Se déconnecter quand même' }]);
        if (c !== 'out') return;
    }
    await signOut(auth);
    location.reload();
}

async function quitWithoutChange() {
    nextLoginMsg = 'Déconnecté — aucune donnée n\'a été modifiée.';
    await signOut(auth);
}

/* ─────────────────────── Arrivée d'un utilisateur ─────────────────────── */
async function onUser(user) {
    currentUser = user;
    if (!user) { store.stop(); showLogin(nextLoginMsg); nextLoginMsg = ''; renderStatus(); return; }
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
        const c = await askChoice('Mise à jour du stockage',
            'Tes données (' + s.affaires + ' affaires, ' + s.entries + ' saisies, ' + s.days + ' jours pointés) passent au nouveau format ' +
            '(synchronisation en temps réel entre postes). Une sauvegarde JSON est téléchargée avant toute modification ; ' +
            'l\'ancien format n\'est supprimé qu\'après vérification des totaux.',
            [{ id: 'go', label: 'Lancer la mise à jour', primary: true }, { id: 'cancel', label: 'Plus tard (se déconnecter)' }]);
        if (c !== 'go') return quitWithoutChange();
        download(backupPayload(legacy), 'backup_avant_migration_');
        if (!(await runMigration(user, legacy))) return;
    } else if (!data?.migratedAt && !(await hasNewData(userRef, data))) {
        // 2. Cloud vide + données de l'ancienne version dans ce navigateur (A1 : choix explicite)
        const legacy = legacyLocal();
        const s = summarize(fromLegacy(legacy));
        if (s.affaires || s.entries || s.days) {
            const c = await askChoice('Espace cloud vide',
                'Ce navigateur contient des données de l\'ancienne version (' + s.affaires + ' affaires, ' + s.entries +
                ' saisies, ' + s.days + ' jours pointés). Que veux-tu en faire ?',
                [{ id: 'upload', label: 'Envoyer vers le cloud', primary: true },
                 { id: 'reset', label: 'Télécharger une sauvegarde puis repartir de zéro' },
                 { id: 'cancel', label: 'Annuler (se déconnecter)' }]);
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
        });
    } catch (e) {
        if (e.code === 'permission-denied') return deny(user);
        return showLogin('', 'Chargement impossible : ' + (e.message || e));
    }
    el('tw-status-user').textContent = user.email || '';
    hideLogin(); renderStatus();
    window.dispatchEvent(new CustomEvent('tw:ready'));
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
        window.showToast?.('Données converties : ' + r.affaires + ' affaires, ' + r.entries + ' saisies, ' + r.days + ' jours pointés.', 'ok');
        return true;
    } catch (e) {
        console.error('[migration]', e);
        showLogin('', (e.code === 'permission-denied'
            ? 'Migration refusée par Firestore : publie d\'abord la nouvelle version de firestore.rules dans la console Firebase.'
            : 'Migration interrompue : ' + (e.message || e)) +
            '\nTes données d\'origine sont intactes (et sauvegardées). Recharge la page pour réessayer.');
        return false;
    }
}

function deny(user) {
    store.stop();
    showLogin('', 'Accès refusé par Firestore pour « ' + (user.email || '?') + ' ».\n' +
        'Seul le compte de la liste blanche (firestore.rules) est autorisé, et les règles doivent être publiées dans la console.');
}

/* ───────────────────────── Démarrage ───────────────────────── */
store.onStatus(renderStatus);
store.subscribe(() => window.onDataChanged?.());      // changements venus d'un autre poste / onglet
addEventListener('online', renderStatus);
addEventListener('offline', renderStatus);
addEventListener('pagehide', () => store.flushDays());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flushDays(); });

window.TWStore = store;
window.TWLegacy = { fromLegacy, summarize };
window.TWCloud = { login, logout, isReady: () => !!currentUser };
if (EMULATOR) {
    // Connexion de test (émulateur Auth uniquement)
    window.__twTestSignIn = email => signInWithCredential(auth, GoogleAuthProvider.credential(
        JSON.stringify({ sub: 'test-' + email, email, email_verified: true })));
}

getRedirectResult(auth).catch(e => { el('tw-login-err').textContent = e.message || e.code; });
onAuthStateChanged(auth, u => { onUser(u).catch(e => showLogin('', 'Erreur : ' + (e.message || e))); });
