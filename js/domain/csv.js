/**
 * Import d'historique CSV (fonctions pures).
 * Format : CLIENT ; DATE ; HEURES ; CODE_AFFAIRE ; TYPE  (séparateur « ; » ou « , »)
 * Dates : jj/mm/aaaa, jj-mm-aaaa, aaaa-mm-jj — Heures : décimales (0,5 = 30 min).
 */
import { findTypeByName, normLabel } from './types.js';
export { normLabel };

const ALIASES = {
    VERIF: 'VERIFICATION', VERIFS: 'VERIFICATION',
    DE_NON_PROD: 'DE_NP', DE_NONPROD: 'DE_NP', ECA_NON_PROD: 'ECA_NP', ECA_NONPROD: 'ECA_NP',
    DE_COMPLEMENT: 'DE_COMP', COMPLEMENT_DE: 'DE_COMP', COMPLEMENT: 'DE_COMP',
    ECA_REPRISE: 'ECA_REP', REPRISE_ECA: 'ECA_REP', REPRISE: 'ECA_REP', CD_REPRISE: 'CD_REP', REPRISE_CD: 'CD_REP',
    REVIEW: 'REVIEW_ECA', REV_ECA: 'REVIEW_ECA', REV_CD: 'REVIEW_CD',
    CONCEPTION_3D: 'CONCEPTION3D', CONCEP3D: 'CONCEPTION3D', CONCEPTION_3D_RELEVE: 'CONCEP3D_REL', CONCEP_3D_REL: 'CONCEP3D_REL',
    MISSION: 'MISSION_RELEVE', MISSION_REL: 'MISSION_RELEVE', RELEVE: 'MISSION_RELEVE',
    PREPARATION_MISSION: 'PREP_MISSION', PREP: 'PREP_MISSION', SIGNOFF: 'SIGN_OFF', SIGN: 'SIGN_OFF',
    REUNIONS: 'REUNION', MEETING: 'REUNION', FORMATIONS: 'FORMATION'
};

/** Type CSV → code interne (code ou libellé, types personnalisés compris) ; '' → AUTRE ; inconnu → null. */
export function mapType(raw) {
    const n = normLabel(raw);
    if (!n) return 'AUTRE';
    return findTypeByName(n) || ALIASES[n] || null;
}

/** Date CSV → « AAAA-MM-JJ » ou null. */
export function parseDate(raw) {
    const s = String(raw ?? '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
        let y = m[3]; if (y.length === 2) y = (parseInt(y, 10) > 50 ? '19' : '20') + y;
        return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    return null;
}

/** Heures décimales → minutes (> 0) ou null. */
export function parseHours(raw) {
    const n = parseFloat(String(raw ?? '').trim().replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}

/** Découpe un CSV (guillemets gérés, BOM retiré, lignes vides ignorées). */
export function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/).find(l => l.trim()) || '';
    const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQ) {
            if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') inQ = false;
            else cur += c;
        } else if (c === '"') inQ = true;
        else if (c === sep) { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c !== '\r') cur += c;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(v => (v || '').trim() !== ''));
}

/**
 * Analyse un CSV par rapport aux données existantes.
 * @param {string} text
 * @param {{id:string, client:string, num:string}[]} affaires
 * @param {{affaireId:string, date:string, type:string, minutes:number}[]} entries
 * @returns {{newEntries: object[], newAffaires: object[], errors: string[], unknownTypes: string[], duplicates: number, total: number}}
 */
export function analyzeCSV(text, affaires, entries) {
    const rows = parseCSV(text);
    const res = { newEntries: [], newAffaires: [], errors: [], unknownTypes: [], duplicates: 0, total: 0 };
    if (rows.length < 2) { res.errors.push('CSV vide ou sans données.'); return res; }
    const header = rows[0].map(normLabel);
    const col = (test, def) => { const i = header.findIndex(test); return i >= 0 ? i : def; };
    const map = {
        c: col(h => h.startsWith('CLIENT'), 0),
        d: col(h => h.startsWith('DATE'), 1),
        h: col(h => h.startsWith('HEURE') || h.startsWith('H_DEC') || h.startsWith('DUREE'), 2),
        n: col(h => h.startsWith('CODE') || h.includes('AFFAIRE'), 3),
        t: col(h => h.startsWith('TYPE') || h.includes('TRAVAIL'), 4)
    };
    // saisies existantes (multi-ensemble date|affaire|type|minutes)
    const existing = new Map();
    entries.forEach(e => { const k = e.date + '|' + e.affaireId + '|' + e.type + '|' + e.minutes; existing.set(k, (existing.get(k) || 0) + 1); });
    const findAff = (client, num) => {
        const cU = client.toUpperCase(), nU = num.toUpperCase();
        if (nU) { const a = affaires.find(x => (x.num || '').toUpperCase() === nU); if (a) return a; }
        if (cU && !nU) { const a = affaires.find(x => (x.client || '').toUpperCase() === cU && !(x.num || '').trim()); if (a) return a; }
        return null;
    };
    const newAff = new Map();
    const unknown = new Set();
    rows.slice(1).forEach((r, idx) => {
        const line = idx + 2;
        const client = (r[map.c] || '').trim(), codeAff = (r[map.n] || '').trim();
        const dateRaw = (r[map.d] || '').trim(), hoursRaw = (r[map.h] || '').trim(), typeRaw = (r[map.t] || '').trim();
        if (!client && !codeAff) { res.errors.push('L.' + line + ' : ni client ni code affaire'); return; }
        const date = parseDate(dateRaw);
        if (!date) { res.errors.push('L.' + line + ' : date invalide « ' + dateRaw + ' »'); return; }
        const minutes = parseHours(hoursRaw);
        if (!minutes) { res.errors.push('L.' + line + ' : heures invalides « ' + hoursRaw + ' »'); return; }
        let type = mapType(typeRaw);
        if (type === null) { unknown.add(typeRaw); type = 'AUTRE'; }
        const aff = findAff(client, codeAff);
        const entry = { date, type, minutes, client, codeAff, line };
        if (aff) {
            const k = date + '|' + aff.id + '|' + type + '|' + minutes;
            const left = existing.get(k) || 0;
            if (left > 0) { existing.set(k, left - 1); res.duplicates++; return; }
            entry.affaireId = aff.id;
        } else {
            const key = codeAff.toUpperCase() + '||' + client.toUpperCase();
            if (!newAff.has(key)) newAff.set(key, { tempId: 'new_' + newAff.size, client, num: codeAff, machine: '', loads: [], mepLoads: [], budgets: {} });
            entry.tempAffId = newAff.get(key).tempId;
        }
        res.newEntries.push(entry);
    });
    res.newAffaires = [...newAff.values()];
    res.unknownTypes = [...unknown];
    res.total = res.newEntries.reduce((s, e) => s + e.minutes, 0);
    return res;
}
