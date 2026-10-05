/**
 * Fragments partagés entre les sections du Suivi.
 */
import { html } from '../ui/dom.js';
import { minsToHM } from '../domain/time.js';
import { TYPES, typeLabel, affLoadGroups } from '../domain/types.js';

/**
 * Options d'une liste « Type » pour une affaire : types visibles (ordre de Paramètres), puis un
 * groupe par famille découpée en Loads (« CD — par Load », « MEP — par Load »).
 * Un type masqué ou un Load retiré déjà utilisé par la saisie reste affiché (sélectionné).
 * @param {object|null} aff affaire (null : aucune affaire choisie)
 * @param {string} selected code sélectionné
 */
export function typeOptions(aff, selected) {
    const groups = affLoadGroups(aff);
    const known = TYPES.some(t => t.code === selected) || groups.some(g => g.codes.includes(selected));
    return html`
        ${TYPES.map(t => html`<option value="${t.code}" ${t.code === selected ? 'selected' : ''}>${t.label}</option>`)}
        ${selected && !known ? html`<option value="${selected}" selected>${typeLabel(selected)}</option>` : ''}
        ${groups.map(g => html`<optgroup label="${g.fam} — par Load">${g.loads.map((l, i) =>
            html`<option value="${g.codes[i]}" ${g.codes[i] === selected ? 'selected' : ''}>${g.fam} Load ${l}</option>`)}</optgroup>`)}`;
}

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
