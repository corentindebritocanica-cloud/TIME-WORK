/**
 * Dialogues natifs (<dialog> + showModal : focus piégé, Échap, fond inerte).
 * Remplace alert() / confirm() dans toute l'app.
 */
import { html, mount } from './dom.js';

const dlg = () => document.getElementById('dlg');
let busy = Promise.resolve();

/**
 * Ouvre le dialogue partagé.
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.text] paragraphe d'explication (texte brut)
 * @param {object} [o.body] fragment html`` (formulaire, aperçu…)
 * @param {{id:string,label:string,kind?:'primary'|'danger'}[]} o.buttons
 * @param {string} [o.cancel] id renvoyé par Échap (défaut : dernier bouton)
 * @param {'s'|'m'|'l'} [o.size]
 * @param {(el:HTMLDialogElement, signal:AbortSignal) => void} [o.onOpen] liaison des champs
 * @param {(id:string, el:HTMLDialogElement) => boolean|Promise<boolean>} [o.validate] false = rester ouvert
 * @returns {Promise<string>} id du bouton choisi
 */
export function ask(o) {
    const run = () => new Promise(resolve => {
        const el = dlg();
        const cancel = o.cancel ?? o.buttons[o.buttons.length - 1].id;
        const ac = new AbortController();
        el.dataset.size = o.size || 's';
        mount(el, html`
            <form method="dialog" class="dlg-form" novalidate>
                <header class="dlg-head"><h2 id="dlg-title">${o.title}</h2></header>
                <div class="dlg-body">
                    ${o.text ? html`<p class="dlg-text">${o.text}</p>` : ''}
                    ${o.body || ''}
                </div>
                <footer class="dlg-foot">
                    ${o.buttons.map(b => html`<button type="submit" value="${b.id}" class="btn ${b.kind === 'primary' ? 'btn-primary' : b.kind === 'danger' ? 'btn-danger' : 'btn-ghost'}">${b.label}</button>`)}
                </footer>
            </form>`);
        el.setAttribute('aria-labelledby', 'dlg-title');
        const form = el.querySelector('form');
        form.addEventListener('submit', async ev => {
            const id = ev.submitter?.value ?? cancel;
            if (id !== cancel && o.validate) {
                ev.preventDefault();
                if (await o.validate(id, el)) { el.returnValue = id; el.close(); }
            }
        }, { signal: ac.signal });
        el.addEventListener('cancel', () => { el.returnValue = cancel; }, { signal: ac.signal });
        el.addEventListener('close', () => { ac.abort(); resolve(el.returnValue || cancel); }, { once: true });
        el.returnValue = '';
        el.showModal();
        o.onOpen?.(el, ac.signal);
        if (!el.contains(document.activeElement) || document.activeElement === el) {
            (el.querySelector('[autofocus]') || el.querySelector('.btn-primary') || el.querySelector('button'))?.focus();
        }
    });
    busy = busy.then(run, run);        // un seul dialogue à la fois
    return busy;
}

/**
 * Confirmation d'une action.
 * @returns {Promise<boolean>}
 */
export async function confirmAction(title, text, okLabel = 'Confirmer', danger = false) {
    const r = await ask({ title, text, buttons: [
        { id: 'ok', label: okLabel, kind: danger ? 'danger' : 'primary' },
        { id: 'cancel', label: 'Annuler' }] });
    return r === 'ok';
}

/** Message bloquant (erreur importante). */
export function inform(title, text) {
    return ask({ title, text, buttons: [{ id: 'ok', label: 'OK', kind: 'primary' }] });
}
