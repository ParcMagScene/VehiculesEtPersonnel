import { useEffect, useRef } from 'react';
import { QrCode, Printer, Link as LinkIcon, Download } from 'lucide-react';
import { Button, ModalLayout } from '@/design-system';
import './QRCodeModal.css';

function QRCodeModal({ onClose }) {
  const canvasRef = useRef(null);
  const mobileUrl = `${window.location.origin}/#/mobile`;

  useEffect(() => {
    generateQRCode();
  }, []);

  const generateQRCode = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = 300;
    canvas.width = size;
    canvas.height = size;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(mobileUrl)}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.src = qrApiUrl;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const canvas = canvasRef.current;
    const qrDataUrl = canvas.toDataURL('image/png');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - Accès Mobile eM@g</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 0;
              margin: 0;
            }
            .print-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: 1fr 1fr;
              gap: 8mm;
              width: 190mm;
              height: 277mm;
              page-break-after: avoid;
            }
            .qr-card {
              border: 2px solid #667eea;
              border-radius: 8px;
              padding: 8px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
              page-break-inside: avoid;
              height: 128mm;
            }
            .qr-header {
              text-align: center;
              width: 100%;
              margin-bottom: 6px;
            }
            .qr-logo {
              width: 80px;
              height: 50px;
              margin: 0 auto 6px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-logo img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .qr-header h1 {
              font-size: 16px;
              font-weight: 700;
              color: #667eea;
              margin-bottom: 2px;
            }
            .qr-header h2 {
              font-size: 12px;
              font-weight: 600;
              color: #333;
              margin-bottom: 6px;
            }
            .qr-image-container {
              background: white;
              padding: 10px;
              border-radius: 6px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.1);
              margin: 6px 0;
            }
            .qr-image-container img {
              display: block;
              width: 140px;
              height: 140px;
            }
            .qr-info {
              width: 100%;
              text-align: center;
              margin-top: 6px;
            }
            .qr-url {
              font-family: Monaco, monospace;
              font-size: 8px;
              color: #3b82f6;
              background: white;
              padding: 4px 6px;
              border-radius: 3px;
              border: 1px solid #ddd;
              margin-bottom: 6px;
              word-break: break-all;
            }
            .qr-features {
              font-size: 8px;
              text-align: left;
              color: #555;
              line-height: 1.4;
            }
            .qr-features ul {
              list-style: none;
              padding-left: 0;
            }
            .qr-features li {
              padding: 1px 0;
            }
            .qr-footer {
              width: 100%;
              text-align: center;
              margin-top: 4px;
              font-size: 9px;
              color: #888;
              border-top: 1px solid #eee;
              padding-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${[1, 2, 3, 4].map(() => `
              <div class="qr-card">
                <div class="qr-header">
                  <div class="qr-logo">
                    <img src="/Logos/LogoEmag.png" alt="eM@g Scene" />
                  </div>
                  <h1>eM@g Scene</h1>
                  <h2>Interface Mobile</h2>
                </div>
                <div class="qr-image-container">
                  <img src="${qrDataUrl}" alt="QR Code" />
                </div>
                <div class="qr-info">
                  <div class="qr-url">${mobileUrl}</div>
                  <div class="qr-features">
                    <ul>
                      <li>✓ Consultation des réservations</li>
                      <li>✓ Demandes de réservation</li>
                      <li>✓ Signalement de pannes</li>
                      <li>✓ Demandes d'intervention</li>
                    </ul>
                  </div>
                </div>
                <div class="qr-footer">
                  Scannez avec votre smartphone
                </div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadJPG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Créer un nouveau canvas pour ajouter un fond blanc (JPG ne supporte pas la transparence)
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    // Remplir avec un fond blanc
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Dessiner le QR code par-dessus
    ctx.drawImage(canvas, 0, 0);

    // Convertir en JPG et télécharger
    exportCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'qrcode-emag-mobile.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
  };

  const _handleOverlayClick = (e) => {
    if (e.target.classList.contains('qr-modal-overlay')) {
      onClose();
    }
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="Accès Mobile"
      icon={<QrCode size={20} />}
      size="md"
      className="qr-modal"
      footer={
        <>
          <Button variant="ghost" className="print-button" onClick={handlePrint}>
            <Printer size={20} />
            Imprimer
          </Button>
          <Button variant="ghost" className="print-button" onClick={handleDownloadJPG}>
            <Download size={20} />
            Télécharger JPG
          </Button>
        </>
      }
    >
        <div className="qr-modal-content">
          <div className="qr-code-container">
            <canvas ref={canvasRef} />
          </div>

          <div className="qr-info">
            <h3>Interface Mobile</h3>
            <p className="qr-description">
              Scannez ce QR code avec votre smartphone pour accéder à l'interface mobile de gestion des véhicules.
            </p>

            <div className="qr-url-section">
              <label>
                <LinkIcon size={16} />
                URL d'accès
              </label>
              <div className="qr-url-display">
                {mobileUrl}
              </div>
            </div>

            <div className="qr-legend">
              <h4>Fonctionnalités disponibles :</h4>
              <ul>
                <li>✓ Consultation des réservations</li>
                <li>✓ Création de nouvelles réservations</li>
                <li>✓ Signalement de pannes</li>
                <li>✓ Demandes d'intervention</li>
                <li>✓ Planification d'interventions</li>
              </ul>
            </div>
          </div>
        </div>
    </ModalLayout>
  );
}

export default QRCodeModal;
