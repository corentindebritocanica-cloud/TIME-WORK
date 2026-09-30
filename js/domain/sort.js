/**
 * Tri des affaires (onglet « Par affaire ») — fonction pure.
 * Clés : 'created' (ordre de création), 'num' (code affaire), 'client' (nom du client), 'machine'.
 * Comparaison « naturelle » française : accents et casse ignorés, nombres comparés comme des nombres
 * (AF-2026-9 avant AF-2026-10). Les affaires sans valeur pour la clé vont toujours à la fin.
 */
export const AFF_SORTS = ['created', 'num', 'client', 'machine'];
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/**
 * @param {{num?:string, client?:string, machine?:string, createdAt?:number}[]} affaires
 * @param {{by?:string, dir?:'asc'|'desc'}} [sort]
 * @returns {object[]} nouvelle liste triée
 */
export function sortAffaires(affaires, sort = {}) {
    const by = AFF_SORTS.includes(sort.by) ? sort.by : 'created';
    const dir = sort.dir === 'desc' ? -1 : 1;
    const list = affaires.map((a, i) => ({ a, i }));
    list.sort((x, y) => {
        if (by === 'created') return dir * ((x.a.createdAt || 0) - (y.a.createdAt || 0) || x.i - y.i);
        const vx = String(x.a[by] ?? '').trim(), vy = String(y.a[by] ?? '').trim();
        if (!vx !== !vy) return vx ? -1 : 1;                 // vides à la fin, quel que soit le sens
        return dir * collator.compare(vx, vy) || collator.compare(String(x.a.num ?? ''), String(y.a.num ?? '')) || x.i - y.i;
    });
    return list.map(o => o.a);
}
