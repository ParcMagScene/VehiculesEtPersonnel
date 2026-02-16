import React, { useState, useRef } from 'react';
import { X, Printer, Settings, Tag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './EquipmentLabelPrint.css';

// Format par défaut : 2x4 cm
const DEFAULT_FORMAT = { width: 40, height: 20 }; // en mm

const LABEL_FORMATS = [
  { name: 'Petit (2×4 cm)', width: 40, height: 20 },
  { name: 'Moyen (3×5 cm)', width: 50, height: 30 },
  { name: 'Grand (4×7 cm)', width: 70, height: 40 },
  { name: 'Personnalisé', width: 0, height: 0 },
];

const APP_BASE_URL = (() => {
  const origin = window.location.origin;
  if (origin.includes('magsav.duckdns.org')) return origin;
  return 'http://magsav.duckdns.org:4173';
})();

const EquipmentLabelPrint = ({ equipment, onClose }) => {
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState(40);
  const [customHeight, setCustomHeight] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const previewRef = useRef(null);

  if (!equipment) return null;

  const eq = equipment;
  const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;
  const qrSize = Math.min(format.width, format.height) * 2.5; // Taille QR relative au label

  const handlePresetChange = (idx) => {
    setSelectedPreset(idx);
    if (idx < LABEL_FORMATS.length - 1) {
      setFormat({ width: LABEL_FORMATS[idx].width, height: LABEL_FORMATS[idx].height });
    } else {
      setFormat({ width: customWidth, height: customHeight });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const labels = [];

    for (let i = 0; i < quantity; i++) {
      labels.push(`
        <div class="label" style="width: ${format.width}mm; height: ${format.height}mm;">
          <div class="label-content">
            <div class="label-qr">
              ${qrUrl ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}" alt="QR" />` : ''}
            </div>
            <div class="label-info">
              <div class="label-ref">${eq.reference || ''}</div>
              ${eq.uid ? `<div class="label-uid">UID: ${eq.uid}</div>` : ''}
              ${(eq.serialNumber || eq.serial_number) ? `<div class="label-serial">S/N: ${eq.serialNumber || eq.serial_number}</div>` : ''}
              <div class="label-name">${eq.name || ''}</div>
            </div>
          </div>
        </div>
      `);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Étiquettes - ${eq.reference || eq.name}</title>
          <style>
            @page {
              size: A4;
              margin: 5mm;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
              display: flex;
              flex-wrap: wrap;
              gap: 2mm;
              padding: 5mm;
              align-content: flex-start;
            }
            .label {
              border: 0.5px dashed #ccc;
              border-radius: 2px;
              overflow: hidden;
              page-break-inside: avoid;
              display: flex;
              align-items: center;
            }
            .label-content {
              display: flex;
              align-items: center;
              gap: 2mm;
              padding: 1.5mm;
              width: 100%;
              height: 100%;
            }
            .label-qr {
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label-qr img {
              width: ${Math.max(12, format.height - 4)}mm;
              height: ${Math.max(12, format.height - 4)}mm;
            }
            .label-info {
              flex: 1;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 0.3mm;
            }
            .label-ref {
              font-weight: 800;
              font-size: ${format.height < 25 ? '7' : '9'}pt;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-uid {
              font-size: ${format.height < 25 ? '5' : '6'}pt;
              color: #555;
              font-family: monospace;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-serial {
              font-size: ${format.height < 25 ? '5' : '6'}pt;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-name {
              font-size: ${format.height < 25 ? '5' : '7'}pt;
              color: #888;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            @media print {
              .label { border-color: transparent; }
            }
          </style>
        </head>
        <body>
          ${labels.join('')}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="elp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="elp-modal">
        <div className="elp-header">
          <div className="elp-header-title">
            <Tag size={18} />
            <span>Impression d'étiquette</span>
          </div>
          <button className="elp-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="elp-body">
          {/* Aperçu */}
          <div className="elp-preview-container">
            <h4>Aperçu</h4>
            <div
              className="elp-label-preview"
              ref={previewRef}
              style={{
                width: `${format.width * 3}px`,
                height: `${format.height * 3}px`,
                maxWidth: '100%',
              }}
            >
              <div className="elp-label-content">
                <div className="elp-label-qr">
                  {qrUrl && <QRCodeSVG value={qrUrl} size={Math.min(format.height * 2.5, 80)} level="M" />}
                </div>
                <div className="elp-label-info">
                  <div className="elp-label-ref">{eq.reference || '—'}</div>
                  {eq.uid && <div className="elp-label-uid">UID: {eq.uid}</div>}
                  {(eq.serialNumber || eq.serial_number) && (
                    <div className="elp-label-serial">S/N: {eq.serialNumber || eq.serial_number}</div>
                  )}
                  <div className="elp-label-name">{eq.name}</div>
                </div>
              </div>
            </div>
            <span className="elp-dimensions">{format.width} × {format.height} mm</span>
          </div>

          {/* Paramètres */}
          <div className="elp-settings">
            <div className="elp-field">
              <label>Format :</label>
              <div className="elp-format-options">
                {LABEL_FORMATS.map((f, i) => (
                  <button
                    key={i}
                    className={`elp-format-btn ${selectedPreset === i ? 'active' : ''}`}
                    onClick={() => handlePresetChange(i)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedPreset === LABEL_FORMATS.length - 1 && (
              <div className="elp-custom-size">
                <div className="elp-field-inline">
                  <label>Largeur (mm) :</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 20;
                      setCustomWidth(v);
                      setFormat(f => ({ ...f, width: v }));
                    }}
                    min={15}
                    max={200}
                  />
                </div>
                <div className="elp-field-inline">
                  <label>Hauteur (mm) :</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 15;
                      setCustomHeight(v);
                      setFormat(f => ({ ...f, height: v }));
                    }}
                    min={10}
                    max={100}
                  />
                </div>
              </div>
            )}

            <div className="elp-field-inline">
              <label>Quantité :</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                min={1}
                max={100}
              />
            </div>
          </div>
        </div>

        <div className="elp-footer">
          <button className="elp-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="elp-btn-print" onClick={handlePrint}>
            <Printer size={16} />
            Imprimer {quantity > 1 ? `(${quantity} étiquettes)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentLabelPrint;
