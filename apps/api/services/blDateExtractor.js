// ═══════════════════════════════════════════════════════════════
// Helpers purs — Extraction des dates depuis un parsed_data BL/BP
// L6 méga-prompt 7.1 — testable sans dépendances DB
// ═══════════════════════════════════════════════════════════════

/**
 * Convertit une date au format "DD/MM/YYYY" en "YYYY-MM-DD".
 * Retourne null si format invalide.
 * @param {string|null|undefined} str
 * @returns {string|null}
 */
export function parseFrDate(str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  // Validation sommaire (ne pas accepter 32/13/...)
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 9999) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Extrait les dates de début et de fin depuis un objet parsed_data (BL/BP).
 * Combine les champs racine (pd.date, pd.dateLivraison, pd.dateDebut, pd.dateFin)
 * et l'agrégation min/max des sections (pd.sections[].dateDebut/dateFin).
 * Les dates racine peuvent être au format ISO (YYYY-MM-DD) ou FR (DD/MM/YYYY).
 * @param {object|null|undefined} pd
 * @returns {{dateDebut: string|null, dateFin: string|null}}
 */
export function extractDatesFromParsedData(pd) {
  if (!pd || typeof pd !== 'object') return { dateDebut: null, dateFin: null };

  const normalize = (v) => {
    if (typeof v !== 'string' || v.length === 0) return null;
    // Déjà ISO ?
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // Sinon tenter FR
    return parseFrDate(v);
  };

  let dateDebut = normalize(pd.date) || normalize(pd.dateLivraison) || normalize(pd.dateDebut);
  let dateFin = normalize(pd.dateFin);

  if (Array.isArray(pd.sections)) {
    for (const sec of pd.sections) {
      if (!sec || typeof sec !== 'object') continue;
      const sd = parseFrDate(sec.dateDebut);
      if (sd && (!dateDebut || sd < dateDebut)) dateDebut = sd;
      const sf = parseFrDate(sec.dateFin);
      if (sf && (!dateFin || sf > dateFin)) dateFin = sf;
    }
  }

  return { dateDebut, dateFin };
}
