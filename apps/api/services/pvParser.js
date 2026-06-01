// ═══════════════════════════════════════════════════════════════
// services/pvParser.js — Extraction de PV de contrôle (PDF natifs)
//
// Stratégie : pdf-parse pour extraire le texte brut, puis application
// de regex configurables (DEFAULT_PATTERNS). L'objectif n'est PAS de
// parser parfaitement tous les formats du premier coup mais d'extraire
// les champs récurrents (référence, n° série, date, statut, organisme)
// et de laisser le reste en `rawText` pour révision manuelle dans l'UI.
//
// Les patterns peuvent être enrichis sans modifier ce fichier en
// passant un tableau `patterns` à parsePvPdf().
//
// Pas d'OCR (PV PDF natifs uniquement). Pour les PDF scannés/images,
// un module OCR (tesseract) pourra être branché en v2.
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';

import logger from '../logger.js';

/**
 * Patterns de référence — couvrent la majorité des PV français.
 * Chaque pattern produit le champ ciblé via le 1er groupe de capture.
 * Ordre = priorité (premier match retenu).
 */
const DEFAULT_PATTERNS = {
  reference: [
    // Référence rapport DEKRA / Bureau Veritas : "N° 092929502601R001"
    /\bn[°o]\s*([0-9][0-9A-Z]{6,}(?:R\d+)?)/i,
    /(?:rapport\s*n[°o]?)\s*[:#]?\s*([0-9A-Z][0-9A-Z._\-/]{5,30})/i,
    /(?:r[ée]f(?:[ée]rence)?\s*(?:produit|article|catalogue)?)\s*[:#]\s*([A-Z0-9][A-Z0-9._\-/]{4,30})/i,
    /\bref\.?\s*[:#]\s*([A-Z0-9][A-Z0-9._\-/]{4,30})/i,
  ],
  serialNumber: [
    /(?:n[°o]?\s*(?:de\s*)?s[ée]rie|s\/?n|serial(?:\s*number)?|num[ée]ro\s*s[ée]rie)\s*[:#]?\s*([A-Z0-9][A-Z0-9._\-/]{3,40})/i,
    /\bS\.?N\.?\s*[:#]\s*([A-Z0-9][A-Z0-9._\-/]{3,40})/i,
  ],
  dateControle: [
    /(?:date(?:s)?\s*(?:du\s*|de\s*)?(?:contr[ôo]le|v[ée]rification|inspection|essai))\s*[:#]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(?:v[ée]rification\s*r[ée]alis[ée]e\s*le)\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(?:contr[ôo]l[ée]?\s*le)\s*[:#]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
  ],
  organisme: [
    /\b(APAVE|VERITAS|BUREAU\s*VERITAS|SOCOTEC|DEKRA|NORISKO|QUALICONSULT)\b/i,
    /(?:organisme|laboratoire|bureau\s*(?:de\s*)?contr[ôo]le|cabinet)\s*[:#]?\s*([A-Z][\w\s&.-]{2,60})/i,
  ],
  statut: [
    // Champs explicites « Statut : ... », « Conclusion : ... » — plus stricts
    /(?:^|\n)\s*(?:statut|r[ée]sultat|conclusion|d[ée]cision|avis)\s*[:#]\s*(conforme|non\s*conforme|d[ée]faut|rebut(?:é|er)?|ok|nok|favorable|d[ée]favorable)/i,
    // Cas DEKRA / Veritas : "Aucune observation" → conforme
    /\b(aucune\s*observation(?:\s*constat[ée]e)?)\b/i,
    // Cas explicite isolé "NON CONFORME" en majuscules
    /\b(NON\s*CONFORME|D[ÉE]FAVORABLE|REBUT[ÉE]?|D[ÉE]FAUT)\b/,
  ],
  prochainControle: [
    /(?:prochain(?:e)?\s*(?:contr[ôo]le|v[ée]rification|[ée]ch[ée]ance)|validit[ée]\s*jusqu['']\s*au?|expir(?:e|ation)\s*(?:le)?)\s*[:#]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
  ],
  periodicite: [
    /\bp[ée]riodicit[ée]\s*[:#]?\s*(mensuelle|trimestrielle|semestrielle|annuelle|biennale|quinquennale|\d+\s*(?:mois|ans?))/i,
  ],
};

const PERIODICITE_MONTHS = {
  mensuelle: 1,
  trimestrielle: 3,
  semestrielle: 6,
  annuelle: 12,
  biennale: 24,
  quinquennale: 60,
};

/**
 * Normalise une date FR dd/mm/yyyy → ISO yyyy-mm-dd (best-effort).
 * Retourne null si parsing impossible.
 */
function toIsoDate(input) {
  if (!input) return null;
  const m = String(input)
    .trim()
    .match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
  d = d.padStart(2, '0');
  mo = mo.padStart(2, '0');
  const iso = `${y}-${mo}-${d}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function normalizeStatut(s) {
  if (!s) return null;
  const v = s.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/(^|\s)(conforme|favorable|ok)(\s|$)/.test(v)) return 'CONFORME';
  if (/aucune\s*observation/.test(v)) return 'CONFORME';
  if (/(non\s*conforme|d[ée]favorable|nok)/.test(v)) return 'NON_CONFORME';
  if (/rebut/.test(v)) return 'REBUT';
  if (/d[ée]faut/.test(v)) return 'DEFAUT';
  return v.toUpperCase();
}

/**
 * Ajoute N mois à une date ISO (yyyy-mm-dd). Renvoie null si invalide.
 */
function addMonths(isoDate, months) {
  if (!isoDate || !months) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Convertit la périodicité textuelle en nombre de mois.
 * Accepte aussi "6 mois", "2 ans", "24 mois".
 */
function periodiciteToMonths(s) {
  if (!s) return null;
  const v = s.toLowerCase().trim();
  if (PERIODICITE_MONTHS[v] != null) return PERIODICITE_MONTHS[v];
  const m = v.match(/(\d+)\s*(mois|ans?)/);
  if (m) return m[2].startsWith('an') ? Number(m[1]) * 12 : Number(m[1]);
  return null;
}

/**
 * Applique un set de patterns à un texte et renvoie le 1er match par champ.
 * @param {string} text - Texte extrait du PDF.
 * @param {object} patterns - Map { field: [regex, ...] }.
 */
function applyPatterns(text, patterns) {
  const out = {};
  for (const [field, regexList] of Object.entries(patterns)) {
    for (const re of regexList) {
      const m = text.match(re);
      if (m && m[1]) {
        out[field] = m[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }
  }
  return out;
}

/**
 * Extrait les données structurées d'un PV PDF.
 * @param {string} filePath - Chemin absolu du PDF.
 * @param {object} [opts]
 * @param {object} [opts.patterns] - Surcharge des regex par champ (merge).
 * @returns {Promise<{
 *   reference: string|null,
 *   serialNumber: string|null,
 *   dateControle: string|null,
 *   prochainControle: string|null,
 *   statut: string|null,
 *   organisme: string|null,
 *   rawText: string,
 *   pages: number,
 *   confidence: 'high'|'medium'|'low',
 *   warnings: string[]
 * }>}
 */
export async function parsePvPdf(filePath, opts = {}) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  let pdf;
  try {
    pdf = await parser.getText();
  } finally {
    if (typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch {
        /* ignore */
      }
    }
  }
  const text = (pdf?.text || '').replace(/\u00A0/g, ' ');
  const pages = pdf?.pages?.length || pdf?.numpages || 0;

  const patterns = { ...DEFAULT_PATTERNS, ...(opts.patterns || {}) };
  const extracted = applyPatterns(text, patterns);

  const result = {
    reference: extracted.reference || null,
    serialNumber: extracted.serialNumber || null,
    dateControle: toIsoDate(extracted.dateControle) || null,
    prochainControle: toIsoDate(extracted.prochainControle) || null,
    statut: normalizeStatut(extracted.statut) || null,
    organisme: extracted.organisme || null,
    periodicite: extracted.periodicite || null,
    rawText: text,
    pages,
    warnings: [],
  };

  // Si pas de prochain contrôle explicite, on tente de le calculer depuis la périodicité.
  if (!result.prochainControle && result.dateControle && result.periodicite) {
    const months = periodiciteToMonths(result.periodicite);
    if (months) {
      result.prochainControle = addMonths(result.dateControle, months);
      result.warnings.push(`Prochain contrôle calculé (${result.periodicite} → +${months} mois)`);
    }
  }

  // Évaluation de confiance basique : nb de champs trouvés sur 4 critiques.
  const critical = ['reference', 'serialNumber', 'dateControle', 'statut'];
  const found = critical.filter((k) => result[k]).length;
  result.confidence = found >= 3 ? 'high' : found >= 2 ? 'medium' : 'low';

  if (!result.serialNumber && !result.reference) {
    result.warnings.push('Aucune référence ni n° de série détecté — résolution manuelle requise.');
  }
  if (!result.dateControle) {
    result.warnings.push('Date du contrôle introuvable — à renseigner manuellement.');
  }
  if (text.length < 50) {
    result.warnings.push(
      'PDF probablement scanné (peu de texte extrait) — OCR non disponible en v1.',
    );
  }

  return result;
}

/**
 * Calcule un hash SHA-256 d'un fichier (utilisé pour anti-doublon).
 * Exporté ici pour mutualiser l'algo entre route upload et tests futurs.
 */
export function computeFileHash(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export const __PATTERNS__ = DEFAULT_PATTERNS; // export interne (tests/debug)

logger.debug('pvParser chargé (pdf-parse + regex configurables)');
