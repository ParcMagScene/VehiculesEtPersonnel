// ═══════════════════════════════════════════════════════════════
// Sanitizer pour PDFKit (Helvetica / WinAnsi).
//
// Helvetica intégré à PDFKit ne supporte que l'encodage WinAnsi
// (≈ CP1252). Les caractères hors WinAnsi (emojis, CJK, symboles
// Unicode étendus...) sortent en bytes interprétés au hasard
// (ex. emoji "📋" → "Ø=Ý"), ce qui pollue les PDF du module Suivi.
//
// `sanitizeForPdf(s)` filtre une chaîne en ne gardant que les
// caractères supportés par WinAnsi. `attachPdfSanitizer(doc)`
// intercepte les méthodes de mesure/rendu de texte d'un doc PDFKit
// pour appliquer le filtre automatiquement à tous les call sites.
// ═══════════════════════════════════════════════════════════════

// Caractères Unicode > 0xFF qui sont supportés par WinAnsi (CP1252).
// Source : table d'encodage PDF/CP1252 (positions 0x80-0x9F + ligatures).
const WINANSI_EXTRAS = new Set([
  0x20ac, // €
  0x201a, // ‚
  0x0192, // ƒ
  0x201e, // „
  0x2026, // …
  0x2020, // †
  0x2021, // ‡
  0x02c6, // ˆ
  0x2030, // ‰
  0x0160, // Š
  0x2039, // ‹
  0x0152, // Œ
  0x017d, // Ž
  0x2018, // '
  0x2019, // '
  0x201c, // "
  0x201d, // "
  0x2022, // •
  0x2013, // –
  0x2014, // —
  0x02dc, // ˜
  0x2122, // ™
  0x0161, // š
  0x203a, // ›
  0x0153, // œ
  0x017e, // ž
  0x0178, // Ÿ
]);

/**
 * Filtre une chaîne pour ne garder que les caractères supportés
 * par la police Helvetica/WinAnsi de PDFKit.
 * Les caractères non supportés (emojis, CJK, etc.) sont supprimés.
 *
 * @param {*} input - Valeur à filtrer (convertie en string).
 * @returns {*} La chaîne filtrée, ou la valeur d'origine si null/undefined.
 */
export function sanitizeForPdf(input) {
  if (input == null) return input;
  const s = String(input);
  let out = '';
  // Itération par code point (gère correctement les surrogates pairs).
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff || WINANSI_EXTRAS.has(cp)) {
      out += ch;
    }
    // Sinon : caractère hors WinAnsi (emoji, etc.) — supprimé.
  }
  // Compresse les espaces doubles laissés par des suppressions de glyphes.
  return out.replace(/ {2,}/g, ' ');
}

/**
 * Intercepte `doc.text`, `doc.widthOfString` et `doc.heightOfString`
 * pour appliquer `sanitizeForPdf` à leur premier argument (le texte).
 * Préserve la chainabilité de PDFKit.
 *
 * @param {object} doc - Instance PDFKit.
 * @returns {object} Le même doc (pour chainage).
 */
export function attachPdfSanitizer(doc) {
  const origText = doc.text.bind(doc);
  const origWidth = doc.widthOfString.bind(doc);
  const origHeight = doc.heightOfString.bind(doc);

  doc.text = function (text, ...args) {
    return origText(sanitizeForPdf(text), ...args);
  };
  doc.widthOfString = function (text, ...args) {
    return origWidth(sanitizeForPdf(text), ...args);
  };
  doc.heightOfString = function (text, ...args) {
    return origHeight(sanitizeForPdf(text), ...args);
  };

  return doc;
}
