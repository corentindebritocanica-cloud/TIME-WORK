/**
 * Solde du pointage CEGID (fonction pure).
 */
import { DAY_TARGET_MIN } from './time.js';

/**
 * Pour chaque semaine contenant au moins un jour pointé, l'objectif est de 7h06
 * par jour ouvré passé (< aujourd'hui) ou déjà pointé (aujourd'hui, congé posé à l'avance).
 * @param {Record<string, number>} days minutes pointées par date ISO « AAAA-MM-JJ »
 * @param {string} todayIso date du jour « AAAA-MM-JJ »
 * @param {number} [dayTarget=426] objectif quotidien en minutes
 * @returns {number} solde en minutes (positif = avance)
 */
export function computeBalance(days, todayIso, dayTarget = DAY_TARGET_MIN) {
    const toIso = d => d.toISOString().slice(0, 10);
    const weeks = new Map();
    for (const [iso, min] of Object.entries(days)) {
        if (!(min > 0)) continue;
        const d = new Date(iso + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
        const mon = toIso(d);
        if (!weeks.has(mon)) weeks.set(mon, { worked: 0, dates: new Set() });
        const w = weeks.get(mon); w.worked += min; w.dates.add(iso);
    }
    let balance = 0;
    for (const [mon, w] of weeks) {
        let target = 0;
        const d = new Date(mon + 'T00:00:00Z');
        for (let i = 0; i < 5; i++) {
            const iso = toIso(d);
            if (iso < todayIso || w.dates.has(iso)) target += dayTarget;
            d.setUTCDate(d.getUTCDate() + 1);
        }
        balance += w.worked - target;
    }
    return balance;
}
