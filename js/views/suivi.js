/**
 * Vue principale : hôte des 6 sections (tableau de bord, par affaire, chronologie, heures imputées,
 * pointage CEGID, paramètres).
 * Chaque section est un module chargé à la demande.
 *
 * Changement d'onglet : la nouvelle section entre en glissant depuis le côté de l'onglet choisi
 * (vers la droite → arrive de la droite), 280 ms, `transform` + `opacity` seulement (charte §11.3).
 * Désactivable dans Paramètres ; coupé par « Réduire les animations » du système.
 *
 * Navigation : barre d'onglets flottante en pilule + bouton rond « + » (saisie rapide), design Verre
 * (UX-UI.md, charte §5.5b). Elle est rendue dans #tabbar, HORS de la plaque <main> : le
 * backdrop-filter de la plaque ferait de `position: fixed` une position relative à la plaque.
 */
import { html, mount as render } from '../ui/dom.js';
import { animationsOn } from '../ui/prefs.js';

const SECTIONS = {
    dashboard: { label: 'Tableau de bord', short: 'Tableau',  icon: 'i-pie',      load: () => import('./dashboard.js') },
    affaires:  { label: 'Par affaire',     short: 'Affaires', icon: 'i-folder',   load: () => import('./affaires.js') },
    chrono:    { label: 'Chronologie',     short: 'Chrono',   icon: 'i-calendar', load: () => import('./chrono.js') },
    imputees:  { label: 'Heures imputées', short: 'Imputées', icon: 'i-bars',     load: () => import('./imputees.js') },
    pointage:  { label: 'Pointage CEGID',  short: 'Pointage', icon: 'i-clock',    load: () => import('./pointage.js') },
    // « Réglages » dans la pilule (comme Budget) : « Paramètres » ne tient pas sur un iPhone de 375 pt
    parametres: { label: 'Paramètres',     short: 'Réglages', icon: 'i-gear',     load: () => import('./parametres.js') }
};
const ORDER = Object.keys(SECTIONS);

/** Affaire à ouvrir à l'arrivée sur « Par affaire » (depuis le tableau de bord ou la saisie rapide). */
export const focus = { affaireId: null };

/**
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {{tab: string}} route
 */
export function mount(root, ctx, route) {
    let section = null, name = null, token = 0;
    render(root, html`
        <div class="container suivi">
            <div data-role="section" class="stack"></div>
        </div>`);
    const host = root.querySelector('[data-role="section"]');

    const bar = document.getElementById('tabbar');
    render(bar, html`
        <nav class="tabbar" aria-label="Sections">
            ${Object.entries(SECTIONS).map(([k, s]) => html`
                <a class="tabbar-btn" href="#/suivi/${k}" data-tab="${k}" title="${s.label}" aria-label="${s.label}"><svg class="ico" aria-hidden="true"><use href="#${s.icon}"/></svg><span aria-hidden="true">${s.short}</span></a>`)}
        </nav>
        <button type="button" class="nav-add" data-role="quick" aria-label="Saisie rapide (Ctrl+K)" title="Saisie rapide (Ctrl+K)"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>`);
    bar.hidden = false;
    const onQuick = () => ctx.quick?.();
    bar.querySelector('[data-role="quick"]').addEventListener('click', onQuick);

    async function show(tab) {
        if (tab === name && section) return;
        const my = ++token;
        bar.querySelectorAll('.tabbar-btn').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        const mod = await SECTIONS[tab].load();
        if (my !== token) return;              // navigation plus récente entre-temps
        const dir = name ? Math.sign(ORDER.indexOf(tab) - ORDER.indexOf(name)) : 0;
        section?.destroy?.();
        if (name) scrollTo({ top: 0, behavior: 'instant' });     // chaque onglet s'ouvre en haut
        name = tab;
        section = mod.create(host, { ...ctx, openAffaire });
        if (dir && animationsOn()) enter(dir);
    }

    /** Entrée de la section : glissé + fondu depuis la droite (dir > 0) ou la gauche. */
    function enter(dir) {
        host.classList.remove('entre-d', 'entre-g');
        void host.offsetWidth;                                  // relance l'animation si on change vite d'onglet
        host.classList.add(dir > 0 ? 'entre-d' : 'entre-g');
    }
    host.addEventListener('animationend', e => { if (e.target === host) host.classList.remove('entre-d', 'entre-g'); });

    /** Ouvre une affaire dans « Par affaire ». */
    function openAffaire(id) {
        focus.affaireId = id;
        if (name === 'affaires') section.refresh(); else ctx.nav('#/suivi/affaires');
    }

    show(route.tab);
    return {
        update: r => show(r.tab),
        refresh: () => section?.refresh?.(),
        destroy: () => { token++; section?.destroy?.(); bar.hidden = true; bar.replaceChildren(); }
    };
}
