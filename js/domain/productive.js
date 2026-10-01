/**
 * Temps productif d'une semaine (encart du tableau de bord).
 *
 * Ne compte JAMAIS l'avenir : seuls les jours ≤ `until` sont pris en compte (pointage ET saisies).
 * Le tableau de bord passe `until` = hier (J-1, par défaut : le pointage est souvent rempli à
 * l'avance) ou aujourd'hui (J-0, sur demande).
 *
 * Règles (inchangées) : temps de travail = heures pointées des jours retenus, moins les affaires
 * « non facturées » ; sans pointage, on prend la somme des saisies facturées ; productif = saisies
 * des affaires « temps productif » (hors non facturées).
 *
 * @param {object} p
 * @param {string[]} p.days            jours ouvrés de la semaine (ISO, lun → ven)
 * @param {(iso:string)=>number} p.dayMinutes  minutes pointées d'un jour (0 si rien)
 * @param {{date:string, affaireId:string, minutes:number}[]} p.entries
 * @param {{id:string, productive?:boolean, unbilled?:boolean}[]} p.affaires
 * @param {string} p.until             dernier jour compté (ISO, inclus)
 * @returns {{days:string[], workMin:number, prodMin:number, pct:number}}
 */
export function computeProductive({ days, dayMinutes, entries, affaires, until }) {
    const kept = days.filter(iso => iso <= until);
    if (!kept.length) return { days: kept, workMin: 0, prodMin: 0, pct: 0 };
    const first = kept[0], last = kept[kept.length - 1];
    const unbilled = new Set(affaires.filter(a => a.unbilled).map(a => a.id));
    const productive = new Set(affaires.filter(a => a.productive).map(a => a.id));
    const wk = entries.filter(e => e.date >= first && e.date <= last);
    const counted = wk.filter(e => !unbilled.has(e.affaireId));
    const unbilledMin = wk.filter(e => unbilled.has(e.affaireId)).reduce((s, e) => s + e.minutes, 0);
    let workMin = kept.reduce((s, iso) => s + dayMinutes(iso), 0);
    workMin = workMin === 0 ? counted.reduce((s, e) => s + e.minutes, 0) : Math.max(0, workMin - unbilledMin);
    const prodMin = counted.filter(e => productive.has(e.affaireId)).reduce((s, e) => s + e.minutes, 0);
    return { days: kept, workMin, prodMin, pct: workMin > 0 ? Math.round(prodMin / workMin * 100) : 0 };
}
