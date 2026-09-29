/**
 * Préférences d'AFFICHAGE, propres à chaque appareil (localStorage « tw-apparence ») :
 *  - intensité du flou du verre (0 = sans flou … 50 = référence Verre … 100 = accentué) ;
 *  - animations entre les onglets (oui / non).
 * Pas dans Firestore : le PC et l'iPhone peuvent vouloir des réglages différents (le flou coûte
 * plus cher sur iPhone). Aucune donnée métier ici.
 *
 * ⚠ Le mini-script du <head> d'index.html applique la même formule AVANT le premier affichage
 *   (pas de flash) : changer les deux ensemble.
 */
const KEY = 'tw-apparence';
export const DEFAULT_PREFS = Object.freeze({ flou: 50, animations: true });

/** 0…100 → valeur de `--v-flou` (50 = blur 30 px + saturation 180 %, valeurs de verre.css). */
export function flouCSS(level) {
    const l = Math.max(0, Math.min(100, Math.round(Number(level))));
    return l === 0 ? 'none' : 'blur(' + (l * 0.6).toFixed(1) + 'px) saturate(' + (100 + l * 1.6).toFixed(0) + '%)';
}

/** Libellé lisible d'un niveau de flou. */
export function flouLabel(level) {
    const l = Math.round(Number(level));
    if (l <= 0) return 'Sans flou';
    const px = Math.round(l * 0.6) + ' px';
    if (l < 45) return 'Réduit · ' + px;
    if (l <= 55) return 'Normal · ' + px;
    return 'Accentué · ' + px;
}

/** @returns {{flou:number, animations:boolean}} */
export function loadPrefs() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* stockage indisponible */ }
    const flou = Number.isFinite(Number(p.flou)) ? Math.max(0, Math.min(100, Math.round(Number(p.flou)))) : DEFAULT_PREFS.flou;
    return { flou, animations: typeof p.animations === 'boolean' ? p.animations : DEFAULT_PREFS.animations };
}

/** Applique les préférences à la page (variables CSS / attribut sur <html>). */
export function applyPrefs(p = loadPrefs()) {
    const root = document.documentElement;
    root.style.setProperty('--v-flou', flouCSS(p.flou));
    root.dataset.animations = p.animations ? 'on' : 'off';
}

/** Enregistre (sur cet appareil) et applique. */
export function savePrefs(patch) {
    const p = { ...loadPrefs(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* navigation privée : appliqué quand même */ }
    applyPrefs(p);
    return p;
}

/** Animations entre onglets autorisées ? (préférence + réglage système « réduire les animations ») */
export const animationsOn = () => document.documentElement.dataset.animations !== 'off'
    && !matchMedia('(prefers-reduced-motion: reduce)').matches;
