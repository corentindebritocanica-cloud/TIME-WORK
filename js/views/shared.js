/**
 * Fragments partagés entre les sections du Suivi.
 */
import { html } from '../ui/dom.js';
import { minsToHM } from '../domain/time.js';

/**
 * Barre de consommation du budget (vide si aucun budget).
 * @param {number} spentMin minutes consommées
 * @param {Object<string,number>} budgets heures par type
 * @param {'/'|'sur'} [sep]
 */
export function budgetBar(spentMin, budgets, sep = 'sur') {
    const budgetMin = Object.values(budgets || {}).reduce((s, h) => s + (h || 0) * 60, 0);
    if (budgetMin <= 0) return '';
    const pct = Math.min(Math.round(spentMin / budgetMin * 100), 999);
    const state = spentMin > budgetMin ? 'is-over' : pct > 80 ? 'is-warn' : '';
    return html`
        <svg class="bar ${state}" viewBox="0 0 100 5" preserveAspectRatio="none" role="img" aria-label="Budget consommé : ${pct} %"><rect class="bar-bg" width="100" height="5"/><rect class="bar-fill" width="${Math.min(pct, 100)}" height="5"/></svg>
        <span class="bar-label ${state}">${pct} % ${sep} ${minsToHM(budgetMin)}</span>`;
}

/** Minutes par type. @param {{type:string, minutes:number}[]} entries */
export function minutesByType(entries) {
    const m = {};
    entries.forEach(e => { m[e.type] = (m[e.type] || 0) + e.minutes; });
    return m;
}
