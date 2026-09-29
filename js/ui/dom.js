/**
 * Rendu HTML sûr par défaut.
 *
 * `html\`…${valeur}…\`` échappe TOUTES les valeurs interpolées ; seul un fragment produit
 * par `html` lui-même (ou `raw()` pour du contenu statique de confiance) est inséré tel quel.
 * Une donnée utilisateur ne peut donc jamais devenir du HTML.
 */

/** Échappe un texte pour HTML (contenu et attributs). */
export function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

class SafeHTML {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
}

/** Marque un contenu STATIQUE de confiance comme HTML (jamais une donnée utilisateur). */
export const raw = s => new SafeHTML(String(s));

function render(v) {
    if (v === null || v === undefined || v === false) return '';
    if (v instanceof SafeHTML) return v.s;
    if (Array.isArray(v)) return v.map(render).join('');
    return esc(v);
}

/**
 * Gabarit HTML à échappement automatique.
 * @returns {SafeHTML}
 */
export function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
    return new SafeHTML(out);
}

/** Remplace le contenu d'un élément par un fragment `html`. */
export function mount(el, fragment) {
    if (!(fragment instanceof SafeHTML)) throw new TypeError('mount() attend un fragment html``');
    el.innerHTML = fragment.s;
}

/** Fragment → élément unique. */
export function toElement(fragment) {
    const t = document.createElement('template');
    mount(t, fragment);
    return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Délégation d'événements par attribut `data-action`.
 * @param {Element} root
 * @param {string} type événement (click, change, input, focusout, keydown…)
 * @param {Record<string,(el:HTMLElement, ev:Event)=>void>} handlers clé = valeur de data-action
 * @param {AbortSignal} signal retire l'écouteur au démontage de la vue
 */
export function on(root, type, handlers, signal) {
    root.addEventListener(type, ev => {
        const el = ev.target.closest('[data-action]');
        if (!el || !root.contains(el)) return;
        const fn = handlers[el.dataset.action];
        if (fn) fn(el, ev);
    }, { signal });
}

/** Élément de saisie actif dans `root` (pour ne pas re-rendre sous les doigts de l'utilisateur). */
export function isEditing(root) {
    const a = document.activeElement;
    return !!a && root.contains(a) && a.matches('input, select, textarea');
}

/** Copie dans le presse-papiers. */
export async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
