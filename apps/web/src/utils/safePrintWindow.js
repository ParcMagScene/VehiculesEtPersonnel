// [AUDIT FIX MED-F2] Sanitisation HTML pour les flux d'impression.
// Sanitise via DOMPurify avant injection dans le PrintPreviewModal pour
// prévenir XSS depuis les HTML générés côté API (bulletins, congés, etc.).
import DOMPurify from 'dompurify';

/**
 * Sanitise du HTML brut pour affichage dans une iframe d'aperçu.
 * @param {string} html - Le contenu HTML brut (ex: depuis l'API)
 * @returns {string} HTML sanitisé prêt à être passé à
 *   `usePrintPreview().showHtml(...)`.
 */
export function sanitizePrintHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'link', 'meta'],
  });
}

/**
 * @deprecated — Cette fonction ouvre une popup browser. Préférer
 *   `sanitizePrintHtml(html)` + `usePrintPreview().showHtml(...)` pour
 *   utiliser le modal d'aperçu unifié de l'application.
 */
export function openSanitizedPrintWindow(html) {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write(sanitizePrintHtml(html));
  win.document.close();
  return win;
}
