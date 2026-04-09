import { useEffect, useRef, useState } from 'react';
import { Link as LinkIcon, QrCode, Copy, Check, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './MobileAccess.css';
import { Button, Input } from '@/design-system';

// Fonctionnalités mobiles à afficher sur l'affichette
const MOBILE_FEATURES = [
  { icon: '🚛', label: 'Tableau de bord Parc', desc: 'Vue temps réel des véhicules' },
  { icon: '📅', label: 'Planning interactif', desc: 'Réservations et interventions' },
  { icon: '🚗', label: 'Réservations', desc: 'Créer et suivre vos réservations' },
  { icon: '🔧', label: 'Interventions', desc: 'Demander et suivre les maintenances' },
  { icon: '👥', label: 'Personnel', desc: 'Équipe, compétences et coordonnées' },
  { icon: '💬', label: 'Messagerie', desc: 'Conversations en temps réel' },
  { icon: '📦', label: 'Équipements & SAV', desc: 'Équipements, affectations et tickets' },
  { icon: '🛒', label: 'Commandes', desc: 'Bons de commande et devis' },
  { icon: '📱', label: 'QR Code Équipement', desc: 'Scanner pour accès fiche équipement' },
  { icon: '🔔', label: 'Notifications', desc: 'Alertes messages et mises à jour' },
];

function MobileAccess() {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [posterCount, setPosterCount] = useState(1);
  const [posterFormat, setPosterFormat] = useState('A4');
  
  // URL de l'interface mobile
  const mobileUrl = `${window.location.origin}/#/mobile`;
  
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
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(mobileUrl)}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { ctx.drawImage(img, 0, 0, size, size); };
    img.src = qrApiUrl;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mobileUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─── Impression affichette ───
  const handlePrintPoster = () => {
    const isLandscape = posterFormat === 'A4-paysage';
    const pageSize = isLandscape ? 'A4 landscape' : posterFormat === 'A5' ? 'A5' : 'A4';
    const qrSize = posterFormat === 'A5' ? 120 : 180;
    const titleSize = posterFormat === 'A5' ? '22pt' : '32pt';
    const subSize = posterFormat === 'A5' ? '11pt' : '14pt';
    const featSize = posterFormat === 'A5' ? '9pt' : '11pt';
    const featIconSize = posterFormat === 'A5' ? '11pt' : '14pt';
    const urlSize = posterFormat === 'A5' ? '8pt' : '10pt';

    const featuresHtml = MOBILE_FEATURES.map(f =>
      `<div class="feat"><span class="feat-icon">${f.icon}</span><div><strong>${f.label}</strong><span class="feat-desc">${f.desc}</span></div></div>`
    ).join('');

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(mobileUrl)}`;

    const posters = [];
    for (let i = 0; i < posterCount; i++) {
      posters.push(`
        <div class="poster">
          <div class="poster-header">
            <img src="/Logos/LogoEmag.png" alt="eM@g" class="poster-logo" />
            <div class="poster-titles">
              <h1>Accès Mobile eM@g</h1>
              <p class="poster-subtitle">Scannez le QR code pour accéder à l'application</p>
            </div>
          </div>
          <div class="poster-body">
            <div class="poster-qr-section">
              <div class="qr-frame">
                <img src="${qrUrl}" alt="QR Code" class="qr-img" />
              </div>
              <p class="qr-label">📱 Scannez avec votre smartphone</p>
              <div class="url-box">${mobileUrl}</div>
            </div>
            <div class="poster-features">
              <h2>Fonctionnalités disponibles</h2>
              <div class="features-grid">${featuresHtml}</div>
            </div>
          </div>
          <div class="poster-footer">
            <p>Un compte autorisé est nécessaire pour accéder à l'application.</p>
            <p class="footer-brand">eM@g — Gestion de parc, matériel et planning</p>
          </div>
        </div>
      `);
    }

    const html = `<!DOCTYPE html><html><head>
      <title>Affichette Accès Mobile eM@g</title>
      <style>
        @page { size: ${pageSize}; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .poster {
          width: 100%; min-height: 100vh; padding: ${posterFormat === 'A5' ? '12mm' : '18mm'};
          display: flex; flex-direction: column; page-break-after: always;
          background: white;
        }
        .poster:last-child { page-break-after: auto; }
        .poster-header {
          display: flex; align-items: center; gap: 16px;
          padding-bottom: 14px; border-bottom: 3px solid #6366f1;
          margin-bottom: 18px;
        }
        .poster-logo { height: ${posterFormat === 'A5' ? '50px' : '72px'}; width: auto; }
        .poster-titles { flex: 1; }
        .poster-titles h1 {
          font-size: ${titleSize}; color: #1e293b; font-weight: 800; line-height: 1.1;
        }
        .poster-subtitle {
          font-size: ${subSize}; color: #6366f1; font-weight: 600; margin-top: 4px;
        }
        .poster-body {
          flex: 1; display: flex; gap: 24px; align-items: flex-start;
          ${isLandscape ? 'flex-direction: row;' : 'flex-direction: column; align-items: center;'}
        }
        .poster-qr-section {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          ${isLandscape ? 'flex-shrink: 0;' : ''}
        }
        .qr-frame {
          border: 4px solid #6366f1; border-radius: 16px; padding: 12px;
          background: white; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.2);
        }
        .qr-img { width: ${qrSize}px; height: ${qrSize}px; display: block; }
        .qr-label {
          font-size: ${subSize}; color: #475569; font-weight: 600; text-align: center;
        }
        .url-box {
          font-family: monospace; font-size: ${urlSize}; color: #6366f1;
          background: #f1f5f9; padding: 6px 14px; border-radius: 8px;
          text-align: center; word-break: break-all; font-weight: 600;
        }
        .poster-features { flex: 1; ${isLandscape ? '' : 'width: 100%;'} }
        .poster-features h2 {
          font-size: ${posterFormat === 'A5' ? '13pt' : '16pt'}; color: #1e293b;
          margin-bottom: 12px; padding-bottom: 6px;
          border-bottom: 2px solid #e2e8f0;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .feat {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px; border-radius: 8px; background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .feat-icon { font-size: ${featIconSize}; flex-shrink: 0; }
        .feat strong { display: block; font-size: ${featSize}; color: #1e293b; line-height: 1.2; }
        .feat-desc { font-size: ${posterFormat === 'A5' ? '7pt' : '9pt'}; color: #64748b; }
        .poster-footer {
          margin-top: 18px; padding-top: 10px; border-top: 2px solid #e2e8f0;
          text-align: center;
        }
        .poster-footer p { font-size: ${posterFormat === 'A5' ? '8pt' : '10pt'}; color: #94a3b8; }
        .footer-brand { font-weight: 700; color: #6366f1 !important; margin-top: 4px; }
      </style>
    </head><body>${posters.join('')}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 800);
    };
  };

  return (
    <div className="mobile-access">
      <div className="access-header">
        <div className="header-icon">
          <img src="/Logos/LogoEmag.png" alt="eM@g" className="access-logo-img" />
        </div>
        <h2>Accès Mobile eM@g</h2>
        <p>Partagez cette interface avec les utilisateurs mobiles</p>
      </div>

      <div className="access-content">
        {/* QR code + URL */}
        <div className="qr-section">
          <div className="qr-container">
            <QRCodeSVG value={mobileUrl} size={200} level="M" fgColor="#1e293b" />
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
            <Input type="text" value={mobileUrl} readOnly onClick={(e) => e.target.select()} />
            <Button variant="ghost" onClick={copyToClipboard} className="copy-button">
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </Button>
          </div>
          <p className="url-hint">Cliquez pour copier l'URL</p>
        </div>

        {/* Fonctionnalités */}
        <div className="features-section">
          <h3>Fonctionnalités mobiles</h3>
          <div className="features-grid-preview">
            {MOBILE_FEATURES.map((f, i) => (
              <div key={i} className="feature-item">
                <span className="feature-icon">{f.icon}</span>
                <div className="feature-text">
                  <strong>{f.label}</strong>
                  <span>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Impression affichettes */}
        <div className="poster-section">
          <h3><Printer size={18} /> Imprimer des affichettes</h3>
          <p className="poster-desc">Imprimez des affichettes avec le QR code et les fonctionnalités pour les afficher dans vos locaux.</p>
          
          <div className="poster-options">
            <div className="poster-option-group">
              <label>Format</label>
              <div className="poster-format-btns">
                {[
                  { id: 'A4', label: 'A4 Portrait' },
                  { id: 'A4-paysage', label: 'A4 Paysage' },
                  { id: 'A5', label: 'A5' },
                ].map(f => (
                  <Button variant="ghost"                     key={f.id}
                    className={`poster-format-btn ${posterFormat === f.id ? 'active' : ''}`}
                    onClick={() => setPosterFormat(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="poster-option-group">
              <label>Quantité</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={posterCount}
                onChange={(e) => setPosterCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="poster-qty-input"
              />
            </div>
          </div>

          <Button variant="ghost" className="poster-print-btn" onClick={handlePrintPoster}>
            <Printer size={18} />
            Imprimer {posterCount} affichette{posterCount > 1 ? 's' : ''} ({posterFormat})
          </Button>
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
