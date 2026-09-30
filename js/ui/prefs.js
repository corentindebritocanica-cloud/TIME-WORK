/**
 * Préférences d'AFFICHAGE, propres à chaque appareil (localStorage « tw-apparence ») :
 *  - thème : « verre » (par défaut), « neo » (neumorphisme), « clay » (claymorphism),
 *    « aurora » (aurores + verre), « skeuo » (skeuomorphisme), « phosphore » (terminal rétro),
 *    « blueprint » (plan d'atelier), « cyber » (néon), « moleskine » (carnet papier) ou
 *    « cockpit » (tableau de bord métal & LED) ;
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
export const THEMES = Object.freeze({
    verre: '#08080a', neo: '#1f232a', clay: '#1b1826', aurora: '#05060d', skeuo: '#161618',
    phosphore: '#050805', blueprint: '#0b2545', cyber: '#0a0612', moleskine: '#2a1d15', cockpit: '#141619'
});
/** Police propre à un thème (Google Fonts), chargée seulement quand le thème est choisi. */
export const THEME_FONTS = Object.freeze({
    phosphore: 'VT323&family=IBM+Plex+Mono:wght@400;600',
    blueprint: 'Share+Tech+Mono',
    cyber: 'Orbitron:wght@500;700',
    moleskine: 'Caveat:wght@500;700',
    cockpit: 'Share+Tech+Mono'
});

/** Ajoute (une fois) la feuille Google Fonts du thème. Mise en cache par le service worker. */
export function ensureThemeFont(theme) {
    const spec = THEME_FONTS[theme];
    if (!spec || document.getElementById('tw-police-' + theme)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.id = 'tw-police-' + theme;
    l.href = 'https://fonts.googleapis.com/css2?family=' + spec + '&display=swap';
    document.head.append(l);
}
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
    ensureThemeFont(p.theme);
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
