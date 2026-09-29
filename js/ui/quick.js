/**
 * Saisie rapide (Ctrl+K) : affaire → type → date → durée → Entrée.
 */
import { html, mount as render, $ } from './dom.js';
import { TYPES, typeLabel, loadType } from '../domain/types.js';
import { parseDuration, todayISO, fmtNum, minsToHM, minsToDec } from '../domain/time.js';

let last = { affaireId: null, type: 'DE' };

const affLabel = a => [a.num || '(sans N°)', a.client, a.machine].filter(Boolean).join(' — ');

/**
 * Ouvre la saisie rapide.
 * @param {object} ctx contexte de l'app
 * @returns {Promise<boolean>} true si une saisie a été ajoutée
 */
export async function quickEntry(ctx) {
    const { store } = ctx;
    const affaires = store.getAffaires();
    if (!affaires.length) {
        await ctx.inform('Aucune affaire', 'Crée d\'abord une affaire dans Suivi projet → Par affaire.');
        ctx.nav('#/suivi/affaires');
        return false;
    }
    const byLabel = new Map(affaires.map(a => [affLabel(a).toLowerCase(), a]));
    const prev = affaires.find(a => a.id === last.affaireId);
    let added = null;

    const typeOpts = (aff, sel) => html`${TYPES.map(t => html`<option value="${t.code}" ${t.code === sel ? 'selected' : ''}>${t.label}</option>`)}
        ${aff?.loads.length ? html`<optgroup label="Loads CD">${aff.loads.map(l => html`<option value="${loadType(l)}" ${loadType(l) === sel ? 'selected' : ''}>CD Load ${l}</option>`)}</optgroup>` : ''}`;

    /** Affaire correspondant au texte saisi (libellé exact, ou recherche unique). */
    function resolve(text) {
        const q = text.trim().toLowerCase();
        if (!q) return { error: 'Choisis une affaire.' };
        if (byLabel.has(q)) return { aff: byLabel.get(q) };
        const hits = affaires.filter(a => [a.num, a.client, a.machine].join(' ').toLowerCase().includes(q));
        if (hits.length === 1) return { aff: hits[0] };
        return { error: hits.length ? `${hits.length} affaires correspondent : précise.` : 'Aucune affaire ne correspond.' };
    }

    const hint = (el, text, bad) => {
        const h = el.closest('.field').querySelector('.field-hint');
        h.textContent = text; h.classList.toggle('err', !!bad);
        el.classList.toggle('is-invalid', !!bad);
        if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    };

    const r = await ctx.ask({
        title: 'Saisie rapide', size: 'm',
        body: html`
            <div class="quick">
                <label class="field"><span>Affaire</span>
                    <input class="control" name="aff" list="qe-affs" autocomplete="off" placeholder="Code, client ou machine…"
                           value="${prev ? affLabel(prev) : ''}" ${prev ? '' : 'autofocus'}>
                    <small class="field-hint" aria-live="polite"></small></label>
                <datalist id="qe-affs">${affaires.map(a => html`<option value="${affLabel(a)}"></option>`)}</datalist>
                <div class="field-row">
                    <label class="field"><span>Type</span><select class="control" name="type">${typeOpts(prev, last.type)}</select></label>
                    <label class="field"><span>Date</span><input type="date" class="control" name="date" value="${todayISO()}"></label>
                    <label class="field"><span>Durée</span><input class="control num w-sm" name="time" placeholder="ex : 2:30" maxlength="6" autocomplete="off" ${prev ? 'autofocus' : ''}>
                        <small class="field-hint" aria-live="polite"></small></label>
                </div>
            </div>`,
        buttons: [{ id: 'add', label: 'Ajouter', kind: 'primary' }, { id: 'cancel', label: 'Annuler' }],
        onOpen(dlg, signal) {
            const aff = $('[name="aff"]', dlg), type = $('[name="type"]', dlg), time = $('[name="time"]', dlg);
            (prev ? time : aff).focus();
            aff.addEventListener('change', () => {
                const res = resolve(aff.value);
                if (res.aff) { aff.value = affLabel(res.aff); hint(aff, '', false); const t = type.value; render(type, typeOpts(res.aff, t)); }
            }, { signal });
            time.addEventListener('input', () => {
                const v = time.value.trim(); if (!v) return hint(time, '', false);
                const p = parseDuration(v);
                hint(time, 'error' in p ? p.error : '= ' + minsToHM(p.minutes) + ' (' + minsToDec(p.minutes) + ' déc.)', 'error' in p);
            }, { signal });
        },
        validate(_, dlg) {
            const aff = $('[name="aff"]', dlg), time = $('[name="time"]', dlg), date = $('[name="date"]', dlg), type = $('[name="type"]', dlg);
            const res = resolve(aff.value);
            if (res.error) { hint(aff, res.error, true); aff.focus(); return false; }
            const p = parseDuration(time.value);
            if ('error' in p) { hint(time, p.error, true); time.focus(); return false; }
            if (!date.value) { date.classList.add('is-invalid'); date.focus(); return false; }
            const validTypes = [...TYPES.map(t => t.code), ...res.aff.loads.map(loadType)];
            const t = validTypes.includes(type.value) ? type.value : 'DE';
            added = store.addEntry({ affaireId: res.aff.id, date: date.value, type: t, minutes: p.minutes });
            last = { affaireId: res.aff.id, type: t };
            added.aff = res.aff;
            return true;
        }
    });
    if (r !== 'add' || !added) return false;
    ctx.toast(`${minsToHM(added.minutes)} ajoutées sur ${added.aff.num || added.aff.client} (${typeLabel(added.type)}, ${fmtNum(added.date)}).`, {
        action: { label: 'Annuler', run: () => { store.deleteEntry(added.id); ctx.refresh(); } }
    });
    return true;
}
