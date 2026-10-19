/**
 * Validation des données importées (sauvegardes JSON, migration). Fonctions pures.
 */
/** Numéro de Rack (anciennement « Load ») : 1, 2, 3… */
export const LOAD_RE = /^[1-9][0-9]{0,2}$/;
/** Code GPAO d'un Rack. */
export const GPAO_RE = /^[A-Za-z0-9._-]{1,30}$/;
export const TYPE_RE = /^[A-Z0-9_]{1,40}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Identifiant valide (ancien : nombre ; nouveau : UUID) → chaîne, sinon null. */
export function normId(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    return (typeof v === 'string' && ID_RE.test(v)) ? v : null;
}

/** Numéro de Rack au format canonique (« Rack 1 », « rack_1 », « 1 » → « 1 »). */
export const cleanLoadName = raw => String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/^RACK_?/, '');

/** Ancien nom de Load (lettre A, B…) → numéro de Rack (1, 2…) ; un numéro reste inchangé. */
export const legacyRack = raw => { const n = cleanLoadName(raw); return /^[A-Z]$/.test(n) ? String(n.charCodeAt(0) - 64) : n; };

/** Ancien code de type (CD_LOAD_A, MEP_LOAD_B) → nouveau (CD_RACK_1, MEP_RACK_2) ; tout autre code inchangé. */
export const legacyTypeCode = code => {
    const m = /^(CD|MEP)_LOAD_([A-Z])$/.exec(String(code ?? ''));
    return m ? m[1] + '_RACK_' + (m[2].charCodeAt(0) - 64) : String(code ?? '');
};

/** Codes GPAO par Rack : { '1': '6007514603' } — numéros et codes invalides ignorés. */
export function cleanGpao(raw) {
    const out = {};
    if (raw && typeof raw === 'object') Object.entries(raw).forEach(([k, v]) => {
        const rack = legacyRack(k), code = String(v ?? '').trim();
        if (LOAD_RE.test(rack) && GPAO_RE.test(code)) out[rack] = code;
    });
    return out;
}

/**
 * Nettoie affaires et saisies : identifiants valides (chaînes), Loads et types valides,
 * dates ISO, durées positives. Les éléments invalides sont ignorés et comptés.
 * @param {any[]} affs
 * @param {any[]} ents
 * @returns {{affaires: object[], entries: object[], dropped: number}}
 */
export function normalizeData(affs, ents) {
    let dropped = 0;
    const str = v => (v === null || v === undefined) ? '' : String(v);
    const affaires = (Array.isArray(affs) ? affs : []).flatMap(a => {
        const id = normId(a && a.id);
        if (!a || !id) { dropped++; return []; }
        const budgets = {};
        Object.entries(a.budgets || {}).forEach(([k0, v]) => {
            const k = legacyTypeCode(k0), n = Number(v);
            if (TYPE_RE.test(k) && Number.isFinite(n) && n > 0) budgets[k] = n;
        });
        const cleanLoads = v => [...new Set((Array.isArray(v) ? v : []).map(legacyRack).filter(l => LOAD_RE.test(l)))];
        const loads = cleanLoads(a.loads), mepLoads = cleanLoads(a.mepLoads);
        return [{ ...a, id, client: str(a.client), num: str(a.num), machine: str(a.machine), loads, mepLoads, budgets, gpao: cleanGpao(a.gpao),
                  productive: !!a.productive, unbilled: !!a.unbilled }];
    });
    const entries = (Array.isArray(ents) ? ents : []).flatMap(e => {
        const id = normId(e && e.id), affaireId = normId(e && e.affaireId), minutes = Math.round(Number(e && e.minutes));
        if (!e || !id || !affaireId || !DATE_RE.test(str(e.date)) || !Number.isFinite(minutes) || minutes <= 0) { dropped++; return []; }
        return [{ ...e, id, affaireId, minutes, date: str(e.date), type: TYPE_RE.test(legacyTypeCode(e.type)) ? legacyTypeCode(e.type) : 'AUTRE' }];
    });
    return { affaires, entries, dropped };
}
