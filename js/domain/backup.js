/**
 * Sauvegarde / restauration (format JSON inchangé depuis la première version).
 */

/** Télécharge un objet en JSON. @param {object} obj @param {string} prefix nom de fichier sans date */
export function downloadJSON(obj, prefix) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = prefix + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Construit la sauvegarde complète.
 * @param {typeof import('../store.js')} store
 * @returns {{exportedAt: string, affaires: object[], entries: object[], cegid: Object<string,string>}}
 */
export function buildBackup(store) {
    const cegid = {};
    Object.entries(store.getDays()).forEach(([iso, d]) => {
        cegid['h_' + iso] = String(d.h);
        cegid['m_' + iso] = String(d.m).padStart(2, '0');
        if (d.reason) cegid['r_' + iso] = d.reason;
    });
    return { exportedAt: new Date().toISOString(), affaires: store.getAffaires(), entries: store.getEntries(), cegid };
}

/**
 * Lit un fichier de sauvegarde (format actuel ou dump brut de l'ancienne version).
 * @param {string} text
 * @returns {{affaires: any[], entries: any[], cegid: Object<string,string>} | null}
 */
export function parseBackup(text) {
    let p;
    try { p = JSON.parse(text); } catch { return null; }
    if (p && !p.affaires && typeof p.sp_affaires === 'string') {
        const cegid = {};
        Object.keys(p).forEach(k => { if (/^(h_|m_|r_)/.test(k)) cegid[k] = p[k]; });
        try { p = { affaires: JSON.parse(p.sp_affaires || '[]'), entries: JSON.parse(p.sp_entries || '[]'), cegid }; }
        catch { return null; }
    }
    if (!p || !Array.isArray(p.affaires) || !Array.isArray(p.entries)) return null;
    return { affaires: p.affaires, entries: p.entries, cegid: p.cegid || {} };
}
