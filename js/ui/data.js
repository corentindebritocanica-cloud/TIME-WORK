/**
 * Menu « Données » de l'en-tête : sauvegarde JSON, restauration, import d'historique CSV.
 * Module chargé à la demande (premier clic sur une action).
 */
import { html } from './dom.js';
import { buildBackup, downloadJSON, parseBackup } from '../domain/backup.js';
import { analyzeCSV } from '../domain/csv.js';
import { fromLegacy, summarize } from '../migrate.js';
import { minsToHM, minsToDec, fmtNum } from '../domain/time.js';
import { typeLabel, applyTypeConfig, normalizeTypeConfig, serializeTypeConfig } from '../domain/types.js';

/**
 * Télécharge une sauvegarde JSON complète.
 * @param {object} ctx contexte de l'app (store, toast)
 */
export function exportBackup(ctx) {
    downloadJSON(buildBackup(ctx.store), 'backup_getinge_');
    ctx.toast('Sauvegarde téléchargée.');
}

/**
 * Restauration complète depuis une sauvegarde JSON (confirmation + sauvegarde préalable).
 * @param {string} text contenu du fichier
 * @param {object} ctx
 */
export async function importJSON(text, ctx) {
    const src = parseBackup(text);
    if (!src) { await ctx.inform('Fichier invalide', 'Ce fichier n\'est pas une sauvegarde TIME-WORK valide.'); return; }
    const data = fromLegacy(src);
    const s = summarize(data);
    const ok = await ctx.confirmAction('Restaurer la sauvegarde ?',
        `${s.affaires} affaire(s), ${s.entries} saisie(s) et ${s.days} jour(s) pointé(s)` +
        (data.dropped ? ` (${data.dropped} élément(s) invalide(s) ignoré(s))` : '') +
        '. Toutes les données actuelles seront remplacées, sur tous les postes. L\'état actuel est d\'abord téléchargé.',
        'Restaurer', true);
    if (!ok) return;
    downloadJSON(buildBackup(ctx.store), 'backup_avant_restauration_');
    ctx.toast('Restauration en cours…', { kind: 'info' });
    try {
        await ctx.store.replaceAll(data);
        if (src.types) {                        // types de travail personnalisés de la sauvegarde
            const types = serializeTypeConfig(normalizeTypeConfig(src.types));
            ctx.store.setSettings({ types });
            applyTypeConfig(types);
        }
        ctx.toast(`Restauré : ${s.affaires} affaire(s), ${s.entries} saisie(s), ${s.days} jour(s).`);
    } catch (e) {
        ctx.toast('Restauration incomplète : ' + (e.message || e), { kind: 'error' });
    }
}

/**
 * Import d'historique CSV avec aperçu (doublons ignorés).
 * @param {string} text contenu du fichier
 * @param {object} ctx
 */
export async function importCSV(text, ctx) {
    const a = analyzeCSV(text, ctx.store.getAffaires(), ctx.store.getEntries());
    const n = a.newEntries.length;
    const tile = (label, value, cls) => html`<div class="tile ${cls}"><span class="tile-label">${label}</span><span class="tile-value">${value}</span></div>`;
    const body = html`
        <div class="grid-kpi">
            ${tile('Saisies à importer', n, 'c-ok')}
            ${tile('Total heures', minsToDec(a.total) + ' h', 'c-accent')}
            ${tile('Nouvelles affaires', a.newAffaires.length, 'c-warn')}
            ${tile('Déjà importées', a.duplicates, a.duplicates ? 'c-warn' : '')}
            ${tile('Lignes ignorées', a.errors.length, a.errors.length ? 'c-danger' : '')}
        </div>
        ${a.duplicates ? html`<p class="notice">ℹ ${a.duplicates} ligne(s) identique(s) à des saisies existantes (même date, affaire, type et durée) : ignorée(s).${n ? '' : ' Rien de nouveau à importer.'}</p>` : ''}
        ${a.unknownTypes.length ? html`<p class="notice warn">⚠ Types inconnus reclassés en « Autre » : ${a.unknownTypes.map((t, i) => html`${i ? ', ' : ''}<b>${t || '(vide)'}</b>`)}</p>` : ''}
        ${a.newAffaires.length ? html`<div><h3>Nouvelles affaires</h3><ul class="scroll-list">${a.newAffaires.map(x => html`<li><b class="accent">${x.num || '—'}</b> · ${x.client || 'sans client'}</li>`)}</ul></div>` : ''}
        ${n ? html`<div><h3>Aperçu (10 premières lignes)</h3><div class="table-wrap"><table class="table">
            <thead><tr><th>Client</th><th>Code</th><th>Date</th><th>Type</th><th class="num">Durée</th></tr></thead>
            <tbody>${a.newEntries.slice(0, 10).map(e => html`<tr><td>${e.client || '—'}</td><td class="accent">${e.codeAff || '—'}</td><td>${fmtNum(e.date)}</td><td>${typeLabel(e.type)}</td><td class="num">${minsToHM(e.minutes)}</td></tr>`)}</tbody>
        </table></div></div>` : ''}
        ${a.errors.length ? html`<div><h3 class="danger">Erreurs (${a.errors.length})</h3><ul class="scroll-list danger">${a.errors.slice(0, 100).map(e => html`<li>${e}</li>`)}${a.errors.length > 100 ? html`<li>… et ${a.errors.length - 100} de plus</li>` : ''}</ul></div>` : ''}`;
    const r = await ctx.ask({ title: '📊 Import d\'historique CSV', size: 'l', body,
        buttons: n ? [{ id: 'go', label: `Importer ${n} saisie(s)`, kind: 'primary' }, { id: 'cancel', label: 'Annuler' }]
                   : [{ id: 'cancel', label: 'Fermer', kind: 'primary' }] });
    if (r !== 'go') return;
    const res = ctx.store.bulkAdd(a.newAffaires, a.newEntries.map(e =>
        e.affaireId ? { affaireId: e.affaireId, date: e.date, type: e.type, minutes: e.minutes }
                    : { tempAffId: e.tempAffId, date: e.date, type: e.type, minutes: e.minutes }));
    ctx.toast(`Import terminé : ${res.entries} saisie(s), ${res.affaires} nouvelle(s) affaire(s).`);
}
