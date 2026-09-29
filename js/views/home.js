/**
 * Vue Accueil : accès aux applications, sauvegarde / restauration, import d'historique CSV.
 */
import { html, mount as render, on } from '../ui/dom.js';
import { buildBackup, downloadJSON, parseBackup } from '../domain/backup.js';
import { analyzeCSV } from '../domain/csv.js';
import { fromLegacy, summarize } from '../migrate.js';
import { minsToHM, minsToDec, fmtNum } from '../domain/time.js';
import { typeLabel } from '../domain/types.js';

const LOGO_VIEWBOX = '-0.7075779 -0.7075779 160.8458358 25.0010858';

/**
 * @param {HTMLElement} root
 * @param {object} ctx contexte de l'app (store, dialogues, toasts)
 */
export function mount(root, ctx) {
    const ac = new AbortController();
    render(root, html`
        <div class="container home">
            <div class="home-title">
                <svg class="home-logo" viewBox="${LOGO_VIEWBOX}" role="img" aria-label="Getinge"><use href="#logo-getinge"/></svg>
                <h1>Espace collaborateur</h1>
                <p>Choisis une application</p>
            </div>
            <nav class="app-cards" aria-label="Ouvrir une application">
                <a class="app-card" href="#/pointage">
                    <span class="app-card-icon" aria-hidden="true">⏱️</span>
                    <strong>Pointage CEGID</strong>
                    <span>Heures de la semaine, solde, calculateur</span>
                    <span class="kbd">Alt P</span>
                </a>
                <a class="app-card" href="#/suivi/dashboard">
                    <span class="app-card-icon" aria-hidden="true">📋</span>
                    <strong>Suivi projet</strong>
                    <span>Affaires, saisies par type, budgets, chronologie</span>
                    <span class="kbd">Alt S</span>
                </a>
            </nav>
            <section class="admin" aria-labelledby="h-admin">
                <h2 id="h-admin" class="label">Sauvegarde et import</h2>
                <div class="toolbar">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="export">💾 Sauvegarder (JSON)</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="pick-json">📂 Restaurer une sauvegarde</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="pick-csv">📊 Importer un historique CSV</button>
                </div>
                <input type="file" accept=".json,application/json" data-action="import-json" hidden>
                <input type="file" accept=".csv,.txt,text/csv" data-action="import-csv" hidden>
            </section>
        </div>`);

    on(root, 'click', {
        'export': () => { downloadJSON(buildBackup(ctx.store), 'backup_getinge_'); ctx.toast('Sauvegarde téléchargée.'); },
        'pick-json': () => root.querySelector('[data-action="import-json"]').click(),
        'pick-csv': () => root.querySelector('[data-action="import-csv"]').click()
    }, ac.signal);
    on(root, 'change', {
        'import-json': async input => { const f = input.files[0]; input.value = ''; if (f) await importJSON(await f.text(), ctx); },
        'import-csv': async input => { const f = input.files[0]; input.value = ''; if (f) await importCSV(await f.text(), ctx); }
    }, ac.signal);

    return { destroy: () => ac.abort() };
}

/** Restauration complète depuis une sauvegarde JSON. */
async function importJSON(text, ctx) {
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
        ctx.toast(`Restauré : ${s.affaires} affaire(s), ${s.entries} saisie(s), ${s.days} jour(s).`);
    } catch (e) {
        ctx.toast('Restauration incomplète : ' + (e.message || e), { kind: 'error' });
    }
}

/** Import d'historique CSV avec aperçu. */
async function importCSV(text, ctx) {
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
