/**
 * Suivi — tableau de bord : filtre de période, indicateurs, répartition par type,
 * temps productif de la semaine, répartition par machine, liste des affaires.
 */
import { html, mount as render, on } from '../ui/dom.js';
import { pie, bindPieHover } from '../ui/pie.js';
import { typeLabel, typeClass, globalType, sortTypes } from '../domain/types.js';
import { todayISO, mondayOf, addDays, workWeek, isoWeek, fmtShort, fmtNum, minsToHM } from '../domain/time.js';
import { budgetBar } from './shared.js';

let prodOffset = 0;     // 0 = semaine en cours, -1 = précédente…
const DEFAULT_FILTER = { preset: 'ALL', year: null, from: '', to: '' };

/**
 * @param {HTMLElement} el
 * @param {object} ctx
 */
export function create(el, ctx) {
    const ac = new AbortController();
    const { store } = ctx;
    const filter = () => ({ ...DEFAULT_FILTER, ...(store.getSettings().dashFilter || {}) });
    const setFilter = f => { store.setSettings({ dashFilter: { ...filter(), ...f } }); draw(); };

    function range(f) {
        if (f.preset === 'YEAR' && f.year) return { from: f.year + '-01-01', to: f.year + '-12-31' };
        if (f.preset === 'CUSTOM' && (f.from || f.to)) return { from: f.from || '0000-01-01', to: f.to || '9999-12-31' };
        return null;
    }

    function draw() {
        const affaires = store.getAffaires(), all = store.getEntries();
        const f = filter(), r = range(f);
        const entries = r ? all.filter(e => e.date >= r.from && e.date <= r.to) : all;
        const years = [...new Set(all.map(e => e.date.slice(0, 4)))].sort();
        const total = entries.reduce((s, e) => s + e.minutes, 0);
        const dates = [...new Set(entries.map(e => e.date))].sort();
        const info = !r ? 'Toutes les données'
            : (r.from !== '0000-01-01' ? fmtNum(r.from) : '…') + ' → ' + (r.to !== '9999-12-31' ? fmtNum(r.to) : '…');

        const byType = {};
        entries.forEach(e => { const t = globalType(e.type); byType[t] = (byType[t] || 0) + e.minutes; });
        const pieData = sortTypes(Object.keys(byType)).map(t => ({ key: t, label: typeLabel(t), mins: byType[t], cls: typeClass(t) }));

        render(el, html`
            <section class="panel" aria-label="Période">
                <div class="filter-bar">
                    <span class="label">Période</span>
                    <button type="button" class="chip" data-action="preset" data-preset="ALL" aria-pressed="${String(f.preset === 'ALL')}">Tout</button>
                    ${years.map(y => html`<button type="button" class="chip" data-action="year" data-year="${y}" aria-pressed="${String(f.preset === 'YEAR' && f.year === y)}">${y}</button>`)}
                    <button type="button" class="chip" data-action="preset" data-preset="CUSTOM" aria-pressed="${String(f.preset === 'CUSTOM')}">Personnalisé…</button>
                    ${f.preset === 'CUSTOM' ? html`
                        <label class="sr-only" for="dash-from">Du</label><input id="dash-from" type="date" class="control sm" data-action="custom" data-bound="from" value="${f.from}">
                        <span aria-hidden="true">→</span>
                        <label class="sr-only" for="dash-to">Au</label><input id="dash-to" type="date" class="control sm" data-action="custom" data-bound="to" value="${f.to}">` : ''}
                    <span class="info">${info}</span>
                </div>
            </section>
            <div class="grid-kpi mt-4">
                <div class="tile c-accent"><span class="tile-label">Total heures</span><span class="tile-value">${minsToHM(total)}</span></div>
                <div class="tile c-warn"><span class="tile-label">Affaires</span><span class="tile-value">${affaires.length}</span><span class="tile-sub">dossier${affaires.length > 1 ? 's' : ''}</span></div>
                <div class="tile c-ok"><span class="tile-label">Saisies</span><span class="tile-value">${entries.length}</span><span class="tile-sub">${dates.length} jour${dates.length > 1 ? 's' : ''}</span></div>
                <div class="tile pal-5"><span class="tile-label">Période</span><span class="tile-value tile-value-sm">${dates[0] ? fmtShort(dates[0]) : '—'}</span><span class="tile-sub">${dates.length ? '→ ' + fmtShort(dates[dates.length - 1]) : '—'}</span></div>
            </div>
            <section class="panel mt-4" aria-labelledby="h-rep">
                <div class="panel-head"><h2 id="h-rep" class="panel-title">Répartition globale</h2></div>
                <div class="dash-split">
                    <div class="pie-block">
                        ${pie(pieData, { size: 220, scope: 'g', center: minsToHM(total), sub: 'TOTAL', label: 'Répartition des heures par type' })}
                        <ul class="legend" aria-label="Légende">${pieData.map((d, i) => html`
                            <li class="legend-item ${d.cls}" data-lk="g-${i}"><span class="dot"></span><span class="legend-label">${d.label}</span>
                                <span class="legend-pct">${Math.round(d.mins / total * 100)} %</span><span class="legend-hm">${minsToHM(d.mins)}</span></li>`)}</ul>
                    </div>
                    ${prodBox(affaires, all)}
                </div>
            </section>
            <section class="panel" aria-labelledby="h-affs">
                <div class="panel-head"><h2 id="h-affs" class="panel-title">Toutes les affaires</h2>
                    <a class="btn btn-ghost btn-sm" href="#/suivi/affaires">+ Nouvelle affaire</a></div>
                ${affaires.length ? html`<div class="aff-grid">${affaires.map(a => {
                    const tot = entries.filter(e => e.affaireId === a.id).reduce((s, e) => s + e.minutes, 0);
                    return html`<button type="button" class="aff-card" data-action="open" data-id="${a.id}">
                        <span class="aff-num">${a.num || '(sans N°)'}</span>
                        <span class="aff-client">${a.client || '(sans client)'}${a.machine ? html` · <span class="accent">${a.machine}</span>` : ''}</span>
                        <span class="aff-total">${tot ? minsToHM(tot) : '—'}</span>
                        ${budgetBar(tot, a.budgets)}
                    </button>`;
                })}</div>` : html`<p class="empty">Aucune affaire — <a href="#/suivi/affaires">crée ta première affaire</a>.</p>`}
            </section>`);
    }

    /** Encart « temps productif » + répartition par machine. */
    function prodBox(affaires, entries) {
        const mon = addDays(mondayOf(todayISO()), prodOffset * 7), days = workWeek(mon), fri = days[4];
        let workMin = days.reduce((s, iso) => { const d = store.getDay(iso); return s + (d ? d.h * 60 + d.m : 0); }, 0);
        const unbilled = new Set(affaires.filter(a => a.unbilled).map(a => a.id));
        const productive = new Set(affaires.filter(a => a.productive).map(a => a.id));
        const wk = entries.filter(e => e.date >= mon && e.date <= fri);
        const counted = wk.filter(e => !unbilled.has(e.affaireId));
        const unbilledMin = wk.filter(e => unbilled.has(e.affaireId)).reduce((s, e) => s + e.minutes, 0);
        workMin = workMin === 0 ? counted.reduce((s, e) => s + e.minutes, 0) : Math.max(0, workMin - unbilledMin);
        const prodMin = counted.filter(e => productive.has(e.affaireId)).reduce((s, e) => s + e.minutes, 0);
        const pct = workMin > 0 ? Math.round(prodMin / workMin * 100) : 0;
        const cls = pct >= 70 ? 'c-ok' : pct >= 50 ? 'c-warn' : 'c-danger';
        const label = prodOffset === 0 ? 'Semaine en cours' : prodOffset === -1 ? 'Semaine dernière' : 'Il y a ' + (-prodOffset) + ' semaines';

        // Machines (toutes périodes)
        const byId = new Map(affaires.map(a => [a.id, a]));
        const mach = {};
        entries.forEach(e => { const m = byId.get(e.affaireId)?.machine?.trim(); if (m) mach[m] = (mach[m] || 0) + e.minutes; });
        const machList = Object.entries(mach).sort((a, b) => b[1] - a[1]).map(([label, mins], i) => ({ key: 'm' + i, label, mins, cls: 'pal-' + (i % 10) }));
        const machTot = machList.reduce((s, d) => s + d.mins, 0);

        return html`
            <aside class="prod ${cls}" aria-labelledby="h-prod">
                <div class="prod-head">
                    <h3 id="h-prod" class="label">Temps productif</h3>
                    <button type="button" class="btn-icon" data-action="prod" data-dir="-1" aria-label="Semaine précédente">‹</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="prod" data-dir="0" ${prodOffset === 0 ? 'disabled' : ''}>Auj.</button>
                    <button type="button" class="btn-icon" data-action="prod" data-dir="1" aria-label="Semaine suivante" ${prodOffset >= 0 ? 'disabled' : ''}>›</button>
                </div>
                <p class="tile-sub">Sem. ${isoWeek(mon)} · ${fmtShort(mon)} → ${fmtShort(fri)}</p>
                ${workMin === 0 ? html`<p class="empty">Aucun temps de travail renseigné pour cette semaine</p>` : html`
                    <p class="prod-value">${pct} %</p>
                    <p class="tile-sub">${label}</p>
                    <svg class="bar" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect class="bar-bg" width="100" height="5"/><rect class="bar-fill" width="${Math.min(pct, 100)}" height="5"/></svg>
                    <div class="prod-split"><span>Productif<strong>${minsToHM(prodMin)}</strong></span><span class="num">Total<strong>${minsToHM(workMin)}</strong></span></div>`}
                ${machTot ? html`
                    <div class="machines">
                        <h3 class="label">Machines (total) · top : <span class="${machList[0].cls} legend-pct">${machList[0].label}</span></h3>
                        <div class="pie-block">
                            ${pie(machList, { size: 110, scope: 'm', center: Math.round(machList[0].mins / machTot * 100) + ' %', sub: 'TOP', label: 'Répartition par machine' })}
                            <ul class="legend legend-compact">${machList.slice(0, 4).map((d, i) => html`
                                <li class="legend-item ${d.cls}" data-lk="m-${i}"><span class="dot"></span><span class="legend-label">${d.label}</span><span class="legend-pct">${Math.round(d.mins / machTot * 100)} %</span><span></span></li>`)}
                                ${machList.length > 4 ? html`<li class="tile-sub">+ ${machList.length - 4} autre(s)</li>` : ''}</ul>
                        </div>
                    </div>` : ''}
            </aside>`;
    }

    on(el, 'click', {
        preset: b => setFilter(b.dataset.preset === 'ALL' ? { preset: 'ALL', year: null } : { preset: 'CUSTOM' }),
        year: b => setFilter({ preset: 'YEAR', year: b.dataset.year }),
        prod: b => { const d = +b.dataset.dir; prodOffset = d === 0 ? 0 : Math.min(0, prodOffset + d); draw(); },
        open: b => ctx.openAffaire(b.dataset.id)
    }, ac.signal);
    on(el, 'change', { custom: i => setFilter({ preset: 'CUSTOM', [i.dataset.bound]: i.value }) }, ac.signal);
    bindPieHover(el, ac.signal);

    draw();
    return {
        refresh: draw,
        destroy: () => ac.abort()
    };
}
