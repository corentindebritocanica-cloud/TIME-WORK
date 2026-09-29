/**
 * Vue Pointage CEGID : saisie hebdomadaire (lun → ven), motifs Férié / Congé, solde global,
 * calculateur de sessions et soustraction.
 */
import { html, mount as render, on, $, $$, copyText } from '../ui/dom.js';
import { computeBalance } from '../domain/balance.js';
import {
    todayISO, mondayOf, addDays, workWeek, isoWeek, fmtShort, fmtWeekday, fmtWeekdayShort,
    minsToHM, minsToDec, signedHM, WEEK_TARGET_MIN
} from '../domain/time.js';

const REASONS = { ferie: 'Férié', conge: 'Congé' };
const CALC_ROWS = 8;
let weekOffset = 0;           // conservé entre deux visites de la vue
let activeTab = 'hebdo';

/** Barre de progression SVG (aucun style inline). */
const bar = (pct, cls = '') => html`<svg class="bar ${cls}" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect class="bar-bg" width="100" height="5"/><rect class="bar-fill" width="${Math.max(0, Math.min(100, pct)).toFixed(1)}" height="5"/></svg>`;

/**
 * @param {HTMLElement} root
 * @param {object} ctx
 */
export function mount(root, ctx) {
    const ac = new AbortController();
    const { store } = ctx;

    render(root, html`
        <div class="container pointage">
            <div class="page-head">
                <h1>Pointage CEGID</h1>
                <div class="tabs" role="tablist" aria-label="Outils">
                    <button type="button" class="tab" role="tab" id="tab-hebdo" aria-controls="panel-hebdo" data-action="tab" data-tab="hebdo">Saisie hebdo</button>
                    <button type="button" class="tab" role="tab" id="tab-calc" aria-controls="panel-calc" data-action="tab" data-tab="calc">Calculateur</button>
                </div>
            </div>
            <div id="panel-hebdo" role="tabpanel" aria-labelledby="tab-hebdo"></div>
            <div id="panel-calc" role="tabpanel" aria-labelledby="tab-calc"></div>
        </div>`);
    const panelHebdo = $('#panel-hebdo', root), panelCalc = $('#panel-calc', root);

    /* ─────────────── Saisie hebdomadaire ─────────────── */
    const monday = () => addDays(mondayOf(todayISO()), weekOffset * 7);

    function dayCard(iso) {
        const d = store.getDay(iso);
        const reason = d && REASONS[d.reason] ? d.reason : '';
        const min = d ? d.h * 60 + d.m : 0;
        const label = fmtWeekday(iso) + ' ' + fmtShort(iso);
        return html`
            <div class="day ${min ? 'is-filled' : ''} ${iso === todayISO() ? 'is-today' : ''}" data-iso="${iso}" ${reason ? html`data-reason="${reason}"` : ''}>
                <span class="day-name">${fmtWeekdayShort(iso)}</span>
                <span class="day-date">${fmtShort(iso)}</span>
                <span class="day-reason">${reason ? REASONS[reason] : ''}</span>
                <div class="hm">
                    <input class="control num" data-action="hm" data-field="h" inputmode="numeric" maxlength="2" placeholder="H"
                           aria-label="Heures — ${label}" value="${d ? String(d.h) : ''}">
                    <span aria-hidden="true">:</span>
                    <input class="control num" data-action="hm" data-field="m" inputmode="numeric" maxlength="2" placeholder="00"
                           aria-label="Minutes — ${label}" value="${d ? String(d.m).padStart(2, '0') : ''}">
                </div>
                <button type="button" class="day-dec" data-action="copy" data-value="${minsToDec(min)}" aria-label="Copier ${minsToDec(min)} (décimal, ${label})">${minsToDec(min)}</button>
                <div class="day-reasons">
                    ${Object.entries(REASONS).map(([k, v]) => html`<button type="button" class="chip" data-action="reason" data-reason="${k}" aria-pressed="${String(reason === k)}">${v}</button>`)}
                </div>
            </div>`;
    }

    function renderHebdo() {
        const mon = monday(), days = workWeek(mon);
        const label = weekOffset === 0 ? 'Semaine actuelle' : (weekOffset > 0 ? '+' : '') + weekOffset + ' sem.';
        render(panelHebdo, html`
            <div class="week-nav">
                <button type="button" class="btn-icon" data-action="week" data-dir="-1" aria-label="Semaine précédente">❮</button>
                <button type="button" class="btn btn-ghost btn-sm" data-action="week" data-dir="0" ${weekOffset === 0 ? 'disabled' : ''}>Aujourd'hui</button>
                <h2>Semaine ${isoWeek(mon)} <span class="muted">· ${label} · ${fmtShort(days[0])} → ${fmtShort(days[4])}</span></h2>
                <button type="button" class="btn-icon" data-action="week" data-dir="1" aria-label="Semaine suivante">❯</button>
            </div>
            <div class="days">${days.map(dayCard)}</div>
            <div class="week-total">
                <div class="total-card">
                    <span class="balance" data-role="balance" hidden></span>
                    <span class="total-label">Total décimal CEGID (semaine)</span>
                    <button type="button" class="total-value" data-action="copy" data-role="total" aria-label="Copier le total décimal"></button>
                    <span data-role="bar"></span>
                    <span class="total-sub" data-role="sub"></span>
                </div>
                <button type="button" class="btn btn-ghost" data-action="clear-week">Effacer cette semaine</button>
            </div>`);
        updateTotals();
    }

    /** Met à jour totaux, décimaux et solde sans re-rendre les champs (le focus reste en place). */
    function updateTotals() {
        let weekMin = 0;
        $$('.day', panelHebdo).forEach(card => {
            const d = store.getDay(card.dataset.iso);
            const min = d ? d.h * 60 + d.m : 0;
            weekMin += min;
            card.classList.toggle('is-filled', min > 0);
            const dec = $('.day-dec', card);
            dec.textContent = minsToDec(min); dec.dataset.value = minsToDec(min);
        });
        const total = $('[data-role="total"]', panelHebdo);
        total.textContent = minsToDec(weekMin); total.dataset.value = minsToDec(weekMin);
        $('[data-role="sub"]', panelHebdo).textContent = minsToHM(weekMin) + ' / ' + minsToHM(WEEK_TARGET_MIN);
        render($('[data-role="bar"]', panelHebdo), bar(weekMin / WEEK_TARGET_MIN * 100));
        // Solde global (tous les jours pointés)
        const all = {};
        Object.entries(store.getDays()).forEach(([iso, d]) => { const m = d.h * 60 + d.m; if (m > 0) all[iso] = m; });
        const badge = $('[data-role="balance"]', panelHebdo);
        badge.hidden = !Object.keys(all).length;
        if (!badge.hidden) {
            const b = computeBalance(all, todayISO());
            render(badge, html`Solde global<br>${signedHM(b)}`);
            badge.dataset.state = b < 0 ? 'neg' : b > 0 ? 'pos' : 'ok';
            badge.title = 'Heures pointées − 7h06 par jour ouvré passé ou déjà pointé des semaines saisies';
        }
    }

    function refreshReason(card) {
        const r = store.getDay(card.dataset.iso)?.reason;
        if (REASONS[r]) card.dataset.reason = r; else delete card.dataset.reason;
        $('.day-reason', card).textContent = REASONS[r] || '';
        $$('[data-action="reason"]', card).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.reason === r)));
    }

    function onHM(input) {
        input.value = input.value.replace(/\D/g, '');
        const card = input.closest('.day');
        const [hIn, mIn] = $$('input', card);
        const val = (el, max) => el.value === '' ? 0 : (parseInt(el.value, 10) <= max ? parseInt(el.value, 10) : null);
        const h = val(hIn, 23), m = val(mIn, 59);
        [[hIn, h, 'Heures : 0 à 23'], [mIn, m, 'Minutes : 0 à 59']].forEach(([el, v, msg]) => {
            el.classList.toggle('is-invalid', v === null);
            if (v === null) { el.setAttribute('aria-invalid', 'true'); el.title = msg; } else { el.removeAttribute('aria-invalid'); el.title = ''; }
        });
        if (h === null || m === null) return;       // valeur hors bornes : non enregistrée
        store.setDay(card.dataset.iso, (h || m) ? { h, m, reason: null } : null);   // saisie manuelle : plus de motif
        refreshReason(card);
        if (input.dataset.field === 'h' && input.value.length >= 2) { mIn.focus(); mIn.select(); }
        updateTotals();
    }

    function onReason(btn) {
        const card = btn.closest('.day'), iso = card.dataset.iso, reason = btn.dataset.reason;
        const d = store.getDay(iso);
        if (d && d.reason === reason) store.setDay(iso, { ...d, reason: null });
        else {
            store.setDay(iso, { h: 7, m: 6, reason });
            const [hIn, mIn] = $$('input', card);
            hIn.value = '7'; mIn.value = '06';
            [hIn, mIn].forEach(el => { el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); });
        }
        refreshReason(card); updateTotals();
    }

    async function clearWeek() {
        const days = workWeek(monday());
        const before = Object.fromEntries(days.map(iso => [iso, store.getDay(iso)]));
        if (!Object.values(before).some(Boolean)) { ctx.toast('Aucune heure à effacer cette semaine.', { kind: 'info' }); return; }
        if (!await ctx.confirmAction('Effacer la semaine ?', 'Les heures pointées du ' + fmtShort(days[0]) + ' au ' + fmtShort(days[4]) + ' seront supprimées.', 'Effacer', true)) return;
        days.forEach(iso => store.setDay(iso, null));
        renderHebdo();
        ctx.toast('Semaine effacée.', { action: { label: 'Annuler', run: () => { store.restore({ days: before }); renderHebdo(); } } });
    }

    /* ─────────────── Calculateur ─────────────── */
    function renderCalc() {
        render(panelCalc, html`
            <div class="calc">
                <section class="panel" aria-labelledby="h-sessions">
                    <div class="panel-head"><h2 id="h-sessions" class="panel-title">Sessions de travail (addition)</h2>
                        <button type="button" class="btn btn-ghost btn-sm" data-action="calc-clear">Tout vider</button></div>
                    <div class="calc-rows">
                        ${Array.from({ length: CALC_ROWS }, (_, i) => html`
                            <div class="calc-row">
                                <input type="time" class="control" data-action="calc" aria-label="Début de la session ${i + 1}">
                                <span aria-hidden="true">→</span>
                                <input type="time" class="control" data-action="calc" aria-label="Fin de la session ${i + 1}">
                                <output class="calc-res">0h00</output>
                            </div>`)}
                    </div>
                    <div class="calc-total mt-4">
                        <span class="label">Cumul des sessions</span>
                        <button type="button" class="calc-total-value" data-action="copy" data-role="calc-total" aria-label="Copier le cumul">0h00</button>
                    </div>
                    <span data-role="calc-bar">${bar(0)}</span>
                </section>
                <section class="panel" aria-labelledby="h-sub">
                    <div class="panel-head"><h2 id="h-sub" class="panel-title">Soustraction</h2></div>
                    <div class="calc-sub">
                        <input type="time" class="control" data-action="calc" aria-label="Première durée">
                        <span aria-hidden="true">−</span>
                        <input type="time" class="control" data-action="calc" aria-label="Durée à soustraire">
                        <span aria-hidden="true">=</span>
                        <output class="calc-sub-res" data-role="sub-res">0h00</output>
                    </div>
                </section>
            </div>`);
    }

    const toMin = v => { if (!v) return null; const [h, m] = v.split(':').map(Number); return h * 60 + m; };
    function runCalc() {
        let total = 0;
        $$('.calc-row', panelCalc).forEach(row => {
            const [a, b] = $$('input', row).map(i => toMin(i.value));
            const diff = a !== null && b !== null && b > a ? b - a : 0;
            total += diff;
            $('output', row).textContent = minsToHM(diff);
        });
        const t = $('[data-role="calc-total"]', panelCalc);
        t.textContent = minsToHM(total); t.dataset.value = minsToDec(total);
        render($('[data-role="calc-bar"]', panelCalc), bar(total / WEEK_TARGET_MIN * 100));
        const [x, y] = $$('.calc-sub input', panelCalc).map(i => toMin(i.value));
        const sub = (x ?? 0) - (y ?? 0);
        $('[data-role="sub-res"]', panelCalc).textContent = (x === null && y === null) ? '0h00' : (sub < 0 ? '−' : '') + minsToHM(Math.abs(sub));
    }

    /* ─────────────── Onglets, événements ─────────────── */
    function showTab(tab) {
        activeTab = tab;
        $$('[role="tab"]', root).forEach(t => { const on = t.dataset.tab === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
        panelHebdo.hidden = tab !== 'hebdo'; panelCalc.hidden = tab !== 'calc';
    }

    on(root, 'click', {
        tab: b => showTab(b.dataset.tab),
        week: b => { const d = +b.dataset.dir; weekOffset = d === 0 ? 0 : weekOffset + d; renderHebdo(); },
        reason: onReason,
        'clear-week': clearWeek,
        'calc-clear': () => { $$('input', panelCalc).forEach(i => { i.value = ''; }); runCalc(); },
        copy: async b => { if (await copyText(b.dataset.value || b.textContent)) ctx.toast('Copié : ' + (b.dataset.value || b.textContent)); }
    }, ac.signal);
    on(root, 'input', { hm: onHM, calc: runCalc }, ac.signal);
    on(root, 'focusin', { hm: el => el.select() }, ac.signal);
    root.querySelector('[role="tablist"]').addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); e.stopPropagation();
        const next = activeTab === 'hebdo' ? 'calc' : 'hebdo';
        showTab(next); $('#tab-' + next, root).focus();
    }, { signal: ac.signal });

    renderHebdo(); renderCalc(); showTab(activeTab);

    return {
        destroy: () => ac.abort(),
        refresh: () => renderHebdo()
    };
}
