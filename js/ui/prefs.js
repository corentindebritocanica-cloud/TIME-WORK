/**
 * Préférences d'AFFICHAGE, propres à chaque appareil (localStorage « tw-apparence ») :
 *  - thème : « verre » (par défaut), « neo » (neumorphisme), « clay » (claymorphism),
 *    « aurora » (aurores + verre) ou « skeuo » (skeuomorphisme) — tous sombres ;
 *  - intensité du flou du verre (0 = sans flou … 50 = référence Verre … 100 = accentué) ;
 *  - animations entre les onglets (oui / non).
 * Pas dans Firestore : le PC et l'iPhone peuvent vouloir des réglages différents (le flou coûte
 * plus cher sur iPhone). Aucune donnée métier ici.
 *
 * ⚠ Le mini-script du <head> d'index.html applique la même formule AVANT le premier affichage
 *   (pas de flash) : changer les deux ensemble.
 */
const KEY = 'tw-apparence';
export const DEFAULT_PREFS = Object.freeze({ theme: 'verre', flou: 50, animations: true });
/** Thèmes disponibles → couleur de la barre du navigateur / de l'app (meta theme-color). */
export const THEMES = Object.freeze({ verre: '#08080a', neo: '#1f232a', clay: '#1b1826', aurora: '#05060d', skeuo: '#161618' });
/** Thèmes qui utilisent le flou du verre (curseur « Effet de verre » actif). */
export const FLOU_THEMES = Object.freeze(['verre', 'aurora']);

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

/** @returns {{theme:string, flou:number, animations:boolean}} */
export function loadPrefs() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* stockage indisponible */ }
    const flou = Number.isFinite(Number(p.flou)) ? Math.max(0, Math.min(100, Math.round(Number(p.flou)))) : DEFAULT_PREFS.flou;
    return { theme: Object.hasOwn(THEMES, p.theme) ? p.theme : DEFAULT_PREFS.theme, flou,
             animations: typeof p.animations === 'boolean' ? p.animations : DEFAULT_PREFS.animations };
}

/** Applique les préférences à la page (variables CSS / attribut sur <html>). */
export function applyPrefs(p = loadPrefs()) {
    const root = document.documentElement;
    // Thèmes sans verre : aucune surface floutée (le style inline l'emporterait sur la feuille de styles)
    root.style.setProperty('--v-flou', FLOU_THEMES.includes(p.theme) ? flouCSS(p.flou) : 'none');
    root.dataset.animations = p.animations ? 'on' : 'off';
    root.dataset.theme = p.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[p.theme]);
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
