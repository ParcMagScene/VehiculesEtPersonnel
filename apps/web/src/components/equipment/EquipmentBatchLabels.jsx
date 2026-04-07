import { useState, useMemo } from 'react';
import { Tag, CheckSquare, Square, Printer, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './EquipmentBatchLabels.css';
import { Button, SearchBar } from '@/design-system';

const cleanName = (s) => (s || '').replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"');

const PAGE_SIZE_MM = 200; // 200×200 mm
const LABEL_GAP_MM = 2;

const APP_BASE_URL = window.location.origin;

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const EquipmentBatchLabels = ({ equipment = [], _onPrintSingle }) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [collapsedRefs, setCollapsedRefs] = useState(new Set());

  // Grouper par référence
  const groupedByRef = useMemo(() => {
    const groups = {};
    equipment.forEach(eq => {
      const ref = eq.reference || '(Sans référence)';
      if (!groups[ref]) groups[ref] = [];
      groups[ref].push(eq);
    });
    // Trier par référence
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [equipment]);

  // Filtrer
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedByRef;
    const q = search.toLowerCase();
    return groupedByRef
      .map(([ref, items]) => {
        if (ref.toLowerCase().includes(q)) return [ref, items];
        const filtered = items.filter(eq =>
          (eq.name || '').toLowerCase().includes(q) ||
          (eq.uid || '').toLowerCase().includes(q) ||
          (eq.serialNumber || eq.serial_number || '').toLowerCase().includes(q)
        );
        if (filtered.length > 0) return [ref, filtered];
        return null;
      })
      .filter(Boolean);
  }, [groupedByRef, search]);

  const totalSelected = selectedIds.size;
  const totalEquipment = equipment.length;

  const toggleRef = (ref, items) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = items.every(eq => next.has(eq.id));
      items.forEach(eq => {
        if (allSelected) next.delete(eq.id);
        else next.add(eq.id);
      });
      return next;
    });
  };

  const toggleSingle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === totalEquipment) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(equipment.map(e => e.id)));
    }
  };

  const toggleCollapse = (ref) => {
    setCollapsedRefs(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  // Calculer la disposition optimale pour 200×200mm
  const calcLayout = () => {
    // Chaque étiquette : 8 cm × 2 cm
    const labelW = 80; // mm
    const labelH = 20; // mm
    const cols = Math.floor((PAGE_SIZE_MM + LABEL_GAP_MM) / (labelW + LABEL_GAP_MM));
    const rows = Math.floor((PAGE_SIZE_MM + LABEL_GAP_MM) / (labelH + LABEL_GAP_MM));
    return { labelW, labelH, cols, rows, perPage: cols * rows };
  };

  const handlePrintBatch = () => {
    const selected = equipment.filter(eq => selectedIds.has(eq.id));
    if (selected.length === 0) return;

    const layout = calcLayout();
    const pages = [];
    const qrSize = Math.round(layout.labelH - 4);

    for (let i = 0; i < selected.length; i += layout.perPage) {
      const pageItems = selected.slice(i, i + layout.perPage);
      const labels = pageItems.map(eq => {
        const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;
        return (
          '<div class="batch-label" style="width:' + layout.labelW + 'mm; height:' + layout.labelH + 'mm;">' +
            '<div class="batch-label-inner">' +
              (showLogo ? '<div class="batch-logo"><img src="/Logos/logo_Noir_Transp.png" alt="" /></div>' : '') +
              '<div class="batch-info">' +
                '<div class="batch-ref">' + escHtml(eq.reference || '') + '</div>' +
                (eq.uid ? '<div class="batch-uid"><b>UID: ' + escHtml(eq.uid) + '</b></div>' : '') +
                ((eq.serialNumber || eq.serial_number) ? '<div class="batch-sn"><b>S/N: ' + escHtml(eq.serialNumber || eq.serial_number) + '</b></div>' : '') +
              '</div>' +
              (qrUrl ? '<div class="batch-qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrUrl) + '" alt="QR" /></div>' : '') +
            '</div>' +
          '</div>'
        );
      }).join('');

      pages.push(
        '<div class="batch-page">' +
          '<div class="batch-grid">' + labels + '</div>' +
        '</div>'
      );
    }

    const htmlContent =
      '<!DOCTYPE html><html><head><title>Étiquettes lot - ' + selected.length + ' matériels</title>' +
      '<style>' +
        '@page { size: A4; margin: 5mm; }' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: -apple-system, BlinkMacSystemFont, monospace; }' +
        '.batch-page { width: 210mm; min-height: 297mm; padding: 5mm; page-break-after: always; }' +
        '.batch-page:last-child { page-break-after: auto; }' +
        '.batch-grid { display: flex; flex-wrap: wrap; gap: ' + LABEL_GAP_MM + 'mm; align-content: flex-start; }' +
        '.batch-label { border: 0.3px dashed #999; border-radius: 1px; overflow: hidden; }' +
        '.batch-label-inner { display: flex; flex-direction: row; align-items: center; width: 100%; height: 100%; padding: 1.5mm; gap: 2mm; }' +
        '.batch-logo { flex-shrink: 0; display: flex; align-items: center; }' +
        '.batch-logo img { height: ' + qrSize + 'mm; width: auto; }' +
        '.batch-qr { flex-shrink: 0; }' +
        '.batch-qr img { width: ' + qrSize + 'mm; height: ' + qrSize + 'mm; }' +
        '.batch-info { flex: 0 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; }' +
        '.batch-ref { font-weight: 800; font-size: 10pt; line-height: 1.1; white-space: nowrap; }' +
        '.batch-uid, .batch-sn { font-size: 7.5pt; font-weight: 700; line-height: 1.1; white-space: nowrap; font-family: monospace; }' +
      '</style></head><body>' +
      pages.join('') +
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

  const handleExportBatchSVG = () => {
    const selected = equipment.filter(eq => selectedIds.has(eq.id));
    if (selected.length === 0) return;
    
    const layout = calcLayout();
    const sc = 10; // 1mm = 10 units in SVG
    const pageW = PAGE_SIZE_MM * sc;
    const pageH = PAGE_SIZE_MM * sc;
    const lw = layout.labelW * sc;
    const lh = layout.labelH * sc;
    const gap = LABEL_GAP_MM * sc;
    const qrSz = (layout.labelH - 4) * sc;

    let svgContent = '';
    let col = 0, row = 0;

    selected.forEach((eq) => {
      const x = 20 + col * (lw + gap);
      const y = 20 + row * (lh + gap);
      
      let labelSvg = '<g transform="translate(' + x + ',' + y + ')">';
      labelSvg += '<rect width="' + lw + '" height="' + lh + '" fill="none" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2,2" />';
      
      let _textX = 10;
      let textY = showLogo ? 30 : 15;
      
      if (showLogo) {
        labelSvg += '<text x="' + (lw/2) + '" y="12" text-anchor="middle" font-size="8" fill="#333">' + (window.__COMPANY_LABEL || 'eM@g') + '</text>';
      }
      
      // Reference
      labelSvg += '<text x="' + (qrSz + 20) + '" y="' + textY + '" font-size="14" font-weight="800" fill="#1e293b">' + escHtml(eq.reference || '') + '</text>';
      textY += 16;
      
      if (eq.uid) {
        labelSvg += '<text x="' + (qrSz + 20) + '" y="' + textY + '" font-size="9" font-weight="700" fill="#444" font-family="monospace">UID: ' + escHtml(eq.uid) + '</text>';
        textY += 12;
      }
      
      if (eq.serialNumber || eq.serial_number) {
        labelSvg += '<text x="' + (qrSz + 20) + '" y="' + textY + '" font-size="9" font-weight="700" fill="#444" font-family="monospace">S/N: ' + escHtml(eq.serialNumber || eq.serial_number) + '</text>';
      }
      
      labelSvg += '</g>';
      svgContent += labelSvg;
      
      col++;
      if (col >= layout.cols) { col = 0; row++; }
    });

    const svg = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + pageW + '" height="' + pageH + '" viewBox="0 0 ' + pageW + ' ' + pageH + '">' +
      '<rect width="' + pageW + '" height="' + pageH + '" fill="white" />' +
      svgContent +
      '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'etiquettes-lot-' + selected.length + '.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ebl-container">
      {/* Barre de sélection */}
      <div className="ebl-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Rechercher par référence, nom, UID..." size="sm" />

        <Button variant="ghost" className="ebl-select-all" onClick={selectAll}>
          {selectedIds.size === totalEquipment ? <CheckSquare size={14} /> : <Square size={14} />}
          {selectedIds.size === totalEquipment ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>

        <div className="ebl-logo-toggle">
          <span>Logo entreprise :</span>
          <Button variant="ghost" className={`ebl-toggle-btn ${showLogo ? 'active' : ''}`} onClick={() => setShowLogo(true)}>Avec</Button>
          <Button variant="ghost" className={`ebl-toggle-btn ${!showLogo ? 'active' : ''}`} onClick={() => setShowLogo(false)}>Sans</Button>
        </div>

        <div className="ebl-toolbar-actions">
          <Button variant="ghost" className="ebl-btn-export" onClick={handleExportBatchSVG} disabled={totalSelected === 0}>
            <Download size={16} />
            Exporter (200 × 200 mm) {totalSelected > 0 ? `— ${totalSelected}` : ''}
          </Button>
          <Button variant="ghost" className="ebl-btn-print" onClick={handlePrintBatch} disabled={totalSelected === 0}>
            <Printer size={16} />
            Imprimer (A4) {totalSelected > 0 ? `— ${totalSelected} étiquette${totalSelected > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>

      {/* Info sélection */}
      <div className="ebl-selection-info">
        <Tag size={14} />
        <span>{totalSelected} matériel{totalSelected > 1 ? 's' : ''} sélectionné{totalSelected > 1 ? 's' : ''}</span>
        <span className="ebl-page-info">
          ({Math.ceil(totalSelected / calcLayout().perPage) || 0} page{Math.ceil(totalSelected / calcLayout().perPage) > 1 ? 's' : ''} A4)
        </span>
      </div>

      {/* Liste par référence */}
      <div className="ebl-list">
        {filteredGroups.map(([ref, items]) => {
          const allChecked = items.every(eq => selectedIds.has(eq.id));
          const someChecked = items.some(eq => selectedIds.has(eq.id));
          const collapsed = collapsedRefs.has(ref);

          return (
            <div key={ref} className="ebl-group">
              <div className="ebl-group-header" onClick={() => toggleCollapse(ref)}>
                <Button variant="ghost" className="ebl-collapse-btn">
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </Button>
                <Button variant="ghost"                   className={`ebl-checkbox ${allChecked ? 'checked' : someChecked ? 'partial' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleRef(ref, items); }}
                >
                  {allChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                </Button>
                <span className="ebl-group-ref">{ref}</span>
                <span className="ebl-group-count">{items.length} unité{items.length > 1 ? 's' : ''}</span>
              </div>
              {!collapsed && (
                <div className="ebl-group-items">
                  {items.map(eq => (
                    <div key={eq.id} className={`ebl-item ${selectedIds.has(eq.id) ? 'selected' : ''}`}>
                      <Button variant="ghost"                         className={`ebl-checkbox ${selectedIds.has(eq.id) ? 'checked' : ''}`}
                        onClick={() => toggleSingle(eq.id)}
                      >
                        {selectedIds.has(eq.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                      </Button>
                      <div className="ebl-item-info">
                        {eq.uid && <span className="ebl-uid">UID: {eq.uid}</span>}
                        {(eq.serialNumber || eq.serial_number) && <span className="ebl-sn">S/N: {eq.serialNumber || eq.serial_number}</span>}
                        {eq.name && <span className="ebl-name">{cleanName(eq.name)}</span>}
                      </div>
                      {/* Mini-aperçu */}
                      <div className="ebl-mini-preview">
                        <div className="ebl-mini-label">
                          {showLogo && <img src="/Logos/logo_Noir_Transp.png" alt="" className="ebl-mini-logo" />}
                          <div>
                            <div className="ebl-mini-ref">{eq.reference}</div>
                            {eq.uid && <div className="ebl-mini-uid"><b>{eq.uid}</b></div>}
                          </div>
                          <QRCodeSVG value={eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : '#'} size={24} level="L" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default EquipmentBatchLabels;
