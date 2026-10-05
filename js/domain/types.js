/**
 * Types de saisie (« types de travail ») : table INTÉGRÉE + réglages de l'utilisateur.
 *
 * Les réglages vivent dans Firestore, `users/{uid}.settings.types` : liste ORDONNÉE
 *   [{ code, hidden? }                              ← type intégré (ordre, masquage)
 *    { code, label, color, custom: true, hidden? }] ← type ajouté dans Paramètres
 * `applyTypeConfig()` est appelé au démarrage et à chaque changement (autre poste compris) :
 * TYPES / TYPE_CODES sont des liaisons « vivantes » (export let), relues par tous les modules.
 *
 * Couleurs : types intégrés → tokens CSS `--type-<CODE>` (classe `t-<CODE>`) ;
 * types personnalisés → palette `pal-0` … `pal-9` (css/app.css), contrastes déjà vérifiés.
 * Fonctions pures, sauf l'état courant de la configuration.
 */

/** Types intégrés, dans l'ordre par défaut. */
export const BUILTIN_TYPES = [
    { code: 'DE',             label: 'DE' },
    { code: 'DE_NP',          label: 'DE - Tps non prod.' },
    { code: 'DE_COMP',        label: 'DE - complément' },
    { code: 'ECA',            label: 'ECA' },
    { code: 'REVIEW_ECA',     label: 'Review ECA' },
    { code: 'ECA_NP',         label: 'ECA - Tps non prod.' },
    { code: 'ECA_REP',        label: 'ECA - reprise' },
    { code: 'CD',             label: 'CD' },
    { code: 'CD_REP',         label: 'CD - reprise' },
    { code: 'REVIEW_CD',      label: 'Review CD' },
    { code: 'MEP',            label: 'MEP' },
    { code: 'AUTRE',          label: 'Autre' },
    { code: 'SIGN_OFF',       label: 'Sign Off' },
    { code: 'PREP_MISSION',   label: 'Préparation mission' },
    { code: 'MISSION_RELEVE', label: 'Mission relevé' },
    { code: 'CONCEP3D_REL',   label: 'Conception 3D relevé' },
    { code: 'CONCEPTION3D',   label: 'Conception 3D' },
    { code: 'CODE',           label: 'Code' },
    { code: 'VERIFICATION',   label: 'Vérification' },
    { code: 'REUNION',        label: 'Réunion' },
    { code: 'FORMATION',      label: 'Formation' }
];
const BUILTIN = new Map(BUILTIN_TYPES.map(t => [t.code, t.label]));

/**
 * Familles « par Load » : un type de base (CD, MEP) peut être découpé, PAR AFFAIRE, en Loads.
 *   - chaque famille a SA liste de Loads sur l'affaire (`field`) et donc ses propres budgets
 *     (ex. CD Load A = 10 h, MEP Load A = 15 h) ;
 *   - code d'une saisie : `<prefix><Load>` (CD_LOAD_A, MEP_LOAD_B…) ;
 *   - vues globales (tableau de bord) : un Load se cumule dans le type de base de sa famille.
 *     Les autres types de la famille (reprise, review…) ne sont PAS cumulés.
 */
export const LOAD_FAMILIES = Object.freeze([
    Object.freeze({ fam: 'CD',  field: 'loads',    prefix: 'CD_LOAD_' }),
    Object.freeze({ fam: 'MEP', field: 'mepLoads', prefix: 'MEP_LOAD_' })
]);
const FAMILY = new Map(LOAD_FAMILIES.map(f => [f.fam, f]));
/** Compatibilité : préfixe historique des Loads CD. */
export const LOAD_PREFIX = 'CD_LOAD_';
const LOAD_PALETTE_SIZE = 10;
/** Nombre de couleurs proposées pour un type personnalisé (classes pal-0 … pal-9). */
export const CUSTOM_COLORS = 10;
export const TYPE_LABEL_MAX = 40;
const CODE_RE = /^[A-Z0-9_]{1,40}$/;

/** Famille d'un code de Load (`{fam, field, prefix}`), ou null si ce n'est pas un Load. */
export const loadFamily = code => typeof code === 'string' ? LOAD_FAMILIES.find(f => code.startsWith(f.prefix)) || null : null;
/** Type « Load » (CD ou MEP) ? */
export const isLoadType = code => loadFamily(code) !== null;
/** Nom du Load d'un code (CD_LOAD_A → « A »), ou '' si ce n'est pas un Load. */
export const loadName = code => { const f = loadFamily(code); return f ? code.slice(f.prefix.length) : ''; };
/**
 * Code de type d'un Load.
 * @param {string} load nom du Load (A, B…)
 * @param {'CD'|'MEP'} [fam]
 */
export const loadType = (load, fam = 'CD') => FAMILY.get(fam).prefix + load;
/** Loads d'une famille sur une affaire (tableau, jamais null). */
export const loadsOf = (aff, fam) => (aff && Array.isArray(aff[FAMILY.get(fam).field])) ? aff[FAMILY.get(fam).field] : [];
/**
 * Loads d'une affaire, par famille (familles sans Load omises).
 * @returns {{fam:string, field:string, loads:string[], codes:string[]}[]}
 */
export const affLoadGroups = aff => LOAD_FAMILIES
    .map(f => { const loads = loadsOf(aff, f.fam); return { fam: f.fam, field: f.field, loads, codes: loads.map(l => f.prefix + l) }; })
    .filter(g => g.loads.length);
/** Tous les codes de Load d'une affaire (CD puis MEP). */
export const affLoadCodes = aff => affLoadGroups(aff).flatMap(g => g.codes);

/** Normalise un libellé (majuscules, sans accents, séparateurs → « _ ») — aussi utilisé par l'import CSV. */
export const normLabel = s => String(s ?? '').trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s\-.]+/g, '_');

/* ─────────────────────────── Configuration ─────────────────────────── */

/**
 * Réglages bruts (Firestore) → liste ordonnée COMPLÈTE et sûre.
 * Éléments invalides ignorés, doublons ignorés, types intégrés absents ajoutés à la fin.
 * @param {any} raw settings.types
 * @returns {{code:string, label:string, custom:boolean, hidden:boolean, color:number|null}[]}
 */
export function normalizeTypeConfig(raw) {
    const out = [], seen = new Set();
    (Array.isArray(raw) ? raw : []).forEach(t => {
        const code = typeof t?.code === 'string' ? t.code : '';
        if (!CODE_RE.test(code) || isLoadType(code) || seen.has(code)) return;
        if (BUILTIN.has(code)) {
            out.push({ code, label: BUILTIN.get(code), custom: false, hidden: !!t.hidden, color: null });
        } else {
            const label = typeof t.label === 'string' ? t.label.trim().slice(0, TYPE_LABEL_MAX) : '';
            if (!label) return;
            const c = Number(t.color);
            out.push({ code, label, custom: true, hidden: !!t.hidden, color: Number.isInteger(c) && c >= 0 && c < CUSTOM_COLORS ? c : 0 });
        }
        seen.add(code);
    });
    BUILTIN_TYPES.forEach(t => { if (!seen.has(t.code)) out.push({ code: t.code, label: t.label, custom: false, hidden: false, color: null }); });
    return out;
}

/**
 * Liste ordonnée → format enregistré dans Firestore (le plus court possible).
 * @param {{code:string, label:string, custom:boolean, hidden:boolean, color:number|null}[]} list
 */
export function serializeTypeConfig(list) {
    return list.map(t => t.custom
        ? { code: t.code, label: t.label, color: t.color ?? 0, custom: true, ...(t.hidden ? { hidden: true } : {}) }
        : { code: t.code, ...(t.hidden ? { hidden: true } : {}) });
}

/**
 * Code interne d'un nouveau type à partir de son libellé : « Essai terrain » → « ESSAI_TERRAIN ».
 * Jamais vide, jamais un préfixe de Load, jamais un code déjà pris (suffixe _2, _3…).
 * @param {string} label
 * @param {Iterable<string>} taken codes existants
 */
export function makeTypeCode(label, taken) {
    const used = new Set([...taken, ...BUILTIN.keys()]);
    let base = normLabel(label).replace(/[^A-Z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'TYPE';
    if (isLoadType(base)) base = 'T_' + base.slice(0, 28);
    let code = base, n = 2;
    while (used.has(code)) code = base + '_' + n++;
    return code;
}

let all = normalizeTypeConfig(null);
let byCode = new Map(all.map(t => [t.code, t]));

/** Types VISIBLES, dans l'ordre choisi (listes déroulantes, budgets). Liaison vivante. */
export let TYPES = all.filter(t => !t.hidden).map(({ code, label }) => ({ code, label }));
/** Tous les codes connus (masqués compris). Liaison vivante. */
export let TYPE_CODES = all.map(t => t.code);

/** Applique les réglages de l'utilisateur (settings.types). */
export function applyTypeConfig(raw) {
    all = normalizeTypeConfig(raw);
    byCode = new Map(all.map(t => [t.code, t]));
    TYPES = all.filter(t => !t.hidden).map(({ code, label }) => ({ code, label }));
    TYPE_CODES = all.map(t => t.code);
}

/** Liste ordonnée complète (copie) : écran Paramètres. */
export const allTypes = () => all.map(t => ({ ...t }));

/** Type proposé par défaut pour une nouvelle saisie : DE s'il est visible, sinon le premier visible. */
export const defaultType = () => (TYPES.some(t => t.code === 'DE') ? 'DE' : TYPES[0]?.code || 'AUTRE');

/** Code d'un type d'après son nom normalisé (code ou libellé) — import CSV. */
export function findTypeByName(normalized) {
    if (byCode.has(normalized)) return normalized;
    const hit = all.find(t => normLabel(t.label) === normalized);
    return hit ? hit.code : null;
}

/* ─────────────────────────── Affichage ─────────────────────────── */

/** Libellé lisible (texte brut, à échapper par l'appelant — fait par ui/dom.html). */
export function typeLabel(code) {
    const t = byCode.get(code);
    if (t) return t.label;
    const f = loadFamily(code);
    if (f) return f.fam + ' Load ' + code.slice(f.prefix.length);
    return code || '?';
}

/** Classe CSS portant la couleur du type (`--tc`). */
export function typeClass(code) {
    const t = byCode.get(code);
    if (t) return t.custom ? 'pal-' + t.color : 't-' + code;
    const f = loadFamily(code);
    if (f) {
        // Palette décalée pour MEP : « CD Load A » et « MEP Load A » ne partagent pas la même couleur.
        const c = (code.charCodeAt(f.prefix.length) || 65) - 65 + (f.fam === 'MEP' ? LOAD_PALETTE_SIZE / 2 : 0);
        return 'load-' + ((c % LOAD_PALETTE_SIZE) + LOAD_PALETTE_SIZE) % LOAD_PALETTE_SIZE;
    }
    return 't-AUTRE';
}

/** Types proposés pour une affaire : types visibles + ses Loads (CD, MEP) + tout type ayant déjà un budget. */
export function typesFor(aff) {
    const list = [...TYPES.map(t => t.code), ...affLoadCodes(aff)];
    Object.keys((aff && aff.budgets) || {}).forEach(k => { if (!list.includes(k)) list.push(k); });
    return list;
}

/** Vues globales : un Load se cumule dans le type de base de sa famille (CD_LOAD_A → CD, MEP_LOAD_B → MEP). */
export const globalType = code => loadFamily(code)?.fam ?? code;

/**
 * Trie une liste de codes selon l'ordre choisi ; chaque Load est placé juste après le type de base
 * de sa famille (CD, CD Load A, CD Load B, …). Codes inconnus à la fin.
 */
export function sortTypes(codes) {
    const order = new Map(all.map((t, i) => [t.code, i]));
    const rank = c => {
        const f = loadFamily(c);
        if (f) return order.has(f.fam) ? order.get(f.fam) + 0.5 : 999;
        return order.has(c) ? order.get(c) : 1000;
    };
    return [...codes].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}
