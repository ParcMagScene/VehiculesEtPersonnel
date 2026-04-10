// ═══════════════════════════════════════════════════════════════
// RAPPORTS & EXPORTS — Tableau de bord centralisé
// Exports CSV, synthèses imprimables, statistiques clés
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download, Printer, BarChart3, Calendar,
  Truck, Users, ShoppingCart, Briefcase,
  RefreshCw, Wrench, FileSpreadsheet,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../utils/api';
import './ReportsPanel.css';
import { Button, InlineAlert, SectionHeader, Table, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { STATUS_COLORS, ACCENT_COLORS } from '../../constants/colors';

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

const fmtDate = (d) => {
  if (!d) return '—';
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd/MM/yyyy', { locale: fr }); }
  catch { return String(d); }
};

const fmtCurrency = (n) => {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
};

// CSV export helper
const downloadCSV = (headers, rows, filename) => {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const bom = '\uFEFF'; // UTF-8 BOM for Excel
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Print helper
const openPrintWindow = (title, htmlContent) => {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; }
      h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
      h2 { font-size: 13px; margin: 16px 0 8px; color: #1e40af; }
      .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #f3f4f6; padding: 5px 6px; text-align: left; border: 1px solid #d1d5db; font-weight: 600; }
      td { padding: 4px 6px; border: 1px solid #d1d5db; }
      tr:nth-child(even) { background: #f9fafb; }
      .stat-row { display: flex; gap: 20px; margin-bottom: 12px; }
      .stat { font-size: 12px; }
      .stat strong { font-size: 18px; display: block; }
      .footer { margin-top: 16px; font-size: 10px; color: #888; text-align: right; border-top: 1px solid #ddd; padding-top: 8px; }
      @page { margin: 10mm; }
    </style>
  </head><body>${htmlContent}
    <div class="footer">Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })} — eM@g</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
};

// ═══════════════════════════════════════
// Navigation reports
// ═══════════════════════════════════════

const REPORT_SECTIONS = [
  { id: 'fleet', label: 'Parc véhicules', icon: Truck, color: STATUS_COLORS.info },
  { id: 'maintenance', label: 'Maintenances', icon: Wrench, color: STATUS_COLORS.warning },
  { id: 'personnel', label: 'Personnel', icon: Users, color: STATUS_COLORS.success },
  { id: 'orders', label: 'Commandes', icon: ShoppingCart, color: ACCENT_COLORS.violet },
  { id: 'affaires', label: 'Affaires', icon: Briefcase, color: ACCENT_COLORS.orange },
  { id: 'exports', label: 'Exports CSV', icon: FileSpreadsheet, color: ACCENT_COLORS.cyan },
];

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const ReportsPanel = ({ _currentUser }) => {
  const [section, setSection] = useState('fleet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [persons, setPersons] = useState([]);
  const [orders, setOrders] = useState([]);
  const [affaires, setAffaires] = useState([]);
  const [ordersStats, setOrdersStats] = useState(null);

  // Period filter
  const [periodStart, setPeriodStart] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Load data on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [v, r, m, p, o, a, os] = await Promise.allSettled([
        api.getVehicles(),
        api.getReservations(),
        api.getMaintenances(),
        api.getPersons(),
        api.getOrders(),
        api.getAffaires(),
        api.getOrdersStats(),
      ]);
      setVehicles(v.status === 'fulfilled' ? (v.value || []) : []);
      setReservations(r.status === 'fulfilled' ? (r.value || []) : []);
      setMaintenances(m.status === 'fulfilled' ? (m.value || []) : []);
      setPersons(p.status === 'fulfilled' ? (p.value || []) : []);
      setOrders(o.status === 'fulfilled' ? (o.value || []) : []);
      setAffaires(a.status === 'fulfilled' ? (a.value || []) : []);
      setOrdersStats(os.status === 'fulfilled' ? os.value : null);
    } catch (err) {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ═══════════════════════════════════════
  // Fleet Report
  // ═══════════════════════════════════════

  const fleetReport = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === STATUS.ACTIVE || v.status === STATUS.DISPONIBLE).length;
    const inMaint = vehicles.filter(v => v.status === STATUS.MAINTENANCE).length;
    const byType = {};
    vehicles.forEach(v => {
      const t = v.type || v.category || 'Autre';
      byType[t] = (byType[t] || 0) + 1;
    });
    // Reservations in period
    const periodRes = reservations.filter(r => {
      const start = r.startDate || r.start_date;
      return start && start >= periodStart && start <= periodEnd;
    });
    const totalDays = periodRes.reduce((sum, r) => {
      const s = r.startDate || r.start_date;
      const e = r.endDate || r.end_date;
      if (!s || !e) return sum;
      return sum + Math.max(1, differenceInDays(parseISO(e), parseISO(s)) + 1);
    }, 0);
    const avgUtilization = total > 0 ? Math.round(totalDays / total) : 0;

    return { total, active, inMaint, byType, periodRes, totalDays, avgUtilization };
  }, [vehicles, reservations, periodStart, periodEnd]);

  // ═══════════════════════════════════════
  // Maintenance Report
  // ═══════════════════════════════════════

  const maintReport = useMemo(() => {
    const periodMaint = maintenances.filter(m => {
      const d = m.date || m.startDate || m.start_date || m.createdAt;
      return d && d >= periodStart && d <= periodEnd;
    });
    const totalCost = periodMaint.reduce((sum, m) => sum + (m.cost || m.estimatedCost || 0), 0);
    const completed = periodMaint.filter(m => m.status === STATUS.COMPLETED || m.status === STATUS.DONE).length;
    const pending = periodMaint.filter(m => m.status === STATUS.PENDING || m.status === STATUS.SCHEDULED).length;
    const reported = periodMaint.filter(m => m.status === 'reported').length;
    const byType = {};
    periodMaint.forEach(m => {
      const t = m.type || 'Autre';
      byType[t] = (byType[t] || 0) + 1;
    });
    return { total: periodMaint.length, totalCost, completed, pending, reported, byType, items: periodMaint };
  }, [maintenances, periodStart, periodEnd]);

  // ═══════════════════════════════════════
  // Personnel Report
  // ═══════════════════════════════════════

  const personnelReport = useMemo(() => {
    const total = persons.length;
    const active = persons.filter(p => p.status === STATUS.ACTIVE).length;
    const byType = {};
    persons.forEach(p => {
      const t = p.type || 'Autre';
      byType[t] = (byType[t] || 0) + 1;
    });
    const byContract = {};
    persons.forEach(p => {
      const c = p.contractType || p.contract_type || 'Non précisé';
      byContract[c] = (byContract[c] || 0) + 1;
    });
    return { total, active, inactive: total - active, byType, byContract };
  }, [persons]);

  // ═══════════════════════════════════════
  // Orders Report
  // ═══════════════════════════════════════

  const ordersReport = useMemo(() => {
    const periodOrders = orders.filter(o => {
      const d = o.date || o.createdAt || o.created_at;
      return d && d >= periodStart && d <= periodEnd;
    });
    const totalAmount = periodOrders.reduce((sum, o) => sum + (o.totalAmount || o.total_amount || o.amount || 0), 0);
    const byStatus = {};
    periodOrders.forEach(o => {
      const s = o.status || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    return { total: periodOrders.length, totalAmount, byStatus, items: periodOrders };
  }, [orders, periodStart, periodEnd]);

  // ═══════════════════════════════════════
  // Affaires Report
  // ═══════════════════════════════════════

  const affairesReport = useMemo(() => {
    const periodAffaires = affaires.filter(a => {
      const d = a.date || a.dateDebut || a.date_debut || a.startDate || a.createdAt;
      return d && d >= periodStart && d <= periodEnd;
    });
    const byStatus = {};
    periodAffaires.forEach(a => {
      const s = a.status || a.statut || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    return { total: periodAffaires.length, byStatus, all: affaires.length };
  }, [affaires, periodStart, periodEnd]);

  // ═══════════════════════════════════════
  // CSV Export Handlers
  // ═══════════════════════════════════════

  const exportVehiclesCSV = () => {
    const headers = ['ID', 'Immatriculation', 'Marque', 'Modèle', 'Type', 'Statut', 'Année', 'Kilométrage'];
    const rows = vehicles.map(v => [
      v.id, v.registration || v.immatriculation || '', v.brand || v.marque || '',
      v.model || v.modele || '', v.type || v.category || '', v.status || '',
      v.year || v.annee || '', v.mileage || v.kilometrage || '',
    ]);
    downloadCSV(headers, rows, `vehicules_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportReservationsCSV = () => {
    const headers = ['ID', 'Véhicule', 'Client', 'Début', 'Fin', 'Statut', 'Notes'];
    const rows = reservations.map(r => [
      r.id, r.vehicleName || r.vehicle_name || '', r.clientName || r.client_name || '',
      r.startDate || r.start_date || '', r.endDate || r.end_date || '',
      r.status || '', r.notes || '',
    ]);
    downloadCSV(headers, rows, `reservations_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportMaintenancesCSV = () => {
    const headers = ['ID', 'Véhicule', 'Type', 'Date', 'Statut', 'Coût', 'Description'];
    const rows = maintenances.map(m => [
      m.id, m.vehicleName || m.vehicle_name || m.vehicleRegistration || '',
      m.type || '', m.date || m.startDate || '', m.status || '',
      m.cost || m.estimatedCost || '', m.description || '',
    ]);
    downloadCSV(headers, rows, `maintenances_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportPersonnelCSV = () => {
    const headers = ['ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Type', 'Contrat', 'Statut'];
    const rows = persons.map(p => [
      p.id, p.firstName || p.first_name || '', p.lastName || p.last_name || '',
      p.email || '', p.phone || '', p.type || '',
      p.contractType || p.contract_type || '', p.status || '',
    ]);
    downloadCSV(headers, rows, `personnel_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportOrdersCSV = () => {
    const headers = ['ID', 'Référence', 'Fournisseur', 'Date', 'Statut', 'Montant', 'Notes'];
    const rows = orders.map(o => [
      o.id, o.reference || o.ref || '', o.supplier || o.fournisseur || '',
      o.date || o.createdAt || '', o.status || '',
      o.totalAmount || o.total_amount || o.amount || '', o.notes || '',
    ]);
    downloadCSV(headers, rows, `commandes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportAffairesCSV = () => {
    const headers = ['ID', 'N° Affaire', 'Client', 'Lieu', 'Début', 'Fin', 'Statut'];
    const rows = affaires.map(a => [
      a.id, a.numero || a.number || '', a.client || a.clientName || '',
      a.lieu || a.location || '',
      a.dateDebut || a.date_debut || a.startDate || '',
      a.dateFin || a.date_fin || a.endDate || '',
      a.status || a.statut || '',
    ]);
    downloadCSV(headers, rows, `affaires_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  // ═══════════════════════════════════════
  // Print Reports
  // ═══════════════════════════════════════

  const printFleetReport = () => {
    const html = `
      <h1>Rapport Parc Véhicules</h1>
      <div class="subtitle">${fmtDate(periodStart)} — ${fmtDate(periodEnd)}</div>
      <div class="stat-row">
        <div class="stat"><strong>${fleetReport.total}</strong>Véhicules total</div>
        <div class="stat"><strong>${fleetReport.active}</strong>Actifs</div>
        <div class="stat"><strong>${fleetReport.inMaint}</strong>En maintenance</div>
        <div class="stat"><strong>${fleetReport.avgUtilization}j</strong>Utilisation moy.</div>
      </div>
      <h2>Répartition par type</h2>
      <Table><tr><th>Type</th><th>Nombre</th></tr>
        ${Object.entries(fleetReport.byType).map(([t, n]) => `<tr><td>${t}</td><td>${n}</td></tr>`).join('')}
      </Table>
      <h2>Réservations sur la période (${fleetReport.periodRes.length})</h2>
      <Table><tr><th>Véhicule</th><th>Client</th><th>Début</th><th>Fin</th></tr>
        ${fleetReport.periodRes.slice(0, 50).map(r =>
          `<tr><td>${r.vehicleName || r.vehicle_name || '—'}</td>
           <td>${r.clientName || r.client_name || '—'}</td>
           <td>${fmtDate(r.startDate || r.start_date)}</td>
           <td>${fmtDate(r.endDate || r.end_date)}</td></tr>`
        ).join('')}
      </Table>
    `;
    openPrintWindow('Rapport Parc Véhicules', html);
  };

  const printMaintenanceReport = () => {
    const html = `
      <h1>Rapport Maintenances</h1>
      <div class="subtitle">${fmtDate(periodStart)} — ${fmtDate(periodEnd)}</div>
      <div class="stat-row">
        <div class="stat"><strong>${maintReport.total}</strong>Interventions</div>
        <div class="stat"><strong>${maintReport.completed}</strong>Terminées</div>
        <div class="stat"><strong>${maintReport.pending}</strong>En attente</div>
        <div class="stat"><strong>${fmtCurrency(maintReport.totalCost)}</strong>Coût total</div>
      </div>
      <h2>Par type</h2>
      <Table><tr><th>Type</th><th>Nombre</th></tr>
        ${Object.entries(maintReport.byType).map(([t, n]) => `<tr><td>${t}</td><td>${n}</td></tr>`).join('')}
      </Table>
      <h2>Détail interventions</h2>
      <Table><tr><th>Véhicule</th><th>Type</th><th>Date</th><th>Statut</th><th>Coût</th></tr>
        ${maintReport.items.slice(0, 100).map(m =>
          `<tr><td>${m.vehicleName || m.vehicle_name || m.vehicleRegistration || '—'}</td>
           <td>${m.type || '—'}</td>
           <td>${fmtDate(m.date || m.startDate)}</td>
           <td>${m.status || '—'}</td>
           <td>${fmtCurrency(m.cost || m.estimatedCost)}</td></tr>`
        ).join('')}
      </Table>
    `;
    openPrintWindow('Rapport Maintenances', html);
  };

  const printPersonnelReport = () => {
    const html = `
      <h1>Rapport Personnel</h1>
      <div class="subtitle">Au ${fmtDate(new Date())}</div>
      <div class="stat-row">
        <div class="stat"><strong>${personnelReport.total}</strong>Effectif total</div>
        <div class="stat"><strong>${personnelReport.active}</strong>Actifs</div>
        <div class="stat"><strong>${personnelReport.inactive}</strong>Inactifs</div>
      </div>
      <h2>Par type</h2>
      <Table><tr><th>Type</th><th>Nombre</th></tr>
        ${Object.entries(personnelReport.byType).map(([t, n]) => `<tr><td>${t}</td><td>${n}</td></tr>`).join('')}
      </Table>
      <h2>Par contrat</h2>
      <Table><tr><th>Contrat</th><th>Nombre</th></tr>
        ${Object.entries(personnelReport.byContract).map(([c, n]) => `<tr><td>${c}</td><td>${n}</td></tr>`).join('')}
      </Table>
      <h2>Liste complète</h2>
      <Table><tr><th>Nom</th><th>Type</th><th>Contrat</th><th>Email</th><th>Statut</th></tr>
        ${persons.map(p =>
          `<tr><td>${p.firstName || ''} ${p.lastName || ''}</td>
           <td>${p.type || '—'}</td>
           <td>${p.contractType || p.contract_type || '—'}</td>
           <td>${p.email || '—'}</td>
           <td>${p.status || '—'}</td></tr>`
        ).join('')}
      </Table>
    `;
    openPrintWindow('Rapport Personnel', html);
  };

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════

  return (
    <div className="rp-container">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-header-left">
          <BarChart3 size={22} />
          <h2>Rapports & Exports</h2>
        </div>
        <div className="rp-header-actions">
          <Tooltip content="Rafraîchir les données"><Button variant="ghost" className="rp-btn rp-btn-icon" onClick={loadData}>
            <RefreshCw size={16} />
          </Button></Tooltip>
        </div>
      </div>

      {error && (
        <InlineAlert dismissible onDismiss={() => setError('')}>{error}</InlineAlert>
      )}

      {/* Period filter */}
      <div className="rp-period-filter">
        <Calendar size={14} />
        <label>Période :</label>
        <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
        <span>→</span>
        <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
        <div className="rp-period-presets">
          <Button variant="ghost" onClick={() => { setPeriodStart(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setPeriodEnd(format(new Date(), 'yyyy-MM-dd')); }}>
            Ce mois
          </Button>
          <Button variant="ghost" onClick={() => { const prev = subMonths(new Date(), 1); setPeriodStart(format(startOfMonth(prev), 'yyyy-MM-dd')); setPeriodEnd(format(endOfMonth(prev), 'yyyy-MM-dd')); }}>
            Mois précédent
          </Button>
          <Button variant="ghost" onClick={() => { setPeriodStart(format(startOfYear(new Date()), 'yyyy-MM-dd')); setPeriodEnd(format(new Date(), 'yyyy-MM-dd')); }}>
            Cette année
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="rp-nav">
        {REPORT_SECTIONS.map(s => (
          <Button variant="ghost"             key={s.id}
            className={`rp-nav-btn ${section === s.id ? 'active' : ''}`}
            onClick={() => setSection(s.id)}
            style={{ '--sec-color': s.color }}
          >
            <s.icon size={16} />
            <span>{s.label}</span>
          </Button>
        ))}
      </div>

      {loading && (
        <div className="rp-loading">
          <RefreshCw size={20} className="rp-spin" />
          <span>Chargement des données…</span>
        </div>
      )}

      {/* ═══ FLEET ═══ */}
      {section === 'fleet' && !loading && (
        <div className="rp-section">
          <SectionHeader className="rp-section-header" icon={<Truck size={18} />} title="Synthèse Parc Véhicules" actions={
            <div className="rp-section-actions">
              <Button variant="ghost" className="rp-btn rp-btn-sm" onClick={exportVehiclesCSV}>
                <Download size={14} /> CSV véhicules
              </Button>
              <Button variant="ghost" className="rp-btn rp-btn-sm" onClick={exportReservationsCSV}>
                <Download size={14} /> CSV réservations
              </Button>
              <Button variant="ghost" className="rp-btn rp-btn-sm rp-btn-print" onClick={printFleetReport}>
                <Printer size={14} /> Imprimer
              </Button>
            </div>
          } />

          <div className="rp-kpi-grid">
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.info }}>
              <span className="rp-kpi-val">{fleetReport.total}</span>
              <span className="rp-kpi-lbl">Véhicules</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.success }}>
              <span className="rp-kpi-val">{fleetReport.active}</span>
              <span className="rp-kpi-lbl">Actifs</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.warning }}>
              <span className="rp-kpi-val">{fleetReport.inMaint}</span>
              <span className="rp-kpi-lbl">En maintenance</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: ACCENT_COLORS.violet }}>
              <span className="rp-kpi-val">{fleetReport.periodRes.length}</span>
              <span className="rp-kpi-lbl">Réservations</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: ACCENT_COLORS.cyan }}>
              <span className="rp-kpi-val">{fleetReport.totalDays}j</span>
              <span className="rp-kpi-lbl">Jours réservés</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: ACCENT_COLORS.orange }}>
              <span className="rp-kpi-val">{fleetReport.avgUtilization}j</span>
              <span className="rp-kpi-lbl">Moy. / véhicule</span>
            </div>
          </div>

          {/* Types breakdown */}
          <div className="rp-breakdown">
            <h4>Répartition par type</h4>
            <div className="rp-bar-chart">
              {Object.entries(fleetReport.byType).map(([type, count]) => {
                const max = Math.max(...Object.values(fleetReport.byType), 1);
                return (
                  <div key={type} className="rp-bar-row">
                    <span className="rp-bar-label">{type}</span>
                    <div className="rp-bar-track">
                      <div className="rp-bar-fill" style={{ width: `${(count / max * 100)}%`, background: STATUS_COLORS.info }} />
                    </div>
                    <span className="rp-bar-val">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAINTENANCE ═══ */}
      {section === STATUS.MAINTENANCE && !loading && (
        <div className="rp-section">
          <SectionHeader className="rp-section-header" icon={<Wrench size={18} />} title="Synthèse Maintenances" actions={
            <div className="rp-section-actions">
              <Button variant="ghost" className="rp-btn rp-btn-sm" onClick={exportMaintenancesCSV}>
                <Download size={14} /> CSV
              </Button>
              <Button variant="ghost" className="rp-btn rp-btn-sm rp-btn-print" onClick={printMaintenanceReport}>
                <Printer size={14} /> Imprimer
              </Button>
            </div>
          } />

          <div className="rp-kpi-grid">
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.info }}>
              <span className="rp-kpi-val">{maintReport.total}</span>
              <span className="rp-kpi-lbl">Interventions</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.success }}>
              <span className="rp-kpi-val">{maintReport.completed}</span>
              <span className="rp-kpi-lbl">Terminées</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.warning }}>
              <span className="rp-kpi-val">{maintReport.pending}</span>
              <span className="rp-kpi-lbl">En attente</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.danger }}>
              <span className="rp-kpi-val">{maintReport.reported}</span>
              <span className="rp-kpi-lbl">Signalées</span>
            </div>
            <div className="rp-kpi cost" style={{ borderColor: ACCENT_COLORS.violet }}>
              <span className="rp-kpi-val">{fmtCurrency(maintReport.totalCost)}</span>
              <span className="rp-kpi-lbl">Coût total</span>
            </div>
          </div>

          <div className="rp-breakdown">
            <h4>Par type d'intervention</h4>
            <div className="rp-bar-chart">
              {Object.entries(maintReport.byType).map(([type, count]) => {
                const max = Math.max(...Object.values(maintReport.byType), 1);
                return (
                  <div key={type} className="rp-bar-row">
                    <span className="rp-bar-label">{type}</span>
                    <div className="rp-bar-track">
                      <div className="rp-bar-fill" style={{ width: `${(count / max * 100)}%`, background: STATUS_COLORS.warning }} />
                    </div>
                    <span className="rp-bar-val">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent items table */}
          {maintReport.items.length > 0 && (
            <div className="rp-table-section">
              <h4>Dernières interventions</h4>
              <div className="rp-table-wrapper">
                <Table className="rp-table">
                  <thead>
                    <tr>
                      <th>Véhicule</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Coût</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintReport.items.slice(0, 20).map((m, i) => (
                      <tr key={i}>
                        <td>{m.vehicleName || m.vehicle_name || m.vehicleRegistration || '—'}</td>
                        <td>{m.type || '—'}</td>
                        <td>{fmtDate(m.date || m.startDate)}</td>
                        <td><span className={`rp-status ${m.status}`}>{m.status}</span></td>
                        <td>{fmtCurrency(m.cost || m.estimatedCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PERSONNEL ═══ */}
      {section === 'personnel' && !loading && (
        <div className="rp-section">
          <SectionHeader className="rp-section-header" icon={<Users size={18} />} title="Synthèse Personnel" actions={
            <div className="rp-section-actions">
              <Button variant="ghost" className="rp-btn rp-btn-sm" onClick={exportPersonnelCSV}>
                <Download size={14} /> CSV
              </Button>
              <Button variant="ghost" className="rp-btn rp-btn-sm rp-btn-print" onClick={printPersonnelReport}>
                <Printer size={14} /> Imprimer
              </Button>
            </div>
          } />

          <div className="rp-kpi-grid">
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.success }}>
              <span className="rp-kpi-val">{personnelReport.total}</span>
              <span className="rp-kpi-lbl">Effectif total</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.info }}>
              <span className="rp-kpi-val">{personnelReport.active}</span>
              <span className="rp-kpi-lbl">Actifs</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: 'var(--theme-text-gray)' }}>
              <span className="rp-kpi-val">{personnelReport.inactive}</span>
              <span className="rp-kpi-lbl">Inactifs</span>
            </div>
          </div>

          <div className="rp-breakdown-grid">
            <div className="rp-breakdown">
              <h4>Par type</h4>
              <div className="rp-bar-chart">
                {Object.entries(personnelReport.byType).map(([type, count]) => {
                  const max = Math.max(...Object.values(personnelReport.byType), 1);
                  return (
                    <div key={type} className="rp-bar-row">
                      <span className="rp-bar-label">{type}</span>
                      <div className="rp-bar-track">
                        <div className="rp-bar-fill" style={{ width: `${(count / max * 100)}%`, background: STATUS_COLORS.success }} />
                      </div>
                      <span className="rp-bar-val">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rp-breakdown">
              <h4>Par contrat</h4>
              <div className="rp-bar-chart">
                {Object.entries(personnelReport.byContract).map(([type, count]) => {
                  const max = Math.max(...Object.values(personnelReport.byContract), 1);
                  return (
                    <div key={type} className="rp-bar-row">
                      <span className="rp-bar-label">{type}</span>
                      <div className="rp-bar-track">
                        <div className="rp-bar-fill" style={{ width: `${(count / max * 100)}%`, background: ACCENT_COLORS.violet }} />
                      </div>
                      <span className="rp-bar-val">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ORDERS ═══ */}
      {section === 'orders' && !loading && (
        <div className="rp-section">
          <SectionHeader className="rp-section-header" icon={<ShoppingCart size={18} />} title="Synthèse Commandes" actions={
            <div className="rp-section-actions">
              <Button variant="ghost" className="rp-btn rp-btn-sm" onClick={exportOrdersCSV}>
                <Download size={14} /> CSV
              </Button>
            </div>
          } />

          <div className="rp-kpi-grid">
            <div className="rp-kpi" style={{ borderColor: ACCENT_COLORS.violet }}>
              <span className="rp-kpi-val">{ordersReport.total}</span>
              <span className="rp-kpi-lbl">Commandes</span>
            </div>
            <div className="rp-kpi cost" style={{ borderColor: STATUS_COLORS.success }}>
              <span className="rp-kpi-val">{fmtCurrency(ordersReport.totalAmount)}</span>
              <span className="rp-kpi-lbl">Montant total</span>
            </div>
          </div>

          {Object.keys(ordersReport.byStatus).length > 0 && (
            <div className="rp-breakdown">
              <h4>Par statut</h4>
              <div className="rp-bar-chart">
                {Object.entries(ordersReport.byStatus).map(([status, count]) => {
                  const max = Math.max(...Object.values(ordersReport.byStatus), 1);
                  return (
                    <div key={status} className="rp-bar-row">
                      <span className="rp-bar-label">{status}</span>
                      <div className="rp-bar-track">
                        <div className="rp-bar-fill" style={{ width: `${(count / max * 100)}%`, background: ACCENT_COLORS.violet }} />
                      </div>
                      <span className="rp-bar-val">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ordersStats && (
            <div className="rp-extra-stats">
              <h4>Statistiques globales</h4>
              <div className="rp-stat-chips">
                {Object.entries(ordersStats).map(([k, v]) => (
                  <span key={k} className="rp-stat-chip">
                    <strong>{typeof v === 'number' && k.toLowerCase().includes('amount') ? fmtCurrency(v) : v}</strong>
                    {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ AFFAIRES ═══ */}
      {section === 'affaires' && !loading && (
        <div className="rp-section">
          <SectionHeader className="rp-section-header" icon={<Briefcase size={18} />} title="Synthèse Affaires" actions={
            <div className="rp-section-actions">
              <Button variant="ghost" className="rp-btn rp-btn-sm" onClick={exportAffairesCSV}>
                <Download size={14} /> CSV
              </Button>
            </div>
          } />

          <div className="rp-kpi-grid">
            <div className="rp-kpi" style={{ borderColor: ACCENT_COLORS.orange }}>
              <span className="rp-kpi-val">{affairesReport.total}</span>
              <span className="rp-kpi-lbl">Sur la période</span>
            </div>
            <div className="rp-kpi" style={{ borderColor: STATUS_COLORS.info }}>
              <span className="rp-kpi-val">{affairesReport.all}</span>
              <span className="rp-kpi-lbl">Total</span>
            </div>
          </div>

          {Object.keys(affairesReport.byStatus).length > 0 && (
            <div className="rp-breakdown">
              <h4>Par statut</h4>
              <div className="rp-bar-chart">
                {Object.entries(affairesReport.byStatus).map(([status, count]) => {
                  const max = Math.max(...Object.values(affairesReport.byStatus), 1);
                  return (
                    <div key={status} className="rp-bar-row">
                      <span className="rp-bar-label">{status}</span>
                      <div className="rp-bar-track">
                        <div className="rp-bar-fill" style={{ width: `${(count / max * 100)}%`, background: ACCENT_COLORS.orange }} />
                      </div>
                      <span className="rp-bar-val">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ EXPORTS CSV ═══ */}
      {section === 'exports' && !loading && (
        <div className="rp-section">
          <SectionHeader className="rp-section-header" icon={<FileSpreadsheet size={18} />} title="Exports CSV (Excel)" />
          <p className="rp-export-desc">
            Exportez les données complètes au format CSV, compatible Excel et LibreOffice.
            Les fichiers incluent l'encodage UTF-8 avec BOM pour la prise en charge des accents.
          </p>
          <div className="rp-export-grid">
            <Button variant="ghost" className="rp-export-card" onClick={exportVehiclesCSV}>
              <Truck size={24} />
              <span className="rp-export-title">Véhicules</span>
              <span className="rp-export-count">{vehicles.length} enregistrements</span>
            </Button>
            <Button variant="ghost" className="rp-export-card" onClick={exportReservationsCSV}>
              <Calendar size={24} />
              <span className="rp-export-title">Réservations</span>
              <span className="rp-export-count">{reservations.length} enregistrements</span>
            </Button>
            <Button variant="ghost" className="rp-export-card" onClick={exportMaintenancesCSV}>
              <Wrench size={24} />
              <span className="rp-export-title">Maintenances</span>
              <span className="rp-export-count">{maintenances.length} enregistrements</span>
            </Button>
            <Button variant="ghost" className="rp-export-card" onClick={exportPersonnelCSV}>
              <Users size={24} />
              <span className="rp-export-title">Personnel</span>
              <span className="rp-export-count">{persons.length} enregistrements</span>
            </Button>
            <Button variant="ghost" className="rp-export-card" onClick={exportOrdersCSV}>
              <ShoppingCart size={24} />
              <span className="rp-export-title">Commandes</span>
              <span className="rp-export-count">{orders.length} enregistrements</span>
            </Button>
            <Button variant="ghost" className="rp-export-card" onClick={exportAffairesCSV}>
              <Briefcase size={24} />
              <span className="rp-export-title">Affaires</span>
              <span className="rp-export-count">{affaires.length} enregistrements</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPanel;
