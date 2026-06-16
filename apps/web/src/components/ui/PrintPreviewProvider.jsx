import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import PrintPreviewModal from './PrintPreviewModal';

/**
 * PrintPreviewProvider — fournit un point unique d'aperçu/impression pour
 * toute l'application. Utiliser le hook `usePrintPreview()` depuis n'importe
 * quel composant pour afficher un aperçu HTML ou PDF dans le modal partagé.
 *
 * Exemple :
 *   const preview = usePrintPreview();
 *   preview.showHtml(html, { title: 'Fiche matériel', filename: 'fiche.html' });
 *   preview.showPdf({ blob }, { title: 'Rapport', filename: 'rapport.pdf' });
 *
 * Voir docs/03-Guides/print-preview.md pour la migration depuis
 * `window.open('', '_blank')`.
 */
const PrintPreviewContext = createContext(null);

export function PrintPreviewProvider({ children }) {
  const [config, setConfig] = useState(null);

  const close = useCallback(() => setConfig(null), []);

  const showHtml = useCallback((htmlContent, options = {}) => {
    if (!htmlContent) return;
    setConfig({
      htmlContent,
      pdfUrl: null,
      pdfBlob: null,
      ...options,
    });
  }, []);

  const showPdf = useCallback((source = {}, options = {}) => {
    const { url, blob } = source;
    if (!url && !blob) return;
    setConfig({
      htmlContent: null,
      pdfUrl: url || null,
      pdfBlob: blob || null,
      ...options,
    });
  }, []);

  const value = useMemo(() => ({ showHtml, showPdf, close }), [showHtml, showPdf, close]);

  return (
    <PrintPreviewContext.Provider value={value}>
      {children}
      <PrintPreviewModal
        open={!!config}
        onClose={close}
        title={config?.title}
        icon={config?.icon}
        htmlContent={config?.htmlContent}
        pdfUrl={config?.pdfUrl}
        pdfBlob={config?.pdfBlob}
        filename={config?.filename}
        size={config?.size || 'xl'}
        showDownload={config?.showDownload !== false}
        showPrint={config?.showPrint !== false}
      />
    </PrintPreviewContext.Provider>
  );
}

export function usePrintPreview() {
  const ctx = useContext(PrintPreviewContext);
  if (!ctx) {
    throw new Error('usePrintPreview doit être utilisé dans <PrintPreviewProvider>');
  }
  return ctx;
}

export default PrintPreviewProvider;
