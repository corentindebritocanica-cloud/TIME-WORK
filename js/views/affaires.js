/**
 * Suivi — par affaire : création, recherche, et pour chaque affaire (accordéon <details>
 * dont le contenu n'est construit qu'à l'ouverture) : saisie d'heures, totaux par type,
 * saisies modifiables, répartition, réglages (code, client, machine, productif, Racks + codes GPAO, budgets).
 */
import { html, mount as render, on, $, $$, toElement } from '../ui/dom.js';
import { pie, bindPieHover } from '../ui/pie.js';
import { typeLabel, typeClass, typesFor, budgetAddable, inFamily, sortTypes, loadFamily, loadName, affLoadGroups, loadsOf, LOAD_FAMILIES, defaultType } from '../domain/types.js';
import { parseDuration, todayISO, fmtNum, minsToHM, minsToDec } from '../domain/time.js';
import { LOAD_RE, GPAO_RE, cleanLoadName } from '../domain/validate.js';
import { budgetBar, minutesByType, typeOptions } from './shared.js';
import { focus } from './suivi.js';
import { sortAffaires } from '../domain/sort.js';

/** Tris proposés (le choix est enregistré dans Firestore : settings.affSort, identique PC / iPhone). */
const SORTS = [['created', 'Création'], ['num', 'Code affaire'], ['client', 'Client'], ['machine', 'Machine']];

const openIds = new Set();     // affaires ouvertes (conservé entre deux rendus)
const olderOpen = new Set();   // affaires dont les saisies anciennes sont dépliées
const RECENT_ENTRIES = 4;      // saisies récentes toujours visibles ; les autres sont repliées
const extraBud = new Map();    // affaire → types « sans budget » ajoutés à la main dans ses budgets (session)
let query = '';

/**
 * @param {HTMLElement} el
 * @param {object} ctx
 */
export function create(el, ctx) {
    const ac = new AbortController();
    const { store } = ctx;
    let entriesByAff = new Map();

    function index() {
        entriesByAff = new Map();
        store.getEntries().forEach(e => { if (!entriesByAff.has(e.affaireId)) entriesByAff.set(e.affaireId, []); entriesByAff.get(e.affaireId).push(e); });
    }
    const entriesOf = id => (entriesByAff.get(id) || []).slice().sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt);
    const matches = a => !query || [a.num, a.client, a.machine].join(' ').toLowerCase().includes(query);

    /* ───────────── En-tête d'un accordéon ───────────── */
    function head(a) {
        const tot = entriesOf(a.id).reduce((s, e) => s + e.minutes, 0);
        const budgetMin = Object.values(a.budgets).reduce((s, h) => s + h * 60, 0);
        return html`
            <summary class="acc-head">
                <div class="acc-title">
                    <strong>${a.num || '(sans N°)'}</strong>
                    <span>${a.client || '(sans client)'}${a.machine ? ' · ' + a.machine : ''}</span>
                </div>
                <div class="acc-meta aff-budget">
                    <span class="acc-total ${budgetMin && tot > budgetMin ? 'is-over' : ''}">${minsToHM(tot)}</span>
                    ${budgetBar(tot, a.budgets, '/')}
                </div>
            </summary>`;
    }

    /* ───────────── Contenu d'un accordéon ───────────── */
    const entryRow = a => e => html`
        <tr data-entry="${e.id}">
            <td class="nowrap">${fmtNum(e.date)}</td>
            <td><select class="control sm entry-type" data-action="entry-type" aria-label="Type de la saisie du ${fmtNum(e.date)}">${typeOptions(a, e.type)}</select></td>
            <td><input class="control sm num entry-time" data-action="entry-time" value="${minsToHM(e.minutes)}" data-prev="${minsToHM(e.minutes)}" aria-label="Durée de la saisie du ${fmtNum(e.date)}"></td>
            <td><button type="button" class="btn-icon danger" data-action="del-entry" aria-label="Supprimer la saisie du ${fmtNum(e.date)}">✕</button></td>
        </tr>`;

    function body(a) {
        const ae = entriesOf(a.id);
        const tot = ae.reduce((s, e) => s + e.minutes, 0);
        const mpt = minutesByType(ae);
        const types = sortTypes(Object.keys(mpt));
        const bud = a.budgets;
        const groups = affLoadGroups(a);
        /** Cumul d'une famille (CD / MEP) : temps et budget de tous ses types ; remplace leurs tuiles (détail en info-bulle). */
        const sumFam = (obj, fam) => Object.entries(obj).reduce((s, [k, v]) => inFamily(k, fam) ? s + v : s, 0);
        const famTotals = new Map(groups.map(g => [g.fam, { min: sumFam(mpt, g.fam), bud: sumFam(bud, g.fam) }]));
        const famOfType = t => groups.find(g => inFamily(t, g.fam))?.fam;
        const shownFam = new Set();
        const pieData = types.map(t => ({ key: t, label: typeLabel(t), mins: mpt[t], cls: typeClass(t) }));
        const scope = 'a' + a.id.replace(/[^A-Za-z0-9]/g, '');
        const sigmaTile = fam => {
            const ft = famTotals.get(fam), id = `pop-${scope}-${fam}`, over = ft.bud && ft.min > ft.bud * 60;
            const members = sortTypes([...new Set([...Object.keys(mpt), ...Object.keys(bud)])].filter(k => inFamily(k, fam)));
            return html`<div class="tile t-${fam} is-derived has-pop" tabindex="0" aria-describedby="${id}">
                <span class="tile-label">Σ Racks ${fam}</span><span class="tile-value">${minsToHM(ft.min)}</span>
                <span class="tile-sub ${over ? 'danger' : ''}">${ft.bud ? Math.round(ft.min / (ft.bud * 60) * 100) + ' % / ' + ft.bud + ' h' : 'cumul des types ' + fam}</span>
                <div class="tile-pop" id="${id}" popover="manual" role="tooltip">
                    <div class="pop-row pop-head"><span>Type ${fam}</span><span>Utilisé</span><span>Budget</span></div>
                    ${members.map(k => { const m = mpt[k] || 0, b = bud[k] || 0; return html`
                    <div class="pop-row"><span class="pop-type"><span class="dot ${typeClass(k)}" aria-hidden="true"></span>${typeLabel(k)}</span>
                        <span class="num ${b && m > b * 60 ? 'danger' : ''}">${minsToHM(m)}</span><span class="num">${b ? b + ' h' : '—'}</span></div>`; })}
                </div></div>`;
        };
        return html`
            <div class="acc-body">
                <form class="entry-form" data-role="entry-form" novalidate>
                    <div class="field-row">
                        <label class="field"><span>Date</span><input type="date" class="control" name="date" value="${todayISO()}" required></label>
                        <label class="field"><span>Type</span><select class="control" name="type">${typeOptions(a, defaultType())}</select></label>
                        <label class="field"><span>Durée</span>
                            <input class="control num w-sm" name="time" placeholder="ex : 2:30" maxlength="6" autocomplete="off" data-action="hint" aria-describedby="hint-${a.id}">
                            <small class="field-hint" id="hint-${a.id}" aria-live="polite"></small></label>
                        <button type="submit" class="btn btn-primary">+ Ajouter</button>
                    </div>
                </form>
                ${tot ? html`<div class="type-tiles">
                    ${types.map(t => { const fam = famOfType(t); if (fam) { if (shownFam.has(fam)) return ''; shownFam.add(fam); return sigmaTile(fam); }
                        const over = bud[t] > 0 && mpt[t] > bud[t] * 60, f = loadFamily(t); return html`
                        <div class="tile ${typeClass(t)} ${f ? 'is-load' : ''}"><span class="tile-label">${typeLabel(t)}</span><span class="tile-value">${minsToHM(mpt[t])}</span>
                            ${f && a.gpao[loadName(t)] ? html`<span class="tile-sub" title="Code GPAO">GPAO ${a.gpao[loadName(t)]}</span>` : ''}
                            ${bud[t] ? html`<span class="tile-sub ${over ? 'danger' : ''}">${Math.round(mpt[t] / (bud[t] * 60) * 100)} % / ${bud[t]} h</span>` : ''}</div>`; })}
                    <div class="tile is-accent c-accent"><span class="tile-label">Total</span><span class="tile-value">${minsToHM(tot)}</span></div>
                </div>` : ''}
                <div class="aff-content">
                    <div class="table-wrap">
                        <table class="table">
                            <caption class="sr-only">Saisies de l'affaire ${a.num || a.client}</caption>
                            <thead><tr><th>Date</th><th>Type</th><th>Temps</th><th><span class="sr-only">Actions</span></th></tr></thead>
                            <tbody>${ae.length ? ae.slice(0, RECENT_ENTRIES).map(entryRow(a)) : html`<tr><td colspan="4" class="empty">Aucune saisie pour cette affaire</td></tr>`}</tbody>
                            ${ae.length > RECENT_ENTRIES ? html`
                            <tbody><tr><td colspan="4" class="more-cell">
                                <button type="button" class="more-toggle" data-action="more-entries" aria-expanded="${String(olderOpen.has(a.id))}" aria-controls="more-${a.id}">
                                    <span class="chev" aria-hidden="true">▸</span>${ae.length - RECENT_ENTRIES} saisie${ae.length - RECENT_ENTRIES > 1 ? 's' : ''} plus ancienne${ae.length - RECENT_ENTRIES > 1 ? 's' : ''}</button></td></tr></tbody>
                            <tbody id="more-${a.id}" ${olderOpen.has(a.id) ? '' : 'hidden'}>${ae.slice(RECENT_ENTRIES).map(entryRow(a))}</tbody>` : ''}
                        </table>
                    </div>
                    ${tot ? html`<div class="pie-block">
                        ${pie(pieData, { size: 170, scope, center: minsToHM(tot), sub: 'TOTAL', label: 'Répartition par type' })}
                        <ul class="legend">${pieData.map((d, i) => {
                            const b = bud[d.key] || 0, pct = b ? Math.round(d.mins / (b * 60) * 100) : 0;
                            return html`<li class="legend-item ${d.cls}" data-lk="${scope}-${i}"><span class="dot"></span><span class="legend-label">${d.label}</span>
                                <span class="legend-pct">${Math.round(d.mins / tot * 100)} %</span>
                                <span class="legend-hm">${minsToHM(d.mins)}${b ? html` · <span class="${pct > 100 ? 'danger' : pct > 80 ? 'c-warn legend-pct' : 'ok'}">${pct} % / ${b} h</span>` : ''}</span></li>`;
                        })}</ul></div>` : ''}
                </div>
                <div class="aff-settings">
                    <div class="settings-grid">
                        <label class="field"><span>Code affaire</span><input class="control" data-action="aff-field" data-field="num" value="${a.num}"></label>
                        <label class="field"><span>Client</span><input class="control" data-action="aff-field" data-field="client" value="${a.client}" list="clients"></label>
                        <label class="field"><span>Machine</span><input class="control" data-action="aff-field" data-field="machine" value="${a.machine}"></label>
                        <label class="check"><input type="checkbox" data-action="aff-flag" data-flag="productive" ${a.productive ? 'checked' : ''}> Temps productif</label>
                        <label class="check" title="Les heures de cette affaire ne comptent pas dans la semaine de travail"><input type="checkbox" data-action="aff-flag" data-flag="unbilled" ${a.unbilled ? 'checked' : ''}> Temps non comptabilisé</label>
                    </div>
                    ${budgetBlock(a)}
                    <div class="toolbar"><button type="button" class="btn btn-ghost btn-sm danger" data-action="del-aff">Supprimer l'affaire…</button></div>
                </div>
            </div>`;
    }

    /** Budgets, Racks et codes GPAO réunis dans UN tableau : une ligne par type, colonnes alignées (type · GPAO · budget · action). */
    function budgetBlock(a) {
        const bud = a.budgets;
        const list = sortTypes([...typesFor(a), ...(extraBud.get(a.id) || [])]);
        const hasRacks = list.some(t => loadFamily(t));
        const addedFam = new Set();
        const budInput = t => html`<input type="number" class="control sm num c-bud" min="0" step="1" placeholder="—" data-action="budget" data-type="${t}" value="${bud[t] || ''}" aria-label="Budget ${typeLabel(t)} (heures)">`;
        const addRow = f => { addedFam.add(f.fam); return html`
            <div class="bud-add loads" data-fam="${f.fam}" role="group" aria-label="Ajouter un Rack ${f.fam}">
                <input class="control sm w-sm" data-action="load-input" placeholder="N° Rack" maxlength="3" inputmode="numeric" aria-label="Numéro du nouveau Rack ${f.fam}">
                <button type="button" class="btn btn-ghost btn-sm" data-action="add-load">+ Rack ${f.fam}</button>
            </div>`; };
        const rows = list.map((t, i) => {
            const rf = loadFamily(t), fam = rf || LOAD_FAMILIES.find(f => f.fam === t);
            const l = rf ? loadName(t) : '';
            const row = rf ? html`
                <div class="bud-row is-rack" data-fam="${rf.fam}">
                    <span class="badge c-name ${typeClass(t)}">${typeLabel(t)}</span>
                    <input class="control sm c-gpao" data-action="gpao" data-rack="${l}" value="${a.gpao[l] || ''}" placeholder="Code GPAO" maxlength="30" autocomplete="off" aria-label="Code GPAO du Rack ${l}">
                    ${budInput(t)}
                    <button type="button" class="btn-icon danger c-act" data-action="del-load" data-load="${l}" aria-label="Supprimer le Rack ${rf.fam} ${l}" title="Supprimer ce Rack">✕</button>
                </div>` : html`
                <div class="bud-row">
                    <span class="badge c-name ${typeClass(t)}">${typeLabel(t)}</span><span class="c-gpao"></span>${budInput(t)}<span class="c-act"></span>
                </div>`;
            const nextIsRack = fam && loadFamily(list[i + 1])?.fam === fam.fam;
            return html`${row}${fam && !nextIsRack && !addedFam.has(fam.fam) ? addRow(fam) : ''}`;
        });
        const rest = LOAD_FAMILIES.filter(f => !addedFam.has(f.fam)).map(addRow);
        const extra = extraBud.get(a.id) || new Set(), opts = budgetAddable(a).filter(t => !extra.has(t.code));
        return html`
                    <section class="bud" aria-label="Budgets, Racks et codes GPAO">
                        <div class="bud-head"><h3 class="label">Budgets &amp; Racks</h3>
                            <span class="bud-hint">Heures allouées par type · un Rack = budget + code GPAO (commun à CD et MEP)</span></div>
                        <div class="bud-table">
                            <div class="bud-row bud-cols" aria-hidden="true"><span class="c-name"></span><span class="c-gpao">${hasRacks ? 'GPAO' : ''}</span><span class="c-bud">Budget (h)</span><span class="c-act"></span></div>
                            ${rows}${rest}
                        </div>
                        ${opts.length ? html`
                        <select class="control sm w-lg budget-add" data-action="budget-add" aria-label="Ajouter un type au budget de cette affaire">
                            <option value="">+ Ajouter un type…</option>
                            ${opts.map(t => html`<option value="${t.code}">${t.label}</option>`)}
                        </select>` : ''}
                    </section>`;
    }

    const item = a => html`<details class="acc" id="aff-${a.id}" data-id="${a.id}" ${openIds.has(a.id) ? 'open' : ''} ${matches(a) ? '' : 'hidden'}>
        ${head(a)}${openIds.has(a.id) ? body(a) : ''}</details>`;

    /* ───────────── Rendu ───────────── */
    function draw() {
        index();
        const sort = { by: 'created', dir: 'asc', ...(store.getSettings().affSort || {}) };
        const affaires = sortAffaires(store.getAffaires(), sort);
        if (focus.affaireId) openIds.add(focus.affaireId);
        const clients = [...new Set(affaires.map(a => a.client).filter(Boolean))];
        render(el, html`
            <section class="panel" aria-labelledby="h-new">
                <div class="panel-head"><h2 id="h-new" class="panel-title">Nouvelle affaire</h2></div>
                <form class="field-row" data-role="new-aff" novalidate>
                    <label class="field"><span>Client</span><input class="control w-md" name="client" placeholder="Nom du client" list="clients"></label>
                    <label class="field"><span>Code affaire</span><input class="control w-md" name="num" placeholder="Ex : AF-2026-001"></label>
                    <label class="field"><span>Machine</span><input class="control w-sm" name="machine" placeholder="Ex : M-001"></label>
                    <label class="field"><span>Racks CD (optionnel)</span><input class="control w-sm" name="loads" placeholder="Ex : 1, 2, 3"></label>
                    <label class="field"><span>Racks MEP (optionnel)</span><input class="control w-sm" name="mepLoads" placeholder="Ex : 1, 2"></label>
                    <button type="submit" class="btn btn-primary">+ Créer</button>
                    <small class="field-hint err" data-role="new-err" role="alert"></small>
                </form>
                <datalist id="clients">${clients.map(c => html`<option value="${c}"></option>`)}</datalist>
            </section>
            <div class="toolbar mt-4">
                <label class="sr-only" for="aff-search">Filtrer les affaires</label>
                <input id="aff-search" type="search" class="control search" data-action="search" placeholder="Filtrer les affaires (code, client, machine)…" value="${query}">
            </div>
            <div class="filter-bar mt-4" role="group" aria-label="Trier les affaires">
                <span class="label">Trier par</span>
                ${SORTS.map(([k, label]) => {
                    const on = sort.by === k, arrow = on && k !== 'created' ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '';
                    return html`<button type="button" class="chip" data-action="sort" data-sort="${k}" aria-pressed="${String(on)}"
                        title="${on && k !== 'created' ? 'Cliquer pour inverser l\'ordre' : 'Trier par ' + label.toLowerCase()}">${label}${arrow}</button>`;
                })}
            </div>
            <div class="mt-4" data-role="list">
                ${affaires.length ? affaires.map(item) : html`<p class="empty">Aucune affaire — crée-en une ci-dessus.</p>`}
            </div>`);
        if (focus.affaireId) {
            const d = $('#aff-' + CSS.escape(focus.affaireId), el);
            const row = focus.entryId && d && $('tr[data-entry="' + CSS.escape(focus.entryId) + '"]', d);
            focus.affaireId = focus.entryId = null;
            if (d) d.hidden = false;
            if (row) {          // venu des Imputées : saisie au centre, surlignée, type prêt à changer
                requestAnimationFrame(() => {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.classList.add('is-cible');
                    row.addEventListener('animationend', () => row.classList.remove('is-cible'), { once: true });
                    $('.entry-type', row)?.focus({ preventScroll: true });
                });
            } else if (d) requestAnimationFrame(() => d.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    }

    /** Re-rend une seule affaire (en conservant son état ouvert). */
    function redrawOne(id) {
        index();
        const a = store.getAffaires().find(x => x.id === id);
        const old = $('#aff-' + CSS.escape(id), el);
        if (!old) return draw();
        if (!a) { old.remove(); return; }
        old.replaceWith(toElement(item(a)));
    }

    const affOf = node => { const d = node.closest('details.acc'); return d && store.getAffaires().find(a => a.id === d.dataset.id); };

    /* ───────────── Actions ───────────── */
    async function deleteAffaire(btn, ev) {
        const a = affOf(btn); if (!a) return;
        const ents = entriesOf(a.id);
        if (!await ctx.confirmAction('Supprimer l\'affaire ?',
            `« ${a.num || a.client} » et ses ${ents.length} saisie(s) seront supprimées sur tous les postes.`, 'Supprimer', true)) return;
        store.deleteAffaire(a.id);
        openIds.delete(a.id);
        draw();
        ctx.toast('Affaire supprimée.', { action: { label: 'Annuler', run: () => { store.restore({ affaires: [a], entries: ents }); draw(); } } });
    }

    function addEntry(form) {
        const a = affOf(form); if (!a) return;
        const f = new FormData(form);
        const timeEl = form.elements.time, hint = $('.field-hint', form);
        const date = f.get('date');
        if (!date) { form.elements.date.classList.add('is-invalid'); form.elements.date.focus(); return; }
        const r = parseDuration(f.get('time'));
        if ('error' in r) { showHint(timeEl, hint, r.error, true); timeEl.focus(); return; }
        store.addEntry({ affaireId: a.id, date, type: f.get('type'), minutes: r.minutes });
        const keepType = f.get('type');
        redrawOne(a.id);
        const nf = $('#aff-' + CSS.escape(a.id) + ' [data-role="entry-form"]', el);
        nf.elements.type.value = keepType; nf.elements.date.value = date; nf.elements.time.focus();
        ctx.toast(`${minsToHM(r.minutes)} ajoutées (${typeLabel(keepType)}, ${fmtNum(date)}).`);
    }

    function showHint(input, hint, text, bad) {
        hint.textContent = text; hint.classList.toggle('err', bad);
        input.classList.toggle('is-invalid', bad);
        if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }

    function editTime(input) {
        const tr = input.closest('tr'), id = tr.dataset.entry;
        const r = parseDuration(input.value);
        if ('error' in r) {
            ctx.toast('Durée non modifiée — ' + r.error, { kind: 'error' });
            input.value = input.dataset.prev;
            input.classList.add('is-invalid'); setTimeout(() => input.classList.remove('is-invalid'), 2500);
            return;
        }
        if (minsToHM(r.minutes) === input.dataset.prev) { input.value = input.dataset.prev; return; }
        store.updateEntry(id, { minutes: r.minutes });
        ctx.toast('Durée mise à jour : ' + minsToHM(r.minutes));
        redrawOne(affOf(input).id);
    }

    function deleteEntry(btn) {
        const a = affOf(btn), id = btn.closest('tr').dataset.entry;
        const e = store.getEntries().find(x => x.id === id); if (!e) return;
        store.deleteEntry(id);
        redrawOne(a.id);
        ctx.toast(`Saisie du ${fmtNum(e.date)} supprimée (${minsToHM(e.minutes)}).`, { action: { label: 'Annuler', run: () => { store.restore({ entries: [e] }); redrawOne(a.id); } } });
    }

    function createAffaire(form) {
        const f = Object.fromEntries(new FormData(form));
        const err = $('[data-role="new-err"]', form);
        err.textContent = '';
        /** Racks saisis pour une famille (champ « 1, 2, 3 »), ou null si l'un est invalide (erreur affichée). */
        const parseLoads = (field, fam) => {
            const list = String(f[field] || '').split(',').map(cleanLoadName).filter(Boolean);
            const bad = list.filter(l => !LOAD_RE.test(l));
            form.elements[field].classList.toggle('is-invalid', bad.length > 0);
            if (!bad.length) return [...new Set(list)];
            err.textContent = `Rack ${fam} invalide : ${bad.join(', ')} (numéros 1 à 999).`;
            form.elements[field].focus();
            return null;
        };
        const loads = parseLoads('loads', 'CD'); if (!loads) return;
        const mepLoads = parseLoads('mepLoads', 'MEP'); if (!mepLoads) return;
        if (!f.client.trim() && !f.num.trim()) { err.textContent = 'Renseigne au moins un client ou un code affaire.'; form.elements.client.focus(); return; }
        const a = store.createAffaire({ client: f.client.trim(), num: f.num.trim(), machine: f.machine.trim(), loads, mepLoads, budgets: {}, productive: true });
        openIds.add(a.id); focus.affaireId = a.id;
        draw();
        ctx.toast(`Affaire « ${a.num || a.client} » créée.`);
        $('#aff-' + CSS.escape(a.id) + ' [name="time"]', el)?.focus();
    }

    /** Famille (CD, MEP) du groupe de Racks contenant l'élément. */
    const famOf = node => LOAD_FAMILIES.find(f => f.fam === node.closest('[data-fam]')?.dataset.fam) || LOAD_FAMILIES[0];

    function addLoad(btn) {
        const a = affOf(btn), f = famOf(btn), input = $('[data-action="load-input"]', btn.closest('.loads'));
        const l = cleanLoadName(input.value);
        if (!l) { input.focus(); return; }
        if (!LOAD_RE.test(l)) { ctx.toast('Rack invalide : numéro de 1 à 999.', { kind: 'error' }); input.classList.add('is-invalid'); input.focus(); return; }
        const cur = loadsOf(a, f.fam);
        if (cur.includes(l)) { ctx.toast(`Le Rack ${f.fam} ${l} existe déjà.`, { kind: 'error' }); return; }
        store.updateAffaire(a.id, { [f.field]: [...cur, l] });
        redrawOne(a.id);
        $('#aff-' + CSS.escape(a.id) + ` [data-fam="${f.fam}"] [data-action="load-input"]`, el)?.focus();
    }

    async function delLoad(btn) {
        const a = affOf(btn), f = famOf(btn), l = btn.dataset.load;
        const n = entriesOf(a.id).filter(e => e.type === f.prefix + l).length;
        if (!await ctx.confirmAction(`Supprimer le Rack ${f.fam} ${l} ?`, `Son budget est supprimé${n ? ` et ses ${n} saisie(s) passent en « ${f.fam} »` : ''}.`, 'Supprimer', true)) return;
        store.removeLoad(a.id, l, f.fam);
        redrawOne(a.id);
    }

    /* ───────────── Événements (délégués) ───────────── */
    /** Tri : un clic choisit la clé ; un 2e clic sur la clé active inverse l'ordre (A→Z / Z→A). */
    function setSort(btn) {
        const cur = { by: 'created', dir: 'asc', ...(store.getSettings().affSort || {}) }, by = btn.dataset.sort;
        const dir = by === cur.by && by !== 'created' ? (cur.dir === 'asc' ? 'desc' : 'asc') : 'asc';
        store.setSettings({ affSort: { by, dir } });
        draw();
        $(`[data-action="sort"][data-sort="${by}"]`, el)?.focus();
    }

    function toggleOlder(btn) {
        const a = affOf(btn); if (!a) return;
        const open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        const tb = $('#more-' + CSS.escape(a.id), el); if (tb) tb.hidden = !open;
        if (open) olderOpen.add(a.id); else olderOpen.delete(a.id);
    }

    on(el, 'click', { 'more-entries': toggleOlder, sort: setSort, 'del-aff': deleteAffaire, 'del-entry': deleteEntry, 'add-load': addLoad, 'del-load': delLoad }, ac.signal);
    el.addEventListener('submit', ev => {
        ev.preventDefault();
        if (ev.target.dataset.role === 'new-aff') createAffaire(ev.target);
        else if (ev.target.dataset.role === 'entry-form') addEntry(ev.target);
    }, { signal: ac.signal });
    on(el, 'input', {
        search: i => { query = i.value.trim().toLowerCase(); $$('details.acc', el).forEach(d => { d.hidden = !matches(store.getAffaires().find(a => a.id === d.dataset.id) || {}); }); },
        hint: i => {
            const hint = $('.field-hint', i.closest('.field')); const v = i.value.trim();
            if (!v) return showHint(i, hint, '', false);
            const r = parseDuration(v);
            showHint(i, hint, 'error' in r ? r.error : '= ' + minsToHM(r.minutes) + ' (' + minsToDec(r.minutes) + ' déc.)', 'error' in r);
        }
    }, ac.signal);
    on(el, 'change', {
        'entry-type': s => { store.updateEntry(s.closest('tr').dataset.entry, { type: s.value }); redrawOne(affOf(s).id); },
        'entry-time': editTime,
        'aff-field': i => { const a = affOf(i); if (a[i.dataset.field] === i.value.trim()) return; store.updateAffaire(a.id, { [i.dataset.field]: i.value.trim() }); redrawOne(a.id); ctx.toast('Affaire mise à jour.'); },
        gpao: i => {
            const a = affOf(i), rack = i.dataset.rack, v = i.value.trim(), gpao = { ...a.gpao };
            if (v && !GPAO_RE.test(v)) { ctx.toast('Code GPAO invalide (lettres, chiffres, . _ - ; 30 caractères max).', { kind: 'error' }); i.classList.add('is-invalid'); i.focus(); return; }
            if ((gpao[rack] || '') === v) return;
            if (v) gpao[rack] = v; else delete gpao[rack];
            store.updateAffaire(a.id, { gpao }); redrawOne(a.id); ctx.toast(`Code GPAO du Rack ${rack} enregistré.`);
        },
        'aff-flag': c => {
            const a = affOf(c), flag = c.dataset.flag, other = flag === 'productive' ? 'unbilled' : 'productive';
            store.updateAffaire(a.id, c.checked ? { [flag]: true, [other]: false } : { [flag]: false }); redrawOne(a.id);
        },
        'budget-add': s => {
            const a = affOf(s), code = s.value;
            if (!a || !code) return;
            if (!extraBud.has(a.id)) extraBud.set(a.id, new Set());
            extraBud.get(a.id).add(code);
            redrawOne(a.id);
            $(`#aff-${CSS.escape(a.id)} [data-action="budget"][data-type="${CSS.escape(code)}"]`, el)?.focus();
        },
        budget: i => {
            const a = affOf(i), n = Math.max(0, Math.round(+i.value || 0)), budgets = { ...a.budgets };
            if (n > 0) budgets[i.dataset.type] = n; else delete budgets[i.dataset.type];
            store.updateAffaire(a.id, { budgets }); redrawOne(a.id);
        }
    }, ac.signal);
    on(el, 'keydown', {
        'entry-time': (i, e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } },
        gpao: (i, e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } },
        'load-input': (i, e) => { if (e.key === 'Enter') { e.preventDefault(); addLoad(i); } },
        budget: (i, e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } }
    }, ac.signal);
    // Construction paresseuse du contenu à l'ouverture
    el.addEventListener('toggle', ev => {
        const d = ev.target;
        if (!d.matches?.('details.acc')) return;
        if (d.open) {
            openIds.add(d.dataset.id);
            if (!$('.acc-body', d)) { const a = store.getAffaires().find(x => x.id === d.dataset.id); if (a) d.append(toElement(body(a))); }
        } else openIds.delete(d.dataset.id);
    }, { capture: true, signal: ac.signal });
    bindPieHover(el, ac.signal);

    /* Info-bulle des tuiles Σ (Popover API : hors du clipping des accordéons ; survol, focus clavier ou toucher) */
    const popOf = n => n instanceof Element ? n.closest('.has-pop') : null;
    function showPop(tile) {
        const pop = $('.tile-pop', tile);
        if (!pop || pop.matches(':popover-open')) return;
        pop.showPopover();
        const r = tile.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
        pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 8 - w)) + 'px';
        pop.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - 6 - h) : r.bottom + 6) + 'px';
    }
    const hidePop = tile => { const pop = $('.tile-pop', tile); if (pop?.matches(':popover-open')) pop.hidePopover(); };
    const enter = e => { const t = popOf(e.target); if (t && !t.contains(e.relatedTarget)) showPop(t); };
    const leave = e => { const t = popOf(e.target); if (t && !t.contains(e.relatedTarget)) hidePop(t); };
    el.addEventListener('pointerover', enter, { signal: ac.signal });
    el.addEventListener('pointerout', leave, { signal: ac.signal });
    el.addEventListener('focusin', enter, { signal: ac.signal });
    el.addEventListener('focusout', leave, { signal: ac.signal });
    addEventListener('scroll', () => $$('.tile-pop:popover-open', el).forEach(p => p.hidePopover()), { capture: true, passive: true, signal: ac.signal });

    draw();
    return {
        refresh: draw,
        destroy: () => ac.abort()
    };
}
