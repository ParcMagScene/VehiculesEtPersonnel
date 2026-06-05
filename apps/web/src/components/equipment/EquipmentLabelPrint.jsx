import './EquipmentLabelPrint.css';

import { AlertTriangle, CheckCircle2, Download, Printer, Tag } from 'lucide-react';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useRef, useState } from 'react';

import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader } from '@/design-system';

import { APP_BASE_URL } from './equipmentConstants';
import { analyzeQrBaseUrl } from './qrSafety';

const cleanName = (s) => (s || '').replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"');

const LABEL_FORMATS = [
  { name: 'Auto', width: 0, height: 0, auto: true },
  { name: 'Petit (2×4 cm)', width: 40, height: 20 },
  { name: 'Standard (3×8 cm)', width: 80, height: 30 },
  { name: 'Grand (4×10 cm)', width: 100, height: 40 },
  { name: 'Personnalisé', width: 0, height: 0 },
];

const EXPORT_FORMATS = ['SVG', 'PNG', 'JPG'];

const escSvg = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const EquipmentLabelPrint = ({ equipment, onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWidth, setCustomWidth] = useState(40);
  const [customHeight, setCustomHeight] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [showLogo, setShowLogo] = useState(true);
  const [exportFormat, setExportFormat] = useState('PNG');
  const svgRef = useRef(null);

  // Verrou sécurité : URL embarquée doit être publique HTTPS (pas localhost / IP privée).
  // Calculé AVANT tout early return pour respecter les rules-of-hooks.
  const qrSafety = useMemo(() => analyzeQrBaseUrl(APP_BASE_URL), []);

  if (!equipment) return null;

  const eq = equipment;
  const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;

  const getAutoSize = () => {
    const hasQr = !!qrUrl;
    const hasUid = !!eq.uid;
    const hasSerial = !!(eq.serialNumber || eq.serial_number);
    const refLen = (eq.reference || '').length;
    const uidLen = hasUid ? (eq.uid || '').length + 5 : 0; // "UID: " prefix
    const serialLen = hasSerial ? (eq.serialNumber || eq.serial_number || '').length + 5 : 0;
    const maxTextLen = Math.max(refLen, uidLen, serialLen);
    const textW = maxTextLen * 2.8 + (hasQr ? 22 : 0) + (showLogo ? 15 : 0) + 8;
    const w = Math.min(100, Math.max(45, textW));
    const lines = 1 + (hasUid ? 1 : 0) + (hasSerial ? 1 : 0);
    const h = Math.max(20, lines * 7 + 6 + (showLogo ? 3 : 0));
    return { width: w, height: h };
  };

  const getFormat = () => {
    if (selectedPreset === 0) return getAutoSize();
    if (selectedPreset === LABEL_FORMATS.length - 1)
      return { width: customWidth, height: customHeight };
    return {
      width: LABEL_FORMATS[selectedPreset].width,
      height: LABEL_FORMATS[selectedPreset].height,
    };
  };

  const format = getFormat();

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
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
      if (fmt === 'JPG') {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mimeType = fmt === 'JPG' ? 'image/jpeg' : 'image/png';
      canvas.toBlob(
        (blob) => {
          if (blob)
            downloadBlob(
              blob,
              `etiquette-${eq.reference || eq.uid || 'label'}.${fmt.toLowerCase()}`,
            );
        },
        mimeType,
        0.95,
      );
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleExport = () => {
    if (!qrSafety.safe) {
      // eslint-disable-next-line no-alert
      window.alert(`⛔ Export bloqué — URL non publique : ${APP_BASE_URL}\n\n${qrSafety.reason}`);
      return;
    }
    if (exportFormat === 'SVG') handleExportSVG();
    else handleExportRaster(exportFormat);
  };

  const handlePrint = async () => {
    if (!qrSafety.safe) {
      // eslint-disable-next-line no-alert
      window.alert(
        `⛔ Impression bloquée — URL non publique : ${APP_BASE_URL}\n\n${qrSafety.reason}`,
      );
      return;
    }
    const labels = [];
    const qrSize = Math.round(format.height - 4);
    const qrDataUrl = qrUrl ? await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 }) : null;

    for (let i = 0; i < quantity; i++) {
      labels.push(
        '<div class="label" style="width: ' +
          format.width +
          'mm; height: ' +
          format.height +
          'mm;">' +
          '<div class="label-content">' +
          (showLogo
            ? '<div class="label-logo"><img src="/Logos/logo_Noir_Transp.png" alt="Logo" /></div>'
            : '') +
          '<div class="label-info">' +
          '<div class="label-ref">' +
          escSvg(eq.reference || '') +
          '</div>' +
          (eq.uid ? '<div class="label-uid"><b>UID: ' + escSvg(eq.uid) + '</b></div>' : '') +
          (eq.serialNumber || eq.serial_number
            ? '<div class="label-serial"><b>S/N: ' +
              escSvg(eq.serialNumber || eq.serial_number) +
              '</b></div>'
            : '') +
          '</div>' +
          '<div class="label-qr">' +
          (qrUrl ? '<img src="' + qrDataUrl + '" alt="QR" />' : '') +
          '</div>' +
          '</div>' +
          '</div>',
      );
    }

    const htmlContent =
      '<!DOCTYPE html><html><head><title>Etiquettes - ' +
      escSvg(eq.reference || cleanName(eq.name)) +
      '</title>' +
      '<style>' +
      '@page { size: A4; margin: 5mm; }' +
      '* { margin: 0; padding: 0; box-sizing: border-box; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, monospace; display: flex; flex-wrap: wrap; gap: 2mm; padding: 5mm; align-content: flex-start; }' +
      '.label { border: 0.5px dashed #999; border-radius: 2px; overflow: hidden; page-break-inside: avoid; }' +
      '.label-content { display: flex; flex-direction: row; align-items: center; width: 100%; height: 100%; padding: 1.5mm; gap: 2mm; }' +
      '.label-logo { flex-shrink: 0; display: flex; align-items: center; }' +
      '.label-logo img { height: ' +
      qrSize +
      'mm; width: auto; }' +
      '.label-qr { flex-shrink: 0; }' +
      '.label-qr img { width: ' +
      qrSize +
      'mm; height: ' +
      qrSize +
      'mm; }' +
      '.label-info { flex: 0 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; }' +
      '.label-ref { font-weight: 800; font-size: ' +
      (format.height < 25 ? '8' : format.height < 35 ? '10' : '12') +
      'pt; line-height: 1.1; white-space: nowrap; }' +
      '.label-uid, .label-serial { font-size: ' +
      (format.height < 25 ? '6' : format.height < 35 ? '7.5' : '9') +
      'pt; color: #222; font-family: monospace; font-weight: 700; line-height: 1.1; white-space: nowrap; }' +
      '</style></head><body>' +
      labels.join('') +
      '</body></html>';

    // Utiliser un iframe caché pour éviter le bloqueur de popups
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    };
  };

  const qrPreviewSize = Math.min(format.height * 2.2, 55);

  return (
    <Modal open onClose={onClose} size="lg" className="elp-modal">
      <ModalHeader icon={<Tag size={18} />} onClose={onClose}>
        Étiquette — {eq.reference || cleanName(eq.name)}
      </ModalHeader>

      <ModalBody>
        <div className={`elp-qr-safety ${qrSafety.safe ? 'ok' : 'danger'}`}>
          {qrSafety.safe ? (
            <>
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>
                QR &rarr;{' '}
                <code>
                  {APP_BASE_URL}/#/mobile/equipment/{eq.uid || '<UID>'}
                </code>
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>⛔ Bloqué — URL non publique</strong>
                <div>{qrSafety.reason}</div>
                <div>
                  Ouvrez <code>https://magsav.duckdns.org</code> avant d'imprimer/exporter.
                </div>
              </div>
            </>
          )}
        </div>
        <div className="elp-preview-container">
          <h4>Aperçu</h4>
          <div
            className="elp-label-preview"
            ref={svgRef}
            style={{
              width: format.width * 3 + 'px',
              height: format.height * 3 + 'px',
              maxWidth: '100%',
            }}
          >
            <div
              className="elp-label-content"
              style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}
            >
              {showLogo && (
                <div className="elp-label-logo">
                  <img
                    src="/Logos/logo_Noir_Transp.png"
                    alt="Logo"
                    style={{ height: qrPreviewSize + 'px', width: 'auto' }}
                  />
                </div>
              )}
              <div className="elp-label-info">
                <div className="elp-label-ref">{eq.reference || '—'}</div>
                {eq.uid && (
                  <div className="elp-label-uid">
                    <strong>UID: {eq.uid}</strong>
                  </div>
                )}
                {(eq.serialNumber || eq.serial_number) && (
                  <div className="elp-label-serial">
                    <strong>S/N: {eq.serialNumber || eq.serial_number}</strong>
                  </div>
                )}
              </div>
              <div className="elp-label-qr">
                {qrUrl && <QRCodeSVG value={qrUrl} size={qrPreviewSize} level="M" />}
              </div>
            </div>
          </div>
          <span className="elp-dimensions">
            {format.width} × {format.height} mm{selectedPreset === 0 ? ' (auto)' : ''}
          </span>
        </div>

        <div className="elp-settings">
          <div className="elp-field">
            <label>Format :</label>
            <div className="elp-format-options">
              {LABEL_FORMATS.map((f, i) => (
                <Button
                  variant="ghost"
                  key={i}
                  className={'elp-format-btn ' + (selectedPreset === i ? 'active' : '')}
                  onClick={() => setSelectedPreset(i)}
                >
                  {f.name}
                </Button>
              ))}
            </div>
          </div>

          {selectedPreset === LABEL_FORMATS.length - 1 && (
            <div className="elp-custom-size">
              <div className="elp-field-inline">
                <label>Largeur (mm) :</label>
                <Input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Math.max(15, parseInt(e.target.value) || 15))}
                  min={15}
                  max={200}
                />
              </div>
              <div className="elp-field-inline">
                <label>Hauteur (mm) :</label>
                <Input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Math.max(10, parseInt(e.target.value) || 10))}
                  min={10}
                  max={100}
                />
              </div>
            </div>
          )}

          <div className="elp-field-inline">
            <label>Logo entreprise :</label>
            <div className="elp-toggle-group">
              <Button
                variant="ghost"
                className={'elp-toggle-btn ' + (showLogo ? 'active' : '')}
                onClick={() => setShowLogo(true)}
              >
                Avec
              </Button>
              <Button
                variant="ghost"
                className={'elp-toggle-btn ' + (!showLogo ? 'active' : '')}
                onClick={() => setShowLogo(false)}
              >
                Sans
              </Button>
            </div>
          </div>

          <div className="elp-field-inline">
            <label>Quantité :</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
              }
              min={1}
              max={100}
            />
          </div>

          <div className="elp-field-inline">
            <label>Export :</label>
            <div className="elp-toggle-group">
              {EXPORT_FORMATS.map((f) => (
                <Button
                  variant="ghost"
                  key={f}
                  className={'elp-toggle-btn ' + (exportFormat === f ? 'active' : '')}
                  onClick={() => setExportFormat(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={!qrSafety.safe}
          title={qrSafety.safe ? undefined : qrSafety.reason}
        >
          <Download size={16} />
          {exportFormat}
        </Button>
        <Button
          variant="primary"
          onClick={handlePrint}
          disabled={!qrSafety.safe}
          title={qrSafety.safe ? undefined : qrSafety.reason}
        >
          <Printer size={16} />
          Imprimer {quantity > 1 ? '(' + quantity + ')' : ''}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default EquipmentLabelPrint;
