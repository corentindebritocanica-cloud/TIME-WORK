/**
 * Point d'entrée de l'application.
 *  - routage par l'URL : #/  ·  #/pointage  ·  #/suivi/<dashboard|affaires|chrono|imputees>
 *  - vues chargées à la demande (import() dynamique), montées/démontées proprement
 *  - rafraîchissement quand un autre poste/onglet modifie les données (sans casser une saisie)
 *  - raccourcis clavier globaux, saisie rapide, aide
 */
import { startCloud, logout, syncNow, store } from './cloud.js';
import { EMULATOR } from './firebase.js';
import { ask, confirmAction, inform } from './ui/dialog.js';
import { toast } from './ui/toast.js';
import { isEditing } from './ui/dom.js';

const VIEWS = {
    home:     () => import('./views/home.js'),
    pointage: () => import('./views/pointage.js'),
    suivi:    () => import('./views/suivi.js')
};
const SUIVI_TABS = ['dashboard', 'affaires', 'chrono', 'imputees'];
const TITLES = { home: 'TIME-WORK', pointage: 'Pointage CEGID — TIME-WORK', suivi: 'Suivi projet — TIME-WORK' };

let ready = false;
let current = null;            // { name, api }
let pendingRefresh = false;

/** Contexte partagé avec les vues. */
const ctx = {
    store, toast, ask, confirmAction, inform,
    nav: path => { location.hash = path; },
    refresh: () => refreshCurrent()
};

/** Analyse l'URL → { view, tab }. */
function parseRoute() {
    const [, view = '', tab = ''] = location.hash.replace(/^#/, '').split('/');
    if (view === 'pointage') return { view: 'pointage' };
    if (view === 'suivi') return { view: 'suivi', tab: SUIVI_TABS.includes(tab) ? tab : 'dashboard' };
    return { view: 'home' };
}

async function route() {
    if (!ready) return;
    const r = parseRoute();
    document.querySelectorAll('.nav-link').forEach(a => {
        if (a.dataset.view === r.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = TITLES[r.view];
    if (current?.name === r.view) { current.api.update?.(r); return; }
    let mod;
    try { mod = await VIEWS[r.view](); }
    catch (e) { console.error(e); toast('Chargement de la vue impossible (connexion ?).', { kind: 'error' }); return; }
    const swap = () => {
        current?.api.destroy?.();
        document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
        const root = document.getElementById('view-' + r.view);
        root.hidden = false;
        current = { name: r.view, api: mod.mount(root, ctx, r) };
    };
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await document.startViewTransition(swap).updateCallbackDone;
    } else swap();
    document.getElementById('main').focus({ preventScroll: true });
    scrollTo({ top: 0 });
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
const typing = el => el && (el.isContentEditable || el.matches?.('input, select, textarea'));

async function openQuickEntry() {
    if (!ready || document.getElementById('dlg').open) return;
    const { quickEntry } = await import('./ui/quick.js');
    if (await quickEntry(ctx)) refreshCurrent();
}

function openHelp() {
    const k = (keys, what) => ({ keys, what });
    const rows = [
        k(['Ctrl', 'K'], 'Saisie rapide (affaire, type, durée)'),
        k(['Alt', 'H'], 'Accueil'), k(['Alt', 'P'], 'Pointage CEGID'), k(['Alt', 'S'], 'Suivi projet'),
        k(['1'], 'Suivi : tableau de bord'), k(['2'], 'Suivi : par affaire'), k(['3'], 'Suivi : chronologie'), k(['4'], 'Suivi : heures imputées'),
        k(['←'], 'Semaine précédente'), k(['→'], 'Semaine suivante'), k(['T'], 'Revenir à aujourd\'hui'),
        k(['Ctrl', 'F'], 'Suivi par affaire : rechercher'),
        k(['Ctrl', 'S'], 'Forcer la synchronisation'), k(['?'], 'Cette aide')
    ];
    import('./ui/dom.js').then(({ html }) => ask({
        title: 'Raccourcis clavier', size: 'm',
        body: html`<table class="table"><tbody>${rows.map(r => html`<tr><td class="nowrap">${r.keys.map((x, i) => html`${i ? ' + ' : ''}<span class="kbd">${x}</span>`)}</td><td>${r.what}</td></tr>`)}</tbody></table>`,
        buttons: [{ id: 'ok', label: 'Fermer', kind: 'primary' }]
    }));
}

function onKey(e) {
    if (!ready || document.getElementById('dlg').open) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') { e.preventDefault(); openQuickEntry(); return; }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 's') { e.preventDefault(); syncNow(); return; }
    if (e.altKey && !e.ctrlKey) {
        const to = { h: '#/', p: '#/pointage', s: '#/suivi/dashboard' }[k.toLowerCase()];
        if (to) { e.preventDefault(); location.hash = to; return; }
    }
    if (current?.api.onKey?.(e)) { e.preventDefault(); return; }
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === '?') { e.preventDefault(); openHelp(); return; }
    if (current?.name === 'suivi' && /^[1-4]$/.test(k)) { e.preventDefault(); location.hash = '#/suivi/' + SUIVI_TABS[+k - 1]; }
}

/** Précharge les modules des vues en tâche de fond (navigation possible même si la connexion tombe). */
function preload() {
    requestIdleCallback(() => {
        [...Object.values(VIEWS), () => import('./views/dashboard.js'), () => import('./views/affaires.js'),
         () => import('./views/chrono.js'), () => import('./views/imputees.js'), () => import('./ui/quick.js')]
            .forEach(load => load().catch(() => {}));
    }, { timeout: 3000 });
}

/* ───────────────────────── Démarrage ───────────────────────── */
function init() {
    document.getElementById('quick-btn').addEventListener('click', openQuickEntry);
    document.getElementById('help-btn').addEventListener('click', openHelp);
    document.getElementById('logout-btn').addEventListener('click', logout);
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
