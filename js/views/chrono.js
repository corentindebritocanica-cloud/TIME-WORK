/**
 * Suivi — chronologie : une section repliable par semaine, saisies groupées par jour.
 */
import { html, mount as render, $, toElement } from '../ui/dom.js';
import { mondayOf, addDays, isoWeek, fmtShort, fmtLong, minsToHM, minsToDec } from '../domain/time.js';
import { typeLabel, typeClass } from '../domain/types.js';

const openWeeks = new Set();

/**
 * @param {HTMLElement} el
 * @param {object} ctx
 */
export function create(el, ctx) {
    const ac = new AbortController();
    const { store } = ctx;
    let weeks = new Map(), affById = new Map();

    function body(mon) {
        const list = weeks.get(mon).slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
        const days = [...new Set(list.map(e => e.date))];
        const tot = list.reduce((s, e) => s + e.minutes, 0);
        return html`<div class="acc-body table-wrap"><table class="table">
            <caption class="sr-only">Saisies de la semaine ${isoWeek(mon)}</caption>
            <thead><tr><th>Affaire</th><th>Client</th><th>Type</th><th class="num">Temps</th><th class="num">Décimal</th></tr></thead>
            <tbody>${days.map(d => {
                const de = list.filter(e => e.date === d), dt = de.reduce((s, e) => s + e.minutes, 0);
                return html`<tr class="group"><td colspan="3">${fmtLong(d)}</td><td class="num">${minsToHM(dt)}</td><td class="num dec">${minsToDec(dt)}</td></tr>
                    ${de.map(e => { const a = affById.get(e.affaireId) || {}; return html`
                        <tr><td class="accent">${a.num || '—'}</td><td class="muted">${a.client || ''}</td>
                            <td><span class="badge ${typeClass(e.type)}">${typeLabel(e.type)}</span></td>
                            <td class="num">${minsToHM(e.minutes)}</td><td class="num dec">${minsToDec(e.minutes)}</td></tr>`; })}`;
            })}
            <tr class="total"><td colspan="3">Total semaine ${isoWeek(mon)}</td><td class="num">${minsToHM(tot)}</td><td class="num">${minsToDec(tot)}</td></tr></tbody>
        </table></div>`;
    }

    function draw() {
        affById = new Map(store.getAffaires().map(a => [a.id, a]));
        weeks = new Map();
        store.getEntries().forEach(e => { const m = mondayOf(e.date); if (!weeks.has(m)) weeks.set(m, []); weeks.get(m).push(e); });
        const mons = [...weeks.keys()].sort().reverse();
        render(el, mons.length ? html`${mons.map(m => {
            const tot = weeks.get(m).reduce((s, e) => s + e.minutes, 0);
            return html`<details class="acc" data-week="${m}" ${openWeeks.has(m) ? 'open' : ''}>
                <summary class="acc-head">
                    <div class="acc-title"><strong>Semaine ${isoWeek(m)}</strong><span>${fmtShort(m)} → ${fmtShort(addDays(m, 4))}</span></div>
                    <div class="acc-meta"><span class="acc-total">${minsToHM(tot)}</span></div>
                </summary>
                ${openWeeks.has(m) ? body(m) : ''}
            </details>`;
        })}` : html`<p class="empty panel">Aucune saisie enregistrée</p>`);
    }

    el.addEventListener('toggle', ev => {
        const d = ev.target;
        if (!d.matches?.('details[data-week]')) return;
        const m = d.dataset.week;
        if (d.open) { openWeeks.add(m); if (!$('.acc-body', d)) d.append(toElement(body(m))); }
        else openWeeks.delete(m);
    }, { capture: true, signal: ac.signal });

    draw();
    return { refresh: draw, destroy: () => ac.abort() };
}
