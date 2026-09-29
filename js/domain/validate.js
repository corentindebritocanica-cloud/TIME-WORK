/**
 * Validation des données importées (sauvegardes JSON, migration). Fonctions pures.
 */
export const LOAD_RE = /^[A-Z0-9_]{1,10}$/;
export const TYPE_RE = /^[A-Z0-9_]{1,40}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Identifiant valide (ancien : nombre ; nouveau : UUID) → chaîne, sinon null. */
export function normId(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    return (typeof v === 'string' && ID_RE.test(v)) ? v : null;
}

/** Nom de Load au format canonique (majuscules, sans espaces). */
export const cleanLoadName = raw => String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');

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
        Object.entries(a.budgets || {}).forEach(([k, v]) => {
            const n = Number(v);
            if (TYPE_RE.test(k) && Number.isFinite(n) && n > 0) budgets[k] = n;
        });
        const loads = [...new Set((Array.isArray(a.loads) ? a.loads : []).map(cleanLoadName).filter(l => LOAD_RE.test(l)))];
        return [{ ...a, id, client: str(a.client), num: str(a.num), machine: str(a.machine), loads, budgets,
                  productive: !!a.productive, unbilled: !!a.unbilled }];
    });
    const entries = (Array.isArray(ents) ? ents : []).flatMap(e => {
        const id = normId(e && e.id), affaireId = normId(e && e.affaireId), minutes = Math.round(Number(e && e.minutes));
        if (!e || !id || !affaireId || !DATE_RE.test(str(e.date)) || !Number.isFinite(minutes) || minutes <= 0) { dropped++; return []; }
        return [{ ...e, id, affaireId, minutes, date: str(e.date), type: TYPE_RE.test(str(e.type)) ? str(e.type) : 'AUTRE' }];
    });
    return { affaires, entries, dropped };
}
