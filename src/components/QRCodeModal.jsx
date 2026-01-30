import React, { useEffect, useRef } from 'react';
import { X, QrCode, Printer, Link as LinkIcon } from 'lucide-react';
import './QRCodeModal.css';

function QRCodeModal({ onClose }) {
  const canvasRef = useRef(null);
  const mobileUrl = 'http://magsav.duckdns.org:4173/#/mobile';

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
    window.print();
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('qr-modal-overlay')) {
      onClose();
    }
  };

  return (
    <div className="qr-modal-overlay" onClick={handleOverlayClick}>
      <div className="qr-modal">
        <div className="qr-modal-header no-print">
          <h2>
            <QrCode size={24} />
            Accès Mobile
          </h2>
          <button className="qr-close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

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

        <div className="qr-modal-footer no-print">
          <button className="print-button" onClick={handlePrint}>
            <Printer size={20} />
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRCodeModal;
