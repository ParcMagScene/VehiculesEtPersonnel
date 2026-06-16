import './PrintPreviewModal.css';

import { Download, FileText, Loader2, Printer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/design-system';

/**
 * PrintPreviewModal — modal unifié d'aperçu pour TOUTES les impressions et
 * exports PDF de l'application. Remplace systématiquement les anciens flux
 * `window.open('', '_blank')` + `window.print()`.
 *
 * Modes :
 *  - htmlContent (string) : page HTML complète A4 → rendue dans une iframe
 *    via srcDoc. L'utilisateur clique "Imprimer" → `iframe.contentWindow.print()`.
 *  - pdfUrl (string) | pdfBlob (Blob) : aperçu PDF natif via iframe.
 *
 * En général on utilise le hook `usePrintPreview()` plutôt que ce composant
 * directement.
 */
export default function PrintPreviewModal({
  open,
  onClose,
  title = 'Aperçu',
  icon = null,
  htmlContent = null,
  pdfUrl: pdfUrlProp = null,
  pdfBlob = null,
  filename = 'document',
  size = 'xl',
  showDownload = true,
  showPrint = true,
}) {
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Si on reçoit un Blob, on crée une URL locale qu'on révoque à la fermeture.
  const internalPdfUrl = useMemo(() => {
    if (pdfBlob) return URL.createObjectURL(pdfBlob);
    return null;
  }, [pdfBlob]);

  const pdfUrl = pdfUrlProp || internalPdfUrl;

  useEffect(() => {
    return () => {
      if (internalPdfUrl) URL.revokeObjectURL(internalPdfUrl);
    };
  }, [internalPdfUrl]);

  // Reset le flag quand on change de contenu
  useEffect(() => {
    setIframeReady(false);
  }, [htmlContent, pdfUrl, open]);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PrintPreviewModal] impression échouée :', err);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (htmlContent) {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const headerIcon = icon || <FileText size={20} />;

  return (
    <Modal open={open} onClose={onClose} size={size} className="print-preview-modal">
      <ModalHeader icon={headerIcon} onClose={onClose}>
        {title}
      </ModalHeader>

      <ModalBody>
        {htmlContent ? (
          <iframe
            ref={iframeRef}
            title={title}
            srcDoc={htmlContent}
            className="print-preview-iframe"
            // allow-same-origin : nécessaire pour `iframe.contentWindow.print()` côté parent.
            // allow-modals : autorise le dialogue d'impression natif.
            // PAS de allow-scripts : empêche les <script> du HTML legacy
            // (ex: window.onload=window.print()) de s'exécuter automatiquement.
            sandbox="allow-same-origin allow-modals"
            onLoad={() => setIframeReady(true)}
          />
        ) : pdfUrl ? (
          <iframe
            ref={iframeRef}
            title={title}
            src={pdfUrl}
            className="print-preview-iframe"
            onLoad={() => setIframeReady(true)}
          />
        ) : (
          <div className="print-preview-empty">Aucun document à afficher.</div>
        )}
        {!iframeReady && (htmlContent || pdfUrl) && (
          <div className="print-preview-loading" aria-live="polite">
            <Loader2 size={18} className="ui-spin" />
            Préparation de l'aperçu…
          </div>
        )}
      </ModalBody>

      <ModalFooter align="end">
        {showPrint && (htmlContent || pdfUrl) && (
          <Button variant="secondary" onClick={handlePrint} disabled={!iframeReady} type="button">
            <Printer size={16} />
            Imprimer
          </Button>
        )}
        {showDownload && (htmlContent || pdfUrl) && (
          <Button
            variant="secondary"
            onClick={handleDownload}
            disabled={!iframeReady}
            type="button"
          >
            <Download size={16} />
            Télécharger
          </Button>
        )}
        <Button variant="primary" onClick={onClose} type="button">
          Fermer
        </Button>
      </ModalFooter>
    </Modal>
  );
}
