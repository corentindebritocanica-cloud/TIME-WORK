/**
 * Toasts de retour (succès / erreur / info), annoncés aux lecteurs d'écran,
 * avec action optionnelle (« Annuler »).
 */
import { html, toElement } from './dom.js';

const MAX = 3;

/**
 * @param {string} msg
 * @param {object} [o]
 * @param {'ok'|'error'|'info'} [o.kind='ok']
 * @param {{label:string, run:() => void}} [o.action] bouton d'action (ex. Annuler)
 * @param {number} [o.duration] ms (défaut : 3 s, 5 s avec action, 6 s en erreur)
 */
export function toast(msg, o = {}) {
    const region = document.getElementById('toasts');
    if (!region) return;
    const kind = o.kind || 'ok';
    const el = toElement(html`
        <div class="toast" data-kind="${kind}" role="${kind === 'error' ? 'alert' : 'status'}">
            <span class="toast-msg">${msg}</span>
            ${o.action ? html`<button type="button" class="toast-action">${o.action.label}</button>` : ''}
            <button type="button" class="toast-close" aria-label="Fermer">✕</button>
        </div>`);
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    el.querySelector('.toast-close').addEventListener('click', close);
    el.querySelector('.toast-action')?.addEventListener('click', () => { o.action.run(); close(); });
    region.append(el);
    while (region.children.length > MAX) region.firstElementChild.remove();
    const t = setTimeout(close, o.duration ?? (kind === 'error' ? 6000 : o.action ? 5000 : 3000));
    el.addEventListener('pointerenter', () => clearTimeout(t), { once: true });
    return { close };
}
