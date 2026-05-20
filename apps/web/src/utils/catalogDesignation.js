// ═══════════════════════════════════════════════════════════
// Helpers de normalisation des désignations catalogues
// Pures fonctions ESM — testables sans navigateur (node --test).
// ═══════════════════════════════════════════════════════════
// Chantier L7 — 6.1/6.2 :
//   - 6.1 Désignations mal détectées : nettoyage strict, suppression
//     des en-têtes/footers/leaders, fusion des désignations multi-lignes.
//   - 6.2 Analyse robuste : helpers réutilisés par tous les parsers
//     (Algam, ESL, LA-BS, ASD, Générique adaptatif).
//
// Aucune dépendance navigateur ni React ; utilisable en Node pour tests.
// ═══════════════════════════════════════════════════════════

/**
 * Collapse les espaces blancs (y compris espaces insécables) en un seul espace.
 */
const collapseWs = (s) => s.replace(/[\s\u00A0\u202F\u2007]+/g, ' ').trim();

/**
 * Tokens parasites à supprimer en fin de désignation.
 * Tous mis ensemble pour pouvoir matcher plusieurs occurrences de suite.
 */
const TRAILING_NOISE_RX =
  /(\s*[-–—:•·]\s*$|\s*(?:HT|TTC|€|EUR|EUROS?|\(HT\)|\(TTC\)|prix\s+unitaire|p\.?u\.?)\s*$|\s*[.…]+\s*$)/i;

/**
 * Mots-clés d'en-têtes / lignes parasites des catalogues PDF.
 * Une désignation qui commence (ou est égale) à ces mots est rejetée.
 */
const HEADER_KEYWORDS = [
  'code',
  'ref',
  'reference',
  'référence',
  'designation',
  'désignation',
  'description',
  'libellé',
  'libelle',
  'nom',
  'prix',
  'prix ht',
  'prix unitaire',
  'p.u.',
  'p.u',
  'pu',
  'qte',
  'qté',
  'quantite',
  'quantité',
  'unite',
  'unité',
  'poids',
  'longueur',
  'page',
  'total',
  'sous-total',
  'sous total',
  'catalogue',
  'tarif',
  'tarifs',
  'conditions',
  'contact',
  'sommaire',
  'index',
  'tva',
  'remise',
];

const HEADER_RX = new RegExp(
  '^\\s*(?:' +
    HEADER_KEYWORDS.map((w) => w.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')).join('|') +
    ')\\b',
  'i',
);

// URL / footer typique
const URL_RX = /^(?:www\.|https?:\/\/|tel\s*:|fax\s*:|mailto:)/i;
// Numéro de page isolé : "- 3 -" / "Page 4 / 12" / "12/45"
const PAGE_NUMBER_RX = /^(?:-\s*\d{1,4}\s*-|page\s+\d+(?:\s*\/\s*\d+)?|\d{1,3}\s*\/\s*\d{1,3})$/i;

/**
 * Nettoie une désignation brute issue d'un parseur PDF.
 * - Collapse les espaces (y compris insécables)
 * - Retire les leader dots / tirets de remplissage
 * - Retire en queue : HT, TTC, €, EUR, ponctuations isolées, ellipses
 * - Retire en tête : numérotation "1.", "1)", "•", "-"
 * - Préserve la casse (les catalogues ont des modèles sensibles à la casse)
 *
 * @param {string|null|undefined} raw
 * @returns {string} chaîne nettoyée (peut être vide)
 */
export function cleanDesignation(raw) {
  if (raw == null) return '';
  let s = String(raw);

  // Retirer caractères de remplacement PDF + checkmarks + leader dots compactés
  s = s.replace(/[\uFFFD✓✗◆◇▪▫■□●○]/g, ' ');

  // Leader dots type ". . . . ." ou "...." (3+ points consécutifs)
  s = s.replace(/(?:\s*\.){3,}\s*/g, ' ');
  // Leader tirets " - - - - "
  s = s.replace(/(?:\s*[-_=]){3,}\s*/g, ' ');

  s = collapseWs(s);

  // Numérotation en tête : "1. ", "1) ", "•", "- " (mais pas un tiret réel d'un mot composé)
  s = s.replace(/^(?:\d{1,3}[.)]\s+|[•·▪]\s+|-\s+)/, '');

  // Retirer plusieurs vagues de bruit en fin de chaîne (€ HT puis HT puis €)
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(TRAILING_NOISE_RX, '').trim();
    if (s === before) break;
  }

  return collapseWs(s);
}

/**
 * Détecte si une chaîne ressemble à un en-tête, un footer ou une ligne parasite
 * qu'il ne faut pas considérer comme désignation produit.
 *
 * @param {string|null|undefined} s
 * @returns {boolean}
 */
export function isLikelyHeader(s) {
  if (!s) return true;
  const t = collapseWs(String(s));
  if (!t) return true;
  if (t.length < 3) return true;
  if (URL_RX.test(t)) return true;
  if (PAGE_NUMBER_RX.test(t)) return true;
  if (HEADER_RX.test(t)) return true;
  // Tout en majuscules courtes (≤ 6 chars) sans chiffres : probable en-tête colonne
  if (/^[A-ZÉÈÀÂÔÛÎÇ\s]{1,8}$/.test(t) && !/[a-z0-9]/.test(t)) return true;
  return false;
}

/**
 * Détecte si une référence fournisseur est ambiguë (faux positif probable).
 * Une référence ambiguë doit être ignorée ou retraitée.
 *
 * Exemples ambigus :
 *   - "1", "12", "123" (numéro de page / ligne)
 *   - "2026", "2027" (millésime)
 *   - "12.5", "1,5" (dimension)
 *   - "10:30" (heure)
 *   - chaînes < 2 caractères
 *
 * @param {string|null|undefined} ref
 * @returns {boolean}
 */
export function isAmbiguousRef(ref) {
  if (ref == null) return true;
  const r = String(ref).trim();
  if (!r) return true;
  if (r.length < 2 || r.length > 40) return true;
  // Purement numérique court
  if (/^\d{1,4}$/.test(r)) return true;
  // Millésimes ou années
  if (/^(?:19|20)\d{2}$/.test(r)) return true;
  // Décimal pur (dimension/poids)
  if (/^\d+[.,]\d+$/.test(r)) return true;
  // Heure HH:MM
  if (/^\d{1,2}:\d{2}$/.test(r)) return true;
  // Mots-clés en-tête
  if (HEADER_RX.test(r)) return true;
  return false;
}

/**
 * Normalise une référence : trim, collapse internes, supprime ponctuation de
 * début/fin tout en préservant `/`, `-`, `.` et `_` qui peuvent être significatifs.
 *
 * @param {string|null|undefined} ref
 * @returns {string|null}
 */
export function normalizeRef(ref) {
  if (ref == null) return null;
  let r = String(ref).trim();
  if (!r) return null;
  r = collapseWs(r).replace(/\s+/g, '');
  // Retirer ponctuation parasite début/fin (sauf / - . _ : et chiffres/lettres)
  r = r.replace(/^[^\w/.\-:]+|[^\w/.\-:]+$/g, '');
  return r || null;
}

/**
 * Fusionne les désignations multi-lignes :
 * quand une "ligne produit" est suivie d'une ou plusieurs lignes qui sont
 * uniquement des suites textuelles (sans prix, sans nouveau code), on les
 * agrège dans la désignation du produit précédent.
 *
 * @param {string[]} rawLines  Lignes brutes (déjà trim).
 * @param {object}   opts
 * @param {(line:string) => boolean} opts.isProductLine
 *   Renvoie true si la ligne ressemble à un début d'article (a un prix ou une ref).
 * @param {(line:string) => boolean} [opts.isContinuation]
 *   Renvoie true si la ligne doit être considérée comme continuation (par défaut :
 *   ligne non vide, sans prix, sans en-tête, qui commence en minuscule ou par un
 *   caractère qui n'est pas un code (lettre+chiffres)).
 * @returns {string[]} Lignes consolidées (les continuations sont concaténées).
 */
export function mergeContinuationLines(rawLines, opts) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return [];
  const isProductLine = opts?.isProductLine;
  if (typeof isProductLine !== 'function') {
    throw new TypeError('mergeContinuationLines: opts.isProductLine required');
  }
  const hasPriceRx = /\d+[.,]\d{2}\s*(?:€|EUR|HT|TTC)\b/i;
  const looksLikeCodeRx = /^[A-Z][\w./-]{1,30}\b/;

  const defaultIsContinuation = (line) => {
    if (!line) return false;
    if (hasPriceRx.test(line)) return false;
    if (isLikelyHeader(line)) return false;
    if (looksLikeCodeRx.test(line)) return false;
    // Commence par minuscule, parenthèse, chiffre+unité (ex: "230 V")
    return /^[a-zà-ÿ(]/i.test(line) || /^\d+\s*[a-zA-ZÀ-ÿµΩ]/.test(line);
  };

  const isContinuation = opts.isContinuation || defaultIsContinuation;
  const out = [];
  let lastProductIdx = -1;

  for (const rawLine of rawLines) {
    const line = collapseWs(rawLine || '');
    if (!line) continue;
    if (isProductLine(line)) {
      out.push(line);
      lastProductIdx = out.length - 1;
      continue;
    }
    if (lastProductIdx >= 0 && isContinuation(line)) {
      out[lastProductIdx] = out[lastProductIdx] + ' ' + line;
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * Score qualitatif (0-100) d'une désignation candidate.
 * Utilisé pour départager des hypothèses de parsing et pour mesurer la
 * fiabilité globale (objectif ≥ 95 sur l'ensemble parsé).
 *
 * @param {string|null|undefined} s
 * @returns {number}
 */
export function scoreDesignation(s) {
  if (!s) return 0;
  const t = collapseWs(String(s));
  if (!t) return 0;
  if (isLikelyHeader(t)) return 0;
  let score = 0;
  // Longueur raisonnable
  if (t.length >= 5 && t.length <= 160) score += 40;
  else if (t.length >= 3 && t.length <= 200) score += 20;
  // Contient au moins une lettre
  if (/[A-Za-zÀ-ÿ]/.test(t)) score += 25;
  // Au moins deux mots (mots = séparés par espaces)
  if (t.split(/\s+/).length >= 2) score += 15;
  // Pas exclusivement majuscules (= probable en-tête)
  if (!/^[A-ZÀ-Ý0-9\s]+$/.test(t)) score += 15;
  // Pas exclusivement chiffres+ponctuation
  if (/[A-Za-zÀ-ÿ]{3,}/.test(t)) score += 5;
  return Math.min(100, score);
}

/**
 * Construit une statistique de qualité sur un lot d'articles parsés.
 * @param {Array<{designation?:string, supplier_ref?:string}>} items
 * @returns {{count:number, avgScore:number, validCount:number, validRate:number}}
 */
export function summarizeDesignationQuality(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { count: 0, avgScore: 0, validCount: 0, validRate: 0 };
  }
  let total = 0;
  let valid = 0;
  for (const it of items) {
    const sc = scoreDesignation(it?.designation);
    total += sc;
    if (sc >= 60) valid++;
  }
  return {
    count: items.length,
    avgScore: Math.round((total / items.length) * 10) / 10,
    validCount: valid,
    validRate: Math.round((valid / items.length) * 1000) / 10,
  };
}
