/**
 * Table UNIQUE des types de saisie : code, libellé, classe de couleur.
 * Les couleurs sont des tokens CSS `--type-<CODE>` (css/app.css), déclinés par thème.
 */

/** Ordre d'affichage (listes, légendes, budgets). */
export const TYPES = [
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
export const TYPE_CODES = TYPES.map(t => t.code);
const LABELS = Object.fromEntries(TYPES.map(t => [t.code, t.label]));

export const LOAD_PREFIX = 'CD_LOAD_';
const LOAD_PALETTE_SIZE = 10;

/** Type « Load CD » ? */
export const isLoadType = code => typeof code === 'string' && code.startsWith(LOAD_PREFIX);
/** Code de type d'un Load. */
export const loadType = load => LOAD_PREFIX + load;

/** Libellé lisible (texte brut, à échapper par l'appelant — fait par ui/dom.html). */
export function typeLabel(code) {
    if (LABELS[code]) return LABELS[code];
    if (isLoadType(code)) return 'CD ' + code.slice(LOAD_PREFIX.length);
    return code || '?';
}

/** Classe CSS portant la couleur du type (`--tc`). */
export function typeClass(code) {
    if (LABELS[code]) return 't-' + code;
    if (isLoadType(code)) {
        const c = code.charCodeAt(LOAD_PREFIX.length) || 65;
        return 'load-' + (((c - 65) % LOAD_PALETTE_SIZE) + LOAD_PALETTE_SIZE) % LOAD_PALETTE_SIZE;
    }
    return 't-AUTRE';
}

/** Types proposés pour une affaire (types fixes + ses Loads). */
export const typesFor = aff => [...TYPE_CODES, ...((aff && aff.loads) || []).map(loadType)];

/** Regroupe les Loads sous « CD » (vues globales). */
export const globalType = code => isLoadType(code) ? 'CD' : code;

/** Trie une liste de codes selon l'ordre de TYPES (codes inconnus à la fin). */
export function sortTypes(codes) {
    const rank = c => { const i = TYPE_CODES.indexOf(c); return i < 0 ? 1000 : i; };
    return [...codes].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}
