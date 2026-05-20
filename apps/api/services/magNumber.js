// ═══════════════════════════════════════════════════════════════
// apps/api/services/magNumber.js
//
// Source de vérité unique côté backend pour la détection des numéros MAG.
//
// Règles métier (validées 2026-05-20) :
//   • Un numéro MAG est de la forme LETTRES + CHIFFRES (ex: VX1, E09, T01).
//   • Il est TOUJOURS séparé du numéro de série par exactement " - "
//     (au moins un espace de chaque côté du tiret). Plusieurs espaces tolérés
//     (ex: "T01 -  2400953513").
//   • Si le tiret n'est pas entouré d'espaces (ex: "T01-2400953513"), alors
//     ce n'est PAS un numéro MAG : la chaîne complète reste le numéro de série.
//   • Le MAG peut apparaître en préfixe ou en suffixe ("VX1 - SN" ou "SN - VX1").
//
// Format strict :
//   ^[A-Z]{1,3}[0-9]{1,4}$   (uppercase normalisé, tolère minuscules en entrée)
//
// Le séparateur exigé est `\s+-\s+` (au moins un espace de chaque côté).
// ═══════════════════════════════════════════════════════════════

/** Regex stricte du format d'un numéro MAG (déjà normalisé en majuscules). */
export const MAG_NUMBER_RE = /^[A-Z]{1,3}[0-9]{1,4}$/;

/** Regex du séparateur exigé entre numéro MAG et numéro de série. */
export const MAG_SEPARATOR_RE = /\s+-\s+/;

/**
 * Normalise un candidat numéro MAG : trim + uppercase + validation format.
 * @param {*} raw
 * @returns {string|null} le MAG normalisé en uppercase, ou null si invalide/vide.
 */
export function normalizeMagNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === '') return null;
  return MAG_NUMBER_RE.test(s) ? s : null;
}

/**
 * Indique si une chaîne est un numéro MAG valide (post-normalisation).
 * @param {*} raw
 * @returns {boolean}
 */
export function isMagNumber(raw) {
  return normalizeMagNumber(raw) !== null;
}

/**
 * Parse un numéro de série brut et extrait l'éventuel numéro MAG.
 *
 * Le MAG peut être en préfixe ou en suffixe, séparé du serial par " - "
 * (au moins un espace de chaque côté du tiret).
 *
 *   "T01 - 2400953513"     → { coreSerial: '2400953513', magNumber: 'T01' }
 *   "0788770045   - V12"   → { coreSerial: '0788770045', magNumber: 'V12' }
 *   "VX1 - SN-12-34"       → { coreSerial: 'SN-12-34',  magNumber: 'VX1' }
 *   "B884971"              → { coreSerial: 'B884971',   magNumber: null }
 *   "T01-2400953513"       → { coreSerial: 'T01-2400953513', magNumber: null }
 *                              (pas d'espaces ⇒ pas un MAG)
 *   "T01-SN - 2400"        → { coreSerial: 'T01-SN - 2400', magNumber: null }
 *                              (split donne ['T01-SN', '2400'] : aucun n'est un MAG)
 *
 * @param {*} rawSerial
 * @returns {{ coreSerial: string, magNumber: string|null }}
 */
export function parseMagSerial(rawSerial) {
  const raw = String(rawSerial == null ? '' : rawSerial).trim();
  if (!raw) return { coreSerial: '', magNumber: null };

  // Split sur ` - ` strict (au moins un espace de chaque côté).
  // On utilise un split limité par ce séparateur unique : si la chaîne
  // contient plusieurs ` - `, on ne peut pas trancher → on garde tel quel.
  const parts = raw.split(MAG_SEPARATOR_RE);
  if (parts.length !== 2) {
    return { coreSerial: raw, magNumber: null };
  }
  const a = parts[0].trim();
  const b = parts[1].trim();
  const aMag = normalizeMagNumber(a);
  const bMag = normalizeMagNumber(b);

  // Cas typiques : un seul des deux côtés est un MAG valide.
  if (aMag && !bMag) return { coreSerial: b, magNumber: aMag };
  if (bMag && !aMag) return { coreSerial: a, magNumber: bMag };

  // Ambiguïté : les deux côtés matchent (rare : "AB12 - CD34"), ou aucun.
  // On préfère ne rien extraire pour éviter une fausse promotion.
  return { coreSerial: raw, magNumber: null };
}
