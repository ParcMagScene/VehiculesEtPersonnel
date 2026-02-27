import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Printer, FileText, ChevronLeft, ChevronRight, Calendar, Download, Filter } from 'lucide-react';
import api from '../utils/api';
import './MaintenanceReportModal.css';

const PERIOD_MODES = [
  { value: 'day', label: 'Journalier' },
  { value: 'week', label: 'Hebdomadaire' },
  { value: 'month', label: 'Mensuel' },
];

const REPORT_TYPES = [
  { value: 'all', label: 'Entrées & Sorties' },
  { value: 'entries', label: 'Entrées uniquement' },
  { value: 'exits', label: 'Sorties uniquement' },
];

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
  } catch {
    return dateStr;
  }
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return format(d, 'dd/MM/yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
};

const formatCost = (cost) => {
  if (cost === null || cost === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cost);
};

export default function MaintenanceReportModal({ isOpen, onClose }) {
  const [periodMode, setPeriodMode] = useState('day');
  const [reportType, setReportType] = useState('all');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  const { start, end, label } = useMemo(() => {
    const d = anchorDate;
    let s, e, lbl;
    if (periodMode === 'day') {
      s = startOfDay(d);
      e = endOfDay(d);
      lbl = format(d, 'EEEE d MMMM yyyy', { locale: fr });
      lbl = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    } else if (periodMode === 'week') {
      s = startOfWeek(d, { weekStartsOn: 1 });
      e = endOfWeek(d, { weekStartsOn: 1 });
      lbl = `Semaine du ${format(s, 'd', { locale: fr })} au ${format(e, 'd MMMM yyyy', { locale: fr })}`;
    } else {
      s = startOfMonth(d);
      e = endOfMonth(d);
      const m = format(d, 'MMMM yyyy', { locale: fr });
      lbl = m.charAt(0).toUpperCase() + m.slice(1);
    }
    return { start: s, end: e, label: lbl };
  }, [anchorDate, periodMode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      const result = await api.getSavTicketReport(startStr, endStr, reportType);
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Erreur chargement rapport:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [start, end, reportType]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  const goPrev = () => {
    if (periodMode === 'day') setAnchorDate(d => subDays(d, 1));
    else if (periodMode === 'week') setAnchorDate(d => subWeeks(d, 1));
    else setAnchorDate(d => subMonths(d, 1));
  };

  const goNext = () => {
    if (periodMode === 'day') setAnchorDate(d => addDays(d, 1));
    else if (periodMode === 'week') setAnchorDate(d => addWeeks(d, 1));
    else setAnchorDate(d => addMonths(d, 1));
  };

  const goToday = () => setAnchorDate(new Date());

  // Catégoriser les tickets dans le rapport
  const reportRows = useMemo(() => {
    return data.map(ticket => {
      const isEntry = ticket.createdAt && 
        new Date(ticket.createdAt) >= start && 
        new Date(ticket.createdAt) <= end;
      const isExit = ticket.resolvedAt && 
        new Date(ticket.resolvedAt) >= start && 
        new Date(ticket.resolvedAt) <= end;

      return {
        ...ticket,
        isEntry,
        isExit,
        entryDate: isEntry ? ticket.createdAt : null,
        exitDate: isExit ? ticket.resolvedAt : null,
        movement: isEntry && isExit ? 'Entrée & Sortie' : isEntry ? 'Entrée' : 'Sortie',
      };
    });
  }, [data, start, end]);

  const totalCost = useMemo(() => {
    return reportRows.reduce((sum, r) => sum + (r.cost || 0), 0);
  }, [reportRows]);

  // Impression
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Maintenance Matériel - ${label}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
          .report-subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 16px; }
          .report-meta { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f3f4f6; padding: 6px 8px; text-align: left; border: 1px solid #d1d5db; font-weight: 600; }
          td { padding: 5px 8px; border: 1px solid #d1d5db; vertical-align: top; }
          tr:nth-child(even) { background: #f9fafb; }
          .entry-badge { color: #059669; font-weight: 600; }
          .exit-badge { color: #dc2626; font-weight: 600; }
          .both-badge { color: #7c3aed; font-weight: 600; }
          .report-footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; border-top: 2px solid #333; padding-top: 8px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Export PDF (via impression navigateur)
  const handleExportPDF = handlePrint;

  if (!isOpen) return null;

  return (
    <div className="mr-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mr-modal" onClick={e => e.stopPropagation()}>
        <div className="mr-header">
          <h2><FileText size={20} /> Rapport Maintenance Matériel</h2>
          <button className="mr-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Toolbar */}
        <div className="mr-toolbar">
          <div className="mr-toolbar-left">
            {PERIOD_MODES.map(m => (
              <button
                key={m.value}
                className={`mr-period-btn ${periodMode === m.value ? 'active' : ''}`}
                onClick={() => setPeriodMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="mr-toolbar-center">
            <button className="mr-nav-btn" onClick={goPrev}><ChevronLeft size={18} /></button>
            <button className="mr-today-btn" onClick={goToday}>Aujourd'hui</button>
            <button className="mr-nav-btn" onClick={goNext}><ChevronRight size={18} /></button>
            <span className="mr-date-label">{label}</span>
          </div>
          <div className="mr-toolbar-right">
            <select className="mr-type-select" value={reportType} onChange={e => setReportType(e.target.value)}>
              {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className="mr-action-btn" onClick={handlePrint} title="Imprimer">
              <Printer size={16} /> Imprimer
            </button>
            <button className="mr-action-btn export" onClick={handleExportPDF} title="Exporter en PDF">
              <Download size={16} /> PDF
            </button>
          </div>
        </div>

        {/* Contenu du rapport */}
        <div className="mr-content">
          {loading ? (
            <div className="mr-loading">Chargement du rapport...</div>
          ) : reportRows.length === 0 ? (
            <div className="mr-empty">Aucune intervention sur cette période</div>
          ) : (
            <div className="mr-table-wrapper">
              <table className="mr-table">
                <thead>
                  <tr>
                    <th>Mouvement</th>
                    <th>Référence</th>
                    <th>Nom du Matériel</th>
                    <th>UID</th>
                    <th>N° de Série</th>
                    <th>Intervention</th>
                    <th>Date d'entrée</th>
                    <th>Date de sortie</th>
                    <th>Créé par</th>
                    <th>Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row, i) => (
                    <tr key={row.id || i}>
                      <td>
                        <span className={`mr-badge ${row.isEntry && row.isExit ? 'both' : row.isEntry ? 'entry' : 'exit'}`}>
                          {row.movement}
                        </span>
                      </td>
                      <td className="mr-mono">{row.equipmentReference || '—'}</td>
                      <td>{row.equipmentName || '—'}</td>
                      <td className="mr-mono">{row.equipmentUid || '—'}</td>
                      <td className="mr-mono">{row.equipmentSerialNumber || '—'}</td>
                      <td className="mr-desc">{row.title}{row.description ? ` — ${row.description}` : ''}</td>
                      <td>{row.entryDate ? formatDate(row.entryDate) : (row.createdAt ? formatDateShort(row.createdAt) : '—')}</td>
                      <td>{row.exitDate ? formatDate(row.exitDate) : '—'}</td>
                      <td>{row.reportedByName || '—'}</td>
                      <td className="mr-cost">{formatCost(row.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mr-summary">
                <span>{reportRows.length} intervention{reportRows.length > 1 ? 's' : ''}</span>
                <span>Coût total : <strong>{formatCost(totalCost)}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Contenu caché pour l'impression */}
        <div style={{ display: 'none' }}>
          <div ref={printRef}>
            <h1>Rapport Maintenance Matériel</h1>
            <p class="report-subtitle">{label} — {REPORT_TYPES.find(t => t.value === reportType)?.label}</p>
            <div class="report-meta">
              <span>Généré le {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
              <span>{reportRows.length} intervention{reportRows.length > 1 ? 's' : ''}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Mouvement</th>
                  <th>Référence</th>
                  <th>Nom du Matériel</th>
                  <th>UID</th>
                  <th>N° de Série</th>
                  <th>Intervention</th>
                  <th>Date d'entrée</th>
                  <th>Date de sortie</th>
                  <th>Créé par</th>
                  <th>Coût</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, i) => (
                  <tr key={row.id || i}>
                    <td>
                      <span className={row.isEntry && row.isExit ? 'both-badge' : row.isEntry ? 'entry-badge' : 'exit-badge'}>
                        {row.movement}
                      </span>
                    </td>
                    <td>{row.equipmentReference || '—'}</td>
                    <td>{row.equipmentName || '—'}</td>
                    <td>{row.equipmentUid || '—'}</td>
                    <td>{row.equipmentSerialNumber || '—'}</td>
                    <td>{row.title}{row.description ? ` — ${row.description}` : ''}</td>
                    <td>{row.entryDate ? formatDate(row.entryDate) : (row.createdAt ? formatDateShort(row.createdAt) : '—')}</td>
                    <td>{row.exitDate ? formatDate(row.exitDate) : '—'}</td>
                    <td>{row.reportedByName || '—'}</td>
                    <td>{formatCost(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div class="report-footer">
              <span>Total : {reportRows.length} intervention{reportRows.length > 1 ? 's' : ''}</span>
              <span>Coût total : {formatCost(totalCost)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
