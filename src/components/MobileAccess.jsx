import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Link as LinkIcon, QrCode, Copy, Check } from 'lucide-react';
import './MobileAccess.css';

function MobileAccess() {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  
  // URL de l'interface mobile - utiliser DuckDNS pour l'accès externe
  const mobileUrl = `http://magsav.duckdns.org:4173/#/mobile`;
  
  // Générer le QR code au chargement
  useEffect(() => {
    generateQRCode();
  }, []);

  const generateQRCode = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Utiliser une bibliothèque QR code simple en pur JS
    // Pour simplifier, on va créer un lien vers une API de génération de QR code
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(mobileUrl)}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.src = qrApiUrl;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mobileUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mobile-access">
      <div className="access-header">
        <div className="header-icon">
          <Smartphone size={32} />
        </div>
        <h2>Accès Mobile</h2>
        <p>Partagez cette interface avec les utilisateurs mobiles</p>
      </div>

      <div className="access-content">
        <div className="qr-section">
          <div className="qr-container">
            <canvas ref={canvasRef} />
          </div>
          <p className="qr-instructions">
            <QrCode size={20} />
            Scannez ce QR code avec votre smartphone
          </p>
        </div>

        <div className="url-section">
          <label>
            <LinkIcon size={18} />
            URL de l'interface mobile
          </label>
          <div className="url-input-group">
            <input
              type="text"
              value={mobileUrl}
              readOnly
              onClick={(e) => e.target.select()}
            />
            <button onClick={copyToClipboard} className="copy-button">
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
          <p className="url-hint">Cliquez pour copier l'URL</p>
        </div>

        <div className="features-section">
          <h3>Fonctionnalités mobiles</h3>
          <ul>
            <li>✅ Interface optimisée pour smartphone</li>
            <li>✅ Créer des réservations de véhicules</li>
            <li>✅ Demander des interventions</li>
            <li>✅ Signaler des pannes</li>
            <li>✅ Consulter les réservations actives</li>
            <li>✅ Suivre les interventions en cours</li>
          </ul>
        </div>

        <div className="access-info">
          <p>
            <strong>Note :</strong> Les utilisateurs doivent disposer d'un compte 
            autorisé pour accéder à l'interface mobile. Gérez les accès dans 
            l'onglet "Utilisateurs".
          </p>
        </div>
      </div>
    </div>
  );
}

export default MobileAccess;
