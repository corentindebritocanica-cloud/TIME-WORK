/**
 * Suivi — onglet Paramètres :
 *  1. Types de travail (enregistrés dans Firestore, settings.types) : ajout, ordre par glisser-déposer
 *     (doigt ou souris, Pointer Events) ou au clavier (flèches sur la poignée, boutons ↑ ↓),
 *     masquage, suppression d'un type personnalisé inutilisé, retour à l'ordre par défaut.
 *  2. Apparence (propre à cet appareil) : thème Verre / Neumorphisme, intensité du flou du verre,
 *     animations entre onglets.
 */
import { html, mount as render, on, $, $$ } from '../ui/dom.js';
import {
    allTypes, applyTypeConfig, serializeTypeConfig, normalizeTypeConfig, makeTypeCode, normLabel,
    typeClass, CUSTOM_COLORS, TYPE_LABEL_MAX, BUILTIN_TYPES
} from '../domain/types.js';
import { loadPrefs, savePrefs, flouLabel, DEFAULT_PREFS, FLOU_THEMES } from '../ui/prefs.js';

const THEME_CHOICES = [
    ['verre',  'Verre',          'Halos, verre dépoli'],
    ['neo',    'Neumorphisme',   'Relief doux, sans flou'],
    ['clay',   'Claymorphism',   'Pâte à modeler, formes gonflées'],
    ['aurora', 'Aurora',         'Aurores boréales, verre'],
    ['skeuo',  'Skeuomorphisme', 'Cuir surpiqué, boutons en relief'],
    ['phosphore', 'Phosphore',   'Terminal rétro, vert phosphore'],
    ['blueprint', 'Blueprint',   'Plan d\'atelier, papier quadrillé'],
    ['cyber',     'Cyber',       'Néons de Tokyo, rose et cyan'],
    ['moleskine', 'Moleskine',   'Carnet papier, encre et cuir'],
    ['cockpit',   'Tableau de bord', 'Métal brossé, LED, afficheurs']
];
const THEME_NAMES = Object.fromEntries(THEME_CHOICES.map(([k, n]) => [k, n]));

const AUTO_SCROLL_EDGE = 72;       // px : zone près des bords où la liste défile pendant un glisser
const AUTO_SCROLL_MAX = 14;        // px par image

/**
 * @param {HTMLElement} el
 * @param {object} ctx
 */
export function create(el, ctx) {
    const ac = new AbortController();
    const { store } = ctx;
    let drag = null;               // glisser en cours
    let refreshWanted = false;     // changement distant reçu pendant un glisser
    let addColor = null;           // couleur choisie pour le prochain type

    /* ───────────── Données ───────────── */
    function usage() {
        const n = new Map();
        store.getEntries().forEach(e => n.set(e.type, (n.get(e.type) || 0) + 1));
        const b = new Map();
        store.getAffaires().forEach(a => Object.keys(a.budgets || {}).forEach(k => b.set(k, (b.get(k) || 0) + 1)));
        return { entries: n, budgets: b };
    }

    /** Enregistre la liste (Firestore) et l'applique partout. */
    function commit(list) {
        const types = serializeTypeConfig(list);
        applyTypeConfig(types);
        store.setSettings({ types });
    }

    const nextColor = list => {
        const used = new Set(list.filter(t => t.custom).map(t => t.color));
        for (let i = 0; i < CUSTOM_COLORS; i++) if (!used.has(i)) return i;
        return list.filter(t => t.custom).length % CUSTOM_COLORS;
    };

    /* ───────────── Rendu ───────────── */
    function row(t, u, i, total) {
        const n = u.entries.get(t.code) || 0;
        const meta = [t.custom ? 'Personnalisé' : 'Intégré', n ? n + ' saisie' + (n > 1 ? 's' : '') : 'aucune saisie'].join(' · ');
        return html`
            <li class="type-row ${t.hidden ? 'is-hidden' : ''}" data-code="${t.code}">
                <button type="button" class="drag-handle" data-action="handle" aria-roledescription="poignée de déplacement"
                        aria-label="Déplacer ${t.label} (position ${i + 1} sur ${total}, flèches haut et bas)" title="Glisser pour déplacer">
                    <svg class="ico" aria-hidden="true"><use href="#i-grip"/></svg></button>
                <span class="dot ${typeClass(t.code)}" aria-hidden="true"></span>
                <span class="type-name"><strong>${t.label}</strong><small>${meta}${t.hidden ? html` · <b>masqué</b>` : ''}</small></span>
                <span class="type-actions">
                    <button type="button" class="btn-icon only-fine" data-action="up" aria-label="Monter ${t.label}" ${i === 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" class="btn-icon only-fine" data-action="down" aria-label="Descendre ${t.label}" ${i === total - 1 ? 'disabled' : ''}>↓</button>
                    <button type="button" class="btn-icon" data-action="toggle" aria-pressed="${String(!t.hidden)}"
                            aria-label="${t.hidden ? 'Afficher' : 'Masquer'} ${t.label}" title="${t.hidden ? 'Afficher dans les listes' : 'Masquer des listes'}">
                        <svg class="ico" aria-hidden="true"><use href="${t.hidden ? '#i-eye-off' : '#i-eye'}"/></svg></button>
                    ${t.custom ? html`<button type="button" class="btn-icon danger" data-action="delete" aria-label="Supprimer ${t.label}" title="Supprimer">✕</button>` : ''}
                </span>
            </li>`;
    }

    function draw() {
        const list = allTypes(), u = usage(), prefs = loadPrefs();
        if (addColor === null || addColor >= CUSTOM_COLORS) addColor = nextColor(list);
        render(el, html`
            <section class="panel" aria-labelledby="h-types">
                <div class="panel-head">
                    <h2 id="h-types" class="panel-title">Types de travail</h2>
                    <span class="tag" title="Enregistré dans Firestore : identique sur le PC et l'iPhone">☁ Synchronisé</span>
                </div>
                <p class="settings-help">L'ordre choisi ici est utilisé partout (listes, légendes, budgets).
                    <span class="only-coarse">Maintiens la poignée <b>⋮⋮</b> et glisse pour déplacer un type.</span>
                    <span class="only-fine">Glisse la poignée <b>⋮⋮</b> (ou flèches ↑ ↓ du clavier) pour déplacer un type.</span>
                    Un type masqué n'est plus proposé à la saisie ; ses heures restent comptées.</p>
                <ol class="type-list" data-role="types" aria-label="Types de travail, dans l'ordre">
                    ${list.map((t, i) => row(t, u, i, list.length))}
                </ol>
                <p class="sr-only" aria-live="polite" data-role="live"></p>
                <form class="type-add" data-role="add" novalidate>
                    <label class="field grow"><span>Nouveau type de travail</span>
                        <input class="control" name="label" maxlength="${TYPE_LABEL_MAX}" placeholder="Ex : Essai terrain" autocomplete="off">
                        <small class="field-hint err" data-role="add-err" role="alert"></small></label>
                    <fieldset class="swatches">
                        <legend class="label">Couleur</legend>
                        ${Array.from({ length: CUSTOM_COLORS }, (_, i) => html`
                            <label class="swatch pal-${i}"><input type="radio" name="color" value="${i}" ${i === addColor ? 'checked' : ''} aria-label="Couleur ${i + 1}"><span aria-hidden="true"></span></label>`)}
                    </fieldset>
                    <button type="submit" class="btn btn-primary">+ Ajouter</button>
                </form>
                <div class="toolbar mt-4">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="reset-order">Ordre par défaut</button>
                </div>
            </section>

            <section class="panel" aria-labelledby="h-look">
                <div class="panel-head">
                    <h2 id="h-look" class="panel-title">Apparence</h2>
                    <span class="tag" title="Réglage enregistré sur cet appareil uniquement">Cet appareil</span>
                </div>
                <fieldset class="theme-choice">
                    <legend class="label">Thème</legend>
                    ${THEME_CHOICES.map(([k, label, sub]) => html`
                        <label class="theme-opt">
                            <input type="radio" name="theme" value="${k}" data-action="theme" ${prefs.theme === k ? 'checked' : ''}>
                            <span class="theme-apercu apercu-${k}" aria-hidden="true"><i></i><i></i><i></i></span>
                            <span class="theme-nom"><strong>${label}</strong><small>${sub}</small></span>
                        </label>`)}
                </fieldset>
                <div class="field mt-4">
                    <label for="flou-range">Effet de verre (flou)${FLOU_THEMES.includes(prefs.theme) ? '' : html` <span class="muted">— sans effet avec ce thème</span>`}</label>
                    <div class="range-row">
                        <span class="muted" aria-hidden="true">Réduit</span>
                        <input id="flou-range" type="range" min="0" max="100" step="5" value="${prefs.flou}" data-action="flou" aria-describedby="flou-val" ${FLOU_THEMES.includes(prefs.theme) ? '' : 'disabled'}>
                        <span class="muted" aria-hidden="true">Accentué</span>
                    </div>
                    <output id="flou-val" class="range-val" data-role="flou-val" for="flou-range">${flouLabel(prefs.flou)}</output>
                </div>
                <div class="toolbar">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="flou-reset" ${prefs.flou === DEFAULT_PREFS.flou || !FLOU_THEMES.includes(prefs.theme) ? 'disabled' : ''}>Valeur d'origine</button>
                </div>
                <label class="check mt-4"><input type="checkbox" data-action="anim" ${prefs.animations ? 'checked' : ''}> Animations entre les onglets</label>
                <p class="settings-help mt-4">Plus le flou est fort, plus l'affichage demande de calcul (surtout sur iPhone).
                    Si le réglage « Réduire les animations » du système est actif, les animations restent coupées.</p>
            </section>`);
    }

    /* ───────────── Actions sur les types ───────────── */
    const codeOf = node => node.closest('.type-row')?.dataset.code;
    const say = msg => { const l = $('[data-role="live"]', el); if (l) l.textContent = msg; };

    function move(code, delta, focusHandle) {
        const list = allTypes(), i = list.findIndex(t => t.code === code), j = i + delta;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        commit(list);
        draw();
        say(list[j].label + ' : position ' + (j + 1) + ' sur ' + list.length);
        if (focusHandle) $(`.type-row[data-code="${CSS.escape(code)}"] .drag-handle`, el)?.focus();
    }

    function toggle(btn) {
        const list = allTypes(), t = list.find(x => x.code === codeOf(btn));
        if (!t) return;
        if (!t.hidden && list.filter(x => !x.hidden).length <= 1) { ctx.toast('Garde au moins un type visible.', { kind: 'error' }); return; }
        t.hidden = !t.hidden;
        commit(list); draw();
        ctx.toast(`« ${t.label} » ${t.hidden ? 'masqué des listes' : 'de nouveau proposé'}.`);
    }

    async function remove(btn) {
        const list = allTypes(), t = list.find(x => x.code === codeOf(btn));
        if (!t || !t.custom) return;
        const u = usage(), n = u.entries.get(t.code) || 0, b = u.budgets.get(t.code) || 0;
        if (n || b) {
            await ctx.inform('Type utilisé', `« ${t.label} » est utilisé par ${n} saisie(s)${b ? ` et ${b} budget(s)` : ''} : il ne peut pas être supprimé. Masque-le pour ne plus le proposer.`);
            return;
        }
        if (!await ctx.confirmAction('Supprimer le type ?', `« ${t.label} » sera retiré de la liste, sur tous les postes.`, 'Supprimer', true)) return;
        const before = allTypes();
        commit(list.filter(x => x.code !== t.code)); draw();
        ctx.toast(`Type « ${t.label} » supprimé.`, { action: { label: 'Annuler', run: () => { commit(before); draw(); } } });
    }

    function add(form) {
        const input = form.elements.label, err = $('[data-role="add-err"]', form);
        const label = input.value.trim().replace(/\s+/g, ' ');
        const bad = msg => { err.textContent = msg; input.classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true'); input.focus(); };
        err.textContent = ''; input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid');
        if (!label) return bad('Donne un nom au type de travail.');
        if (label.length > TYPE_LABEL_MAX) return bad(`${TYPE_LABEL_MAX} caractères maximum.`);
        const list = allTypes();
        const same = list.find(t => normLabel(t.label) === normLabel(label));
        if (same) return bad(`« ${same.label} » existe déjà${same.hidden ? ' (masqué : réaffiche-le avec l\'œil)' : ''}.`);
        const color = Number(new FormData(form).get('color')) || 0;
        const code = makeTypeCode(label, list.map(t => t.code));
        list.push({ code, label, custom: true, hidden: false, color });
        commit(list);
        addColor = null;
        draw();
        ctx.toast(`Type « ${label} » ajouté : il est proposé dans toutes les saisies.`);
        $('[name="label"]', el)?.focus();
        $(`.type-row[data-code="${CSS.escape(code)}"]`, el)?.scrollIntoView({ block: 'nearest' });
    }

    function resetOrder() {
        const before = allTypes();
        const custom = before.filter(t => t.custom);
        const hidden = new Set(before.filter(t => t.hidden).map(t => t.code));
        const list = [...normalizeTypeConfig(BUILTIN_TYPES.map(t => ({ code: t.code }))).map(t => ({ ...t, hidden: hidden.has(t.code) })), ...custom];
        commit(list); draw();
        ctx.toast('Ordre par défaut rétabli (types personnalisés à la fin).', { action: { label: 'Annuler', run: () => { commit(before); draw(); } } });
    }

    /* ───────────── Glisser-déposer (doigt ou souris) ───────────── */
    function startDrag(handle, ev) {
        if (drag || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
        ev.preventDefault();
        const row = handle.closest('.type-row'), list = row.parentElement;
        handle.setPointerCapture?.(ev.pointerId);
        drag = { handle, row, list, id: ev.pointerId, startY: ev.clientY, y: ev.clientY, scroll0: scrollY,
                 before: $$('.type-row', list).map(r => r.dataset.code), raf: 0 };
        row.classList.add('is-dragging');
        list.classList.add('is-sorting');
        const loop = () => { if (!drag) return; autoScroll(); follow(); drag.raf = requestAnimationFrame(loop); };
        drag.raf = requestAnimationFrame(loop);
    }

    /** La ligne suit le doigt 1:1 ; elle échange sa place avec sa voisine quand son centre la dépasse. */
    function follow() {
        const { row, list } = drag;
        const dy = () => drag.y - drag.startY + (scrollY - drag.scroll0);
        row.style.setProperty('--dy', dy() + 'px');
        const r = row.getBoundingClientRect(), mid = r.top + r.height / 2;
        const next = row.nextElementSibling, prev = row.previousElementSibling;
        let other = null;
        if (next) { const n = next.getBoundingClientRect(); if (mid > n.top + n.height / 2) other = next; }
        if (!other && prev) { const p = prev.getBoundingClientRect(); if (mid < p.top + p.height / 2) other = prev; }
        if (!other) return;
        const rowTop = row.offsetTop, otherTop = other.getBoundingClientRect().top;
        // On déplace toujours la VOISINE, jamais la ligne tenue : retirer du document l'élément qui a
        // capturé le pointeur annule la capture (lostpointercapture) et le geste s'arrêtait après un cran.
        if (other === next) list.insertBefore(next, row); else list.insertBefore(prev, row.nextSibling);
        drag.startY += row.offsetTop - rowTop;            // la ligne a changé de place : elle reste sous le doigt
        row.style.setProperty('--dy', dy() + 'px');
        // La voisine glisse vers sa nouvelle place (FLIP, 150 ms) au lieu de sauter
        const delta = otherTop - other.getBoundingClientRect().top;
        if (delta) other.animate?.([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 150, easing: 'ease-out' });
    }

    function autoScroll() {
        const bar = document.getElementById('tabbar');
        const bottomEdge = Math.min(innerHeight, bar && !bar.hidden ? bar.getBoundingClientRect().top : innerHeight) - AUTO_SCROLL_EDGE;
        let v = 0;
        if (drag.y < AUTO_SCROLL_EDGE) v = -Math.ceil((AUTO_SCROLL_EDGE - drag.y) / AUTO_SCROLL_EDGE * AUTO_SCROLL_MAX);
        else if (drag.y > bottomEdge) v = Math.ceil(Math.min(1, (drag.y - bottomEdge) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX);
        if (v) scrollBy(0, v);
    }

    function endDrag(cancelled) {
        if (!drag) return;
        const { row, list, before, raf } = drag;
        cancelAnimationFrame(raf);
        row.classList.remove('is-dragging'); row.style.removeProperty('--dy');
        list.classList.remove('is-sorting');
        const after = $$('.type-row', list).map(r => r.dataset.code);
        drag = null;
        if (cancelled || after.join() === before.join()) { if (cancelled) draw(); flushRefresh(); return; }
        const byCode = new Map(allTypes().map(t => [t.code, t]));
        commit(after.map(c => byCode.get(c)).filter(Boolean));
        const code = row.dataset.code, pos = after.indexOf(code) + 1;
        draw();
        say(byCode.get(code).label + ' : position ' + pos + ' sur ' + after.length);
        refreshWanted = false;
    }
    function flushRefresh() { if (refreshWanted) { refreshWanted = false; draw(); } }

    /* ───────────── Événements (délégués) ───────────── */
    on(el, 'click', {
        up: b => move(codeOf(b), -1),
        down: b => move(codeOf(b), +1),
        toggle, delete: remove,
        'reset-order': resetOrder,
        'flou-reset': () => { savePrefs({ flou: DEFAULT_PREFS.flou }); draw(); $('#flou-range', el)?.focus(); }
    }, ac.signal);
    on(el, 'keydown', {
        handle: (h, e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            move(codeOf(h), e.key === 'ArrowUp' ? -1 : 1, true);
        }
    }, ac.signal);
    on(el, 'pointerdown', { handle: (h, e) => startDrag(h, e) }, ac.signal);
    el.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) drag.y = e.clientY; }, { signal: ac.signal });
    el.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) endDrag(false); }, { signal: ac.signal });
    el.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) endDrag(true); }, { signal: ac.signal });
    el.addEventListener('lostpointercapture', e => { if (drag && e.pointerId === drag.id) endDrag(false); }, { signal: ac.signal });
    on(el, 'input', {
        flou: r => { savePrefs({ flou: +r.value }); $('[data-role="flou-val"]', el).textContent = flouLabel(r.value);
                     const reset = $('[data-action="flou-reset"]', el); if (reset) reset.disabled = +r.value === DEFAULT_PREFS.flou; }
    }, ac.signal);
    on(el, 'change', {
        theme: r => {
            if (!r.checked) return;
            savePrefs({ theme: r.value });
            draw();
            $(`[name="theme"][value="${r.value}"]`, el)?.focus();
            ctx.toast(`Thème ${THEME_NAMES[r.value]} appliqué sur cet appareil.`);
        },
        anim: c => { savePrefs({ animations: c.checked }); ctx.toast(c.checked ? 'Animations entre les onglets activées.' : 'Animations entre les onglets désactivées.'); }
    }, ac.signal);
    el.addEventListener('change', e => { if (e.target.name === 'color') addColor = +e.target.value; }, { signal: ac.signal });
    el.addEventListener('submit', e => { e.preventDefault(); if (e.target.dataset.role === 'add') add(e.target); }, { signal: ac.signal });

    draw();
    return {
        // Changement venu d'un autre poste : pas de re-rendu pendant un glisser (il casserait le geste)
        refresh: () => { if (drag) refreshWanted = true; else draw(); },
        destroy: () => { if (drag) cancelAnimationFrame(drag.raf); drag = null; ac.abort(); }
    };
}
