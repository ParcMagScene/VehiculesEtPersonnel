import React, { useState, useRef } from 'react';
import { X, Printer, Tag, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './EquipmentLabelPrint.css';

const cleanName = (s) => (s || '').replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"');

const LABEL_FORMATS = [
  { name: 'Auto', width: 0, height: 0, auto: true },
  { name: 'Petit (2×4 cm)', width: 40, height: 20 },
  { name: 'Moyen (3×5 cm)', width: 50, height: 30 },
  { name: 'Grand (4×7 cm)', width: 70, height: 40 },
  { name: 'Personnalisé', width: 0, height: 0 },
];

const EXPORT_FORMATS = ['SVG', 'PNG', 'JPG'];

const APP_BASE_URL = (() => {
  const origin = window.location.origin;
  if (origin.includes('magsav.duckdns.org')) return origin;
  return 'http://magsav.duckdns.org:4173';
})();

const escSvg = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EquipmentLabelPrint = ({ equipment, onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState(40);
  const [customHeight, setCustomHeight] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [showLogo, setShowLogo] = useState(true);
  const [exportFormat, setExportFormat] = useState('PNG');
  const svgRef = useRef(null);

  if (!equipment) return null;

  const eq = equipment;
  const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;

  const getAutoSize = () => {
    const hasQr = !!qrUrl;
    const hasUid = !!eq.uid;
    const hasSerial = !!(eq.serialNumber || eq.serial_number);
    const refLen = (eq.reference || '').length;
    const textW = Math.max(30, refLen * 3 + (hasQr ? 22 : 0) + (showLogo ? 10 : 0));
    const w = Math.min(80, Math.max(35, textW));
    const lines = 1 + (hasUid ? 1 : 0) + (hasSerial ? 1 : 0);
    const h = Math.max(18, lines * 7 + 6 + (showLogo ? 5 : 0));
    return { width: w, height: h };
  };

  const getFormat = () => {
    if (selectedPreset === 0) return getAutoSize();
    if (selectedPreset === LABEL_FORMATS.length - 1) return { width: customWidth, height: customHeight };
    return { width: LABEL_FORMATS[selectedPreset].width, height: LABEL_FORMATS[selectedPreset].height };
  };

  const format = getFormat();

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSVG = () => {
    const svgEl = svgRef.current?.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    downloadBlob(blob, `etiquette-${eq.reference || eq.uid || 'label'}.svg`);
  };

  const handleExportRaster = (fmt) => {
    const svgEl = svgRef.current?.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const sc = 4;
    canvas.width = format.width * 10 * sc;
    canvas.height = format.height * 10 * sc;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      if (fmt === 'JPG') { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mimeType = fmt === 'JPG' ? 'image/jpeg' : 'image/png';
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `etiquette-${eq.reference || eq.uid || 'label'}.${fmt.toLowerCase()}`);
      }, mimeType, 0.95);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleExport = () => {
    if (exportFormat === 'SVG') handleExportSVG();
    else handleExportRaster(exportFormat);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const labels = [];
    const qrSize = Math.max(12, format.height - 6);

    for (let i = 0; i < quantity; i++) {
      labels.push(
        '<div class="label" style="width: ' + format.width + 'mm; height: ' + format.height + 'mm;">' +
          '<div class="label-content">' +
            (showLogo ? '<div class="label-logo"><img src="/Logos/Logo_MAGSCENE_Noir_Transp.png" alt="Mag Scene" /></div>' : '') +
            '<div class="label-main">' +
              '<div class="label-qr">' +
                (qrUrl ? '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrUrl) + '" alt="QR" />' : '') +
              '</div>' +
              '<div class="label-info">' +
                '<div class="label-ref">' + escSvg(eq.reference || '') + '</div>' +
                (eq.uid ? '<div class="label-uid"><b>UID: ' + escSvg(eq.uid) + '</b></div>' : '') +
                ((eq.serialNumber || eq.serial_number) ? '<div class="label-serial"><b>S/N: ' + escSvg(eq.serialNumber || eq.serial_number) + '</b></div>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    printWindow.document.write(
      '<!DOCTYPE html><html><head><title>Etiquettes - ' + escSvg(eq.reference || cleanName(eq.name)) + '</title>' +
      '<style>' +
        '@page { size: A4; margin: 5mm; }' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: -apple-system, BlinkMacSystemFont, monospace; display: flex; flex-wrap: wrap; gap: 2mm; padding: 5mm; align-content: flex-start; }' +
        '.label { border: 0.5px dashed #ccc; border-radius: 2px; overflow: hidden; page-break-inside: avoid; }' +
        '.label-content { display: flex; flex-direction: column; width: 100%; height: 100%; padding: 1.5mm; }' +
        '.label-logo { text-align: center; margin-bottom: 1mm; }' +
        '.label-logo img { height: 3mm; width: auto; }' +
        '.label-main { display: flex; align-items: center; gap: 2mm; flex: 1; }' +
        '.label-qr { flex-shrink: 0; }' +
        '.label-qr img { width: ' + qrSize + 'mm; height: ' + qrSize + 'mm; }' +
        '.label-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 0.3mm; }' +
        '.label-ref { font-weight: 800; font-size: ' + (format.height < 25 ? '7' : '9') + 'pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
        '.label-uid, .label-serial { font-size: ' + (format.height < 25 ? '5.5' : '6.5') + 'pt; color: #222; font-family: monospace; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
        '@media print { .label { border-color: transparent; } }' +
      '</style></head><body>' +
      labels.join('') +
      '<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close()};},500)};<\/script>' +
      '</body></html>'
    );
    printWindow.document.close();
  };

  const qrPreviewSize = Math.min(format.height * 2.5, 70);

  return (
    <div className="elp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="elp-modal">
        <div className="elp-header">
          <div className="elp-header-title">
            <Tag size={18} />
            <span>Étiquette — {eq.reference || cleanName(eq.name)}</span>
          </div>
          <button className="elp-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="elp-body">
          <div className="elp-preview-container">
            <h4>Aperçu</h4>
            <div
              className="elp-label-preview"
              ref={svgRef}
              style={{ width: format.width * 3 + 'px', height: format.height * 3 + 'px', maxWidth: '100%' }}
            >
              <div className="elp-label-content" style={{ flexDirection: 'column' }}>
                {showLogo && (
                  <div className="elp-label-logo">
                    <img src="/Logos/Logo_MAGSCENE_Noir_Transp.png" alt="Mag Scene" style={{ height: Math.min(14, format.height * 0.3) + 'px', width: 'auto' }} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div className="elp-label-qr">
                    {qrUrl && <QRCodeSVG value={qrUrl} size={qrPreviewSize} level="M" />}
                  </div>
                  <div className="elp-label-info">
                    <div className="elp-label-ref">{eq.reference || '—'}</div>
                    {eq.uid && <div className="elp-label-uid"><strong>UID: {eq.uid}</strong></div>}
                    {(eq.serialNumber || eq.serial_number) && (
                      <div className="elp-label-serial"><strong>S/N: {eq.serialNumber || eq.serial_number}</strong></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <span className="elp-dimensions">{format.width} × {format.height} mm{selectedPreset === 0 ? ' (auto)' : ''}</span>
          </div>

          <div className="elp-settings">
            <div className="elp-field">
              <label>Format :</label>
              <div className="elp-format-options">
                {LABEL_FORMATS.map((f, i) => (
                  <button key={i} className={'elp-format-btn ' + (selectedPreset === i ? 'active' : '')} onClick={() => setSelectedPreset(i)}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedPreset === LABEL_FORMATS.length - 1 && (
              <div className="elp-custom-size">
                <div className="elp-field-inline">
                  <label>Largeur (mm) :</label>
                  <input type="number" value={customWidth} onChange={(e) => setCustomWidth(Math.max(15, parseInt(e.target.value) || 15))} min={15} max={200} />
                </div>
                <div className="elp-field-inline">
                  <label>Hauteur (mm) :</label>
                  <input type="number" value={customHeight} onChange={(e) => setCustomHeight(Math.max(10, parseInt(e.target.value) || 10))} min={10} max={100} />
                </div>
              </div>
            )}

            <div className="elp-field-inline">
              <label>Logo Mag Scène :</label>
              <div className="elp-toggle-group">
                <button className={'elp-toggle-btn ' + (showLogo ? 'active' : '')} onClick={() => setShowLogo(true)}>Avec</button>
                <button className={'elp-toggle-btn ' + (!showLogo ? 'active' : '')} onClick={() => setShowLogo(false)}>Sans</button>
              </div>
            </div>

            <div className="elp-field-inline">
              <label>Quantité :</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} min={1} max={100} />
            </div>

            <div className="elp-field-inline">
              <label>Export :</label>
              <div className="elp-toggle-group">
                {EXPORT_FORMATS.map(f => (
                  <button key={f} className={'elp-toggle-btn ' + (exportFormat === f ? 'active' : '')} onClick={() => setExportFormat(f)}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="elp-footer">
          <button className="elp-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="elp-btn-export" onClick={handleExport}>
            <Download size={16} />
            {exportFormat}
          </button>
          <button className="elp-btn-print" onClick={handlePrint}>
            <Printer size={16} />
            Imprimer {quantity > 1 ? '(' + quantity + ')' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentLabelPrint;
