/**
 * Suivi — heures imputées de la semaine : total par jour, écart avec le pointage CEGID,
 * détail des saisies de chaque jour. Navigation par les boutons de semaine.
 */
import { html, mount as render, on, $ } from '../ui/dom.js';
import {
    todayISO, mondayOf, addDays, workWeek, isoWeek, fmtShort, fmtWeekday, fmtWeekdayShort, minsToHM, minsToDec, signedHM
} from '../domain/time.js';
import { typeLabel, typeClass } from '../domain/types.js';

let weekOffset = 0;
const closedDays = new Set();

/**
 * @param {HTMLElement} el
 * @param {object} ctx
 */
export function create(el, ctx) {
    const ac = new AbortController();
    const { store } = ctx;

    const gap = (pointed, imputed) => (pointed || imputed)
        ? html`<span class="gap-line" title="Écart = pointage CEGID − heures imputées aux affaires">Pointé ${minsToHM(pointed)} · <span class="${pointed === imputed ? 'gap-ok' : 'gap-warn'}">écart ${signedHM(pointed - imputed)}</span></span>`
        : '';

    function draw() {
        const today = todayISO(), mon = addDays(mondayOf(today), weekOffset * 7), days = workWeek(mon);
        const affById = new Map(store.getAffaires().map(a => [a.id, a]));
        const wk = store.getEntries().filter(e => e.date >= days[0] && e.date <= days[4]);
        const byDay = Object.fromEntries(days.map(d => [d, wk.filter(e => e.date === d).sort((a, b) => a.createdAt - b.createdAt)]));
        const imputed = days.map(d => byDay[d].reduce((s, e) => s + e.minutes, 0));
        const pointed = days.map(d => { const p = store.getDay(d); return p ? p.h * 60 + p.m : 0; });
        const weekTot = imputed.reduce((s, v) => s + v, 0);

        render(el, html`
            <section class="panel" aria-labelledby="h-wk">
                <div class="panel-head">
                    <h2 id="h-wk" class="panel-title">Semaine ${isoWeek(mon)} · ${fmtShort(days[0])} → ${fmtShort(days[4])}</h2>
                    <div class="toolbar">
                        <button type="button" class="btn-icon" data-action="week" data-dir="-1" aria-label="Semaine précédente">❮</button>
                        <button type="button" class="btn btn-ghost btn-sm" data-action="week" data-dir="0" ${weekOffset === 0 ? 'disabled' : ''}>Cette semaine</button>
                        <button type="button" class="btn-icon" data-action="week" data-dir="1" aria-label="Semaine suivante">❯</button>
                    </div>
                </div>
                <div class="grid-kpi">
                    ${days.map((d, i) => html`
                        <button type="button" class="tile ${d === today ? 'is-accent c-accent' : ''}" data-action="goto" data-day="${d}">
                            <span class="tile-label">${fmtWeekdayShort(d)} ${fromDate(d)}</span>
                            <span class="tile-value">${imputed[i] ? minsToHM(imputed[i]) : '—'}</span>
                            <span class="tile-sub">${imputed[i] ? html`<span class="dec">${minsToDec(imputed[i])}</span>` : 'Aucune saisie'}</span>
                            ${gap(pointed[i], imputed[i])}
                        </button>`)}
                    <div class="tile is-accent is-wide c-accent">
                        <span class="tile-label">Total semaine</span>
                        <span class="tile-value">${minsToHM(weekTot)}</span>
                        <span class="tile-sub">${minsToDec(weekTot)} décimal</span>
                        ${gap(pointed.reduce((s, v) => s + v, 0), weekTot)}
                    </div>
                </div>
            </section>
            ${days.map((d, i) => html`
                <details class="acc day-panel ${d === today ? 'is-today' : ''}" id="day-${d}" data-day="${d}" ${closedDays.has(d) ? '' : 'open'}>
                    <summary class="acc-head">
                        <span class="date-badge" aria-hidden="true"><small>${fmtWeekdayShort(d)}</small><b>${fromDate(d)}</b></span>
                        <div class="acc-title"><strong class="cap">${fmtWeekday(d)}${d === today ? html`<span class="today-tag">Aujourd'hui</span>` : ''}</strong>
                            <span>${byDay[d].length} saisie${byDay[d].length > 1 ? 's' : ''}</span></div>
                        <div class="acc-meta">
                            <span class="acc-total">${imputed[i] ? minsToHM(imputed[i]) : '—'}</span>
                            ${imputed[i] ? html`<span class="dec nowrap"> ${minsToDec(imputed[i])} déc.</span>` : ''}
                            <div>${gap(pointed[i], imputed[i])}</div>
                        </div>
                    </summary>
                    <div class="acc-body table-wrap">
                        ${byDay[d].length ? html`<table class="table">
                            <caption class="sr-only">Saisies du ${fmtWeekday(d)} ${fmtShort(d)}</caption>
                            <thead><tr><th>Client</th><th>Code affaire</th><th>Type</th><th class="num">Heures</th><th class="num">Décimal</th></tr></thead>
                            <tbody>${byDay[d].map(e => { const a = affById.get(e.affaireId) || {}; return html`
                                <tr><td class="strong">${a.client || '—'}</td><td>${a.id ? html`<button type="button" class="btn-link" data-action="open-entry" data-aff="${a.id}" data-entry="${e.id}"
                                        title="Modifier cette saisie dans Affaires">${a.num || a.client || '(sans N°)'}</button>` : '—'}</td>
                                    <td><span class="badge ${typeClass(e.type)}">${typeLabel(e.type)}</span></td>
                                    <td class="num strong">${minsToHM(e.minutes)}</td><td class="num dec">${minsToDec(e.minutes)}</td></tr>`; })}</tbody>
                        </table>` : html`<p class="empty">Aucune saisie</p>`}
                    </div>
                </details>`)}`);
    }

    const fromDate = iso => String(+iso.slice(8, 10));

    on(el, 'click', {
        week: b => { const d = +b.dataset.dir; weekOffset = d === 0 ? 0 : weekOffset + d; draw(); },
        'open-entry': b => ctx.openAffaire(b.dataset.aff, b.dataset.entry),
        goto: b => { const p = $('#day-' + b.dataset.day, el); p.open = true; p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, ac.signal);
    el.addEventListener('toggle', ev => {
        const d = ev.target;
        if (!d.matches?.('details[data-day]')) return;
        if (d.open) closedDays.delete(d.dataset.day); else closedDays.add(d.dataset.day);
    }, { capture: true, signal: ac.signal });

    draw();
    return {
        refresh: draw,
        destroy: () => ac.abort()
    };
}
