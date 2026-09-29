/**
 * Camembert (anneau) SVG + légende liée au survol.
 * Couleurs par classe (`t-DE`, `load-3`, `pal-2`…) → variable CSS `--tc`.
 */
import { html } from './dom.js';
import { minsToHM } from '../domain/time.js';

/**
 * @param {{key:string, label:string, mins:number, cls:string}[]} data
 * @param {object} o
 * @param {number} o.size  diamètre en px
 * @param {string} o.scope préfixe unique des clés de survol
 * @param {string} o.center texte central (ex. total)
 * @param {string} [o.sub]  sous-texte central
 * @param {string} [o.label] libellé accessible
 */
export function pie(data, o) {
    const total = data.reduce((s, d) => s + d.mins, 0);
    if (!total) return html`<p class="empty">Aucune saisie</p>`;
    const S = o.size, c = S / 2, R = S / 2 - 4, Rin = R * 0.46;
    let a = -Math.PI / 2;
    const slices = data.map((d, i) => {
        const k = o.scope + '-' + i, ang = d.mins / total * 2 * Math.PI;
        const title = html`<title>${d.label} — ${minsToHM(d.mins)} (${Math.round(d.mins / total * 100)} %)</title>`;
        let shape;
        if (ang >= 2 * Math.PI - 1e-4) {
            shape = html`<circle class="slice ${d.cls}" data-lk="${k}" cx="${c}" cy="${c}" r="${R}">${title}</circle>`;
        } else {
            const x1 = c + R * Math.cos(a), y1 = c + R * Math.sin(a);
            const x2 = c + R * Math.cos(a + ang), y2 = c + R * Math.sin(a + ang);
            shape = html`<path class="slice ${d.cls}" data-lk="${k}" d="M${c},${c} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${ang > Math.PI ? 1 : 0},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z">${title}</path>`;
        }
        a += ang;
        return shape;
    });
    return html`
        <svg class="pie" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${o.label || 'Répartition'}">
            ${slices}
            <circle class="pie-hole" cx="${c}" cy="${c}" r="${Rin}"/>
            <text class="pie-center" x="${c}" y="${c + (o.sub ? 1 : 5)}">${o.center}</text>
            ${o.sub ? html`<text class="pie-sub" x="${c}" y="${c + 15}">${o.sub}</text>` : ''}
        </svg>`;
}

/**
 * Surbrillance croisée tranche ↔ légende (éléments portant `data-lk`).
 * @param {Element} root @param {AbortSignal} signal
 */
export function bindPieHover(root, signal) {
    const set = (el, on) => {
        const k = el.dataset.lk;
        root.querySelectorAll(`[data-lk="${CSS.escape(k)}"]`).forEach(x => x.classList.toggle('hl', on));
        el.closest('.pie-block')?.classList.toggle('pie-hover', on);
    };
    root.addEventListener('pointerover', e => { const el = e.target.closest('[data-lk]'); if (el) set(el, true); }, { signal });
    root.addEventListener('pointerout', e => { const el = e.target.closest('[data-lk]'); if (el) set(el, false); }, { signal });
}
