// [AUDIT FIX MED-F2] Écriture sécurisée dans les fenêtres d'impression
// Sanitise le HTML via DOMPurify avant document.write pour prévenir XSS
import DOMPurify from 'dompurify';

/**
 * Ouvre une fenêtre popup et y écrit du HTML sanitisé.
 * @param {string} html - Le contenu HTML brut (ex: depuis l'API)
 * @returns {Window|null} La fenêtre ouverte, ou null si bloquée
 */
export function openSanitizedPrintWindow(html) {
  const win = window.open('', '_blank');
  if (!win) return null;
  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'link', 'meta'],
  });
  win.document.write(clean);
  win.document.close();
  return win;
}
