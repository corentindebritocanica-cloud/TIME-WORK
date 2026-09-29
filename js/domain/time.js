/**
 * Durées et dates (fonctions pures). Dates au format ISO local « AAAA-MM-JJ ».
 */

export const DURATION_HELP = 'Exemples : 2:30 · 2h30 · 2h · 2 · 2.5';
export const DAY_TARGET_MIN = 426;          // 7h06
export const WEEK_TARGET_MIN = 5 * DAY_TARGET_MIN;   // 35h30

/**
 * Analyse une durée saisie. Formats : « 2:30 », « 2h30 », « 2h », « 2 », décimal « 2.5 » / « 2,5 ».
 * « 2,30 » est refusé (ambigu : 2h30 ou 2,30 h ?).
 * @param {string} raw
 * @returns {{minutes: number} | {error: string}}
 */
export function parseDuration(raw) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return { error: 'Durée vide. ' + DURATION_HELP };
    let minutes, m;
    if ((m = s.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?$/))) {
        const mm = m[2] === undefined ? 0 : parseInt(m[2], 10);
        if (mm > 59) return { error: 'Minutes supérieures à 59. ' + DURATION_HELP };
        minutes = parseInt(m[1], 10) * 60 + mm;
    } else if (/^\d{1,2}$/.test(s)) {
        minutes = parseInt(s, 10) * 60;
    } else if (/^\d{1,2},\d{2}$/.test(s)) {
        return { error: 'Ambigu : écris 2:30 (heures:minutes) ou 2.5 (décimal).' };
    } else if (/^\d{1,2}[.,]\d{1,2}$/.test(s)) {
        minutes = Math.round(parseFloat(s.replace(',', '.')) * 60);
    } else {
        return { error: 'Format non reconnu. ' + DURATION_HELP };
    }
    if (minutes <= 0) return { error: 'La durée doit être supérieure à 0.' };
    if (minutes > 24 * 60) return { error: 'Durée supérieure à 24 h.' };
    return { minutes };
}

/** 150 → « 2h30 ». @param {number} min */
export const minsToHM = min => Math.floor(min / 60) + 'h' + String(Math.round(min) % 60).padStart(2, '0');
/** 150 → « 2,50 ». @param {number} min */
export const minsToDec = min => (min / 60).toFixed(2).replace('.', ',');
/** Solde signé : « +0h24 », « −1h06 ». @param {number} min */
export const signedHM = min => (min > 0 ? '+' : min < 0 ? '−' : '±') + minsToHM(Math.abs(min));

/* ─────────────────────────── Dates ─────────────────────────── */
/** Date locale → « AAAA-MM-JJ ». @param {Date} d */
export const toISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
/** @returns {string} date du jour (locale) */
export const todayISO = () => toISO(new Date());
/** « AAAA-MM-JJ » → Date locale à midi (insensible aux changements d'heure). */
export const fromISO = iso => new Date(iso + 'T12:00:00');
/** Décale une date ISO de n jours. */
export function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
/** Lundi de la semaine d'une date ISO. */
export function mondayOf(iso) { const d = fromISO(iso); return addDays(iso, -((d.getDay() + 6) % 7)); }
/** Les 5 jours ouvrés (lun → ven) d'une semaine. @param {string} monday */
export const workWeek = monday => [0, 1, 2, 3, 4].map(i => addDays(monday, i));
/** Numéro de semaine ISO 8601. */
export function isoWeek(iso) {
    const thu = fromISO(addDays(mondayOf(iso), 3));
    const jan1 = new Date(thu.getFullYear(), 0, 1, 12);
    return Math.floor(Math.round((thu - jan1) / 86400000) / 7) + 1;
}

const fmt = (iso, opts) => fromISO(iso).toLocaleDateString('fr-FR', opts);
/** « 28 sept. » */
export const fmtShort = iso => fmt(iso, { day: '2-digit', month: 'short' });
/** « 28 septembre 2026 » */
export const fmtLong = iso => fmt(iso, { day: '2-digit', month: 'long', year: 'numeric' });
/** « 28/09/2026 » */
export const fmtNum = iso => fmt(iso, {});
/** « lundi » */
export const fmtWeekday = iso => fmt(iso, { weekday: 'long' });
/** « LUN » */
export const fmtWeekdayShort = iso => fmt(iso, { weekday: 'short' }).replace('.', '').toUpperCase();
