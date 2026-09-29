/**
 * Point d'entrée de l'application.
 *  - routage par l'URL : #/suivi/<dashboard|affaires|chrono|imputees|pointage>
 *    (toute autre adresse, dont les anciennes #/ et #/pointage, est redirigée)
 *  - sections chargées à la demande (import() dynamique), montées/démontées proprement
 *  - rafraîchissement quand un autre poste/onglet modifie les données (sans casser une saisie)
 *  - saisie rapide (Ctrl+K), menu « Données » (sauvegarde, restauration, import CSV)
 */
import { startCloud, logout, store } from './cloud.js';
import { EMULATOR } from './firebase.js';
import { ask, confirmAction, inform } from './ui/dialog.js';
import { toast } from './ui/toast.js';
import { isEditing, on } from './ui/dom.js';

const loadSuivi = () => import('./views/suivi.js');
const TABS = ['dashboard', 'affaires', 'chrono', 'imputees', 'pointage'];
const DEFAULT_TAB = 'dashboard';
const TITLES = {
    dashboard: 'Tableau de bord', affaires: 'Par affaire', chrono: 'Chronologie',
    imputees: 'Heures imputées', pointage: 'Pointage CEGID'
};

let ready = false;
let current = null;            // { name, api }
let pendingRefresh = false;

/** Contexte partagé avec les vues. */
const ctx = {
    store, toast, ask, confirmAction, inform,
    nav: path => { location.hash = path; },
    refresh: () => refreshCurrent()
};

/** Analyse l'URL → onglet ; corrige l'adresse si elle n'est pas canonique. */
function parseRoute() {
    const [, view = '', tab = ''] = location.hash.replace(/^#/, '').split('/');
    const t = view === 'pointage' ? 'pointage' : (view === 'suivi' && TABS.includes(tab) ? tab : DEFAULT_TAB);
    const canonical = '#/suivi/' + t;
    if (location.hash !== canonical) history.replaceState(null, '', canonical);
    return { view: 'suivi', tab: t };
}

async function route() {
    if (!ready) return;
    const r = parseRoute();
    document.title = TITLES[r.tab] + ' — TIME-WORK';
    if (current) { current.api.update?.(r); return; }
    let mod;
    try { mod = await loadSuivi(); }
    catch (e) { console.error(e); toast('Chargement de l\'application impossible (connexion ?).', { kind: 'error' }); return; }
    const root = document.getElementById('view-suivi');
    root.hidden = false;
    current = { name: 'suivi', api: mod.mount(root, ctx, r) };
    document.getElementById('main').focus({ preventScroll: true });
}

/** Réaffiche la vue courante ; si l'utilisateur est en train de saisir, attend la fin de la saisie. */
function refreshCurrent() {
    if (!current) return;
    const main = document.getElementById('main');
    if (isEditing(main)) {
        if (!pendingRefresh) {
            pendingRefresh = true;
            main.addEventListener('focusout', () => {
                pendingRefresh = false;
                setTimeout(refreshCurrent, 0);
            }, { once: true });
        }
        return;
    }
    current.api.refresh?.();
}

/* ───────────────────────── Raccourcis ───────────────────────── */
async function openQuickEntry() {
    if (!ready || document.getElementById('dlg').open) return;
    const { quickEntry } = await import('./ui/quick.js');
    if (await quickEntry(ctx)) refreshCurrent();
}

function onKey(e) {
    if (!ready || document.getElementById('dlg').open) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openQuickEntry(); }
}

/* ───────────────────────── Menu « Données » ───────────────────────── */
function bindDataMenu() {
    const menu = document.getElementById('data-menu');
    const data = () => import('./ui/data.js');
    const pick = sel => { menu.hidePopover(); menu.querySelector(sel).click(); };
    const guard = fn => async (...a) => {
        if (!ready) return;
        try { await fn(...a); } catch (e) { console.error(e); toast('Action impossible : ' + (e.message || e), { kind: 'error' }); }
    };
    on(menu, 'click', {
        'export': guard(async () => { menu.hidePopover(); (await data()).exportBackup(ctx); }),
        'pick-json': () => pick('[data-action="import-json"]'),
        'pick-csv': () => pick('[data-action="import-csv"]')
    });
    const onFile = kind => guard(async input => {
        const f = input.files[0]; input.value = '';
        if (!f) return;
        const text = await f.text(), mod = await data();
        await (kind === 'json' ? mod.importJSON(text, ctx) : mod.importCSV(text, ctx));
        refreshCurrent();
    });
    on(menu, 'change', { 'import-json': onFile('json'), 'import-csv': onFile('csv') });
}

/** Précharge les modules des sections en tâche de fond (navigation possible même si la connexion tombe). */
function preload() {
    requestIdleCallback(() => {
        [loadSuivi, () => import('./views/dashboard.js'), () => import('./views/affaires.js'),
         () => import('./views/chrono.js'), () => import('./views/imputees.js'), () => import('./views/pointage.js'),
         () => import('./ui/quick.js'), () => import('./ui/data.js')]
            .forEach(load => load().catch(() => {}));
    }, { timeout: 3000 });
}

/* ───────────────────────── Démarrage ───────────────────────── */
function init() {
    document.getElementById('quick-btn').addEventListener('click', openQuickEntry);
    document.getElementById('logout-btn').addEventListener('click', logout);
    bindDataMenu();
    addEventListener('hashchange', route);
    addEventListener('keydown', onKey);

    startCloud({
        onReady: () => { ready = true; current = null; route(); preload(); },
        onData: () => refreshCurrent(),
        onSignedOut: () => { ready = false; current?.api.destroy?.(); current = null; }
    });

    // PWA : cache de l'application pour un démarrage hors ligne (pas en mode test)
    if ('serviceWorker' in navigator && !EMULATOR && location.protocol === 'https:') {
        navigator.serviceWorker.register('./sw.js').catch(err => console.warn('[sw]', err));
    }
}

init();
