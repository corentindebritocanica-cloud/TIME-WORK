/**
 * Vue principale : hôte des 5 sections (tableau de bord, par affaire, chronologie, heures imputées,
 * pointage CEGID).
 * Chaque section est un module chargé à la demande.
 */
import { html, mount as render } from '../ui/dom.js';

const SECTIONS = {
    dashboard: { label: 'Tableau de bord', icon: '🏠', load: () => import('./dashboard.js') },
    affaires:  { label: 'Par affaire',     icon: '📁', load: () => import('./affaires.js') },
    chrono:    { label: 'Chronologie',     icon: '📅', load: () => import('./chrono.js') },
    imputees:  { label: 'Heures imputées', icon: '🕐', load: () => import('./imputees.js') },
    pointage:  { label: 'Pointage CEGID',  icon: '⏱️', load: () => import('./pointage.js') }
};

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
            <div class="page-head">
                <h1 class="sr-only">TIME-WORK — suivi des heures</h1>
                <nav class="tabs" aria-label="Sections du suivi">
                    ${Object.entries(SECTIONS).map(([k, s], i) => html`
                        <a class="tab" href="#/suivi/${k}" data-tab="${k}"><span aria-hidden="true">${s.icon}</span> ${s.label}</a>`)}
                </nav>
            </div>
            <div data-role="section" class="stack"></div>
        </div>`);
    const host = root.querySelector('[data-role="section"]');

    async function show(tab) {
        if (tab === name && section) return;
        const my = ++token;
        root.querySelectorAll('.tab').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        const mod = await SECTIONS[tab].load();
        if (my !== token) return;              // navigation plus récente entre-temps
        section?.destroy?.();
        name = tab;
        section = mod.create(host, { ...ctx, openAffaire });
    }

    /** Ouvre une affaire dans « Par affaire ». */
    function openAffaire(id) {
        focus.affaireId = id;
        if (name === 'affaires') section.refresh(); else ctx.nav('#/suivi/affaires');
    }

    show(route.tab);
    return {
        update: r => show(r.tab),
        refresh: () => section?.refresh?.(),
        destroy: () => { token++; section?.destroy?.(); }
    };
}
