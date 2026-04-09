/* ═══════════════════════════════════════════════════════════════
   Composant Desktop — Module Inventaire eM@g
   Onglets : Dashboard · Articles · Emplacements · Prix · Anomalies
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, MapPin, DollarSign, AlertTriangle, Package, Search, Plus,
  RefreshCw, Download, CheckCircle2, XCircle, Edit, Trash2,
  TrendingUp, ClipboardCheck, Star
} from 'lucide-react';
import api from '../../utils/api';
import { useInventory } from '../../hooks/useInventory';
import { useToast } from '../../hooks/useToast';
import { formatDateSimple } from '../../utils/formatUtils';
import './InventoryPanel.css';
import { Button, Card, Input, Select, Spinner, Tab, TabList, TabPanel, Table, Tabs, Tooltip } from '@/design-system';
import { formatDateTime } from '../../utils/formatUtils';

// ═══════ SUB-VIEWS (inline pour éviter le surcoût de fichiers séparés) ═══════

// ── Dashboard View ──
function DashboardView({ stats, alerts, _anomalies, onRefresh, onExportCSV, onRunAbc }) {
  if (!stats) return <div className="inv-loading">Chargement des statistiques…</div>;
  const { summary } = stats;

  return (
    <div className="inv-dashboard">
      {/* KPI Cards */}
      <div className="inv-kpi-grid">
        <Card className="inv-kpi-card">
          <div className="inv-kpi-icon"><Package size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.totalItems}</span>
            <span className="inv-kpi-label">Articles actifs</span>
          </div>
        </Card>
        <Card className="inv-kpi-card">
          <div className="inv-kpi-icon"><DollarSign size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
            <span className="inv-kpi-label">Valeur totale</span>
          </div>
        </Card>
        <Card className="inv-kpi-card warning">
          <div className="inv-kpi-icon"><AlertTriangle size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.lowStock}</span>
            <span className="inv-kpi-label">Stock bas</span>
          </div>
        </Card>
        <Card className="inv-kpi-card danger">
          <div className="inv-kpi-icon"><AlertTriangle size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.openAnomalies}</span>
            <span className="inv-kpi-label">Anomalies ouvertes</span>
          </div>
        </Card>
        <Card className="inv-kpi-card">
          <div className="inv-kpi-icon"><MapPin size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.locations}</span>
            <span className="inv-kpi-label">Emplacements</span>
          </div>
        </Card>
        <Card className="inv-kpi-card">
          <div className="inv-kpi-icon"><DollarSign size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.priceEntries}</span>
            <span className="inv-kpi-label">Historiques prix</span>
          </div>
        </Card>
      </div>

      {/* Actions rapides */}
      <div className="inv-actions-bar">
        <Button variant="ghost" className="inv-btn" onClick={onRefresh}><RefreshCw size={14} /> Rafraîchir</Button>
        <Button variant="ghost" className="inv-btn" onClick={onExportCSV}><Download size={14} /> Export CSV</Button>
        <Button variant="ghost" className="inv-btn" onClick={onRunAbc}><Star size={14} /> Classification ABC</Button>
      </div>

      {/* Répartition par dépôt */}
      {stats.byDepot?.length > 0 && (
        <div className="inv-section">
          <h3>Répartition par dépôt</h3>
          <div className="inv-depot-grid">
            {stats.byDepot.map((d, i) => (
              <div key={i} className="inv-depot-card">
                <strong>{d.depot_name || `Dépôt ${d.depot_number || '?'}`}</strong>
                <span>{d.items} articles</span>
                <span>{d.total_qty} unités</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classification ABC */}
      {stats.abcDistribution?.length > 0 && (
        <div className="inv-section">
          <h3>Classification ABC</h3>
          <div className="inv-abc-grid">
            {stats.abcDistribution.map(d => (
              <div key={d.abc_class || 'null'} className={`inv-abc-card abc-${(d.abc_class || 'c').toLowerCase()}`}>
                <span className="inv-abc-letter">{d.abc_class || '?'}</span>
                <span>{d.count} articles</span>
                <span>{d.value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 par valeur */}
      {stats.topByValue?.length > 0 && (
        <div className="inv-section">
          <h3>Top 10 par valeur</h3>
          <Table className="inv-table">
            <thead>
              <tr><th>Réf</th><th>Nom</th><th>PU HT</th><th>Qté</th><th>Valeur</th></tr>
            </thead>
            <tbody>
              {stats.topByValue.map(item => (
                <tr key={item.id}>
                  <td>{item.reference || '—'}</td>
                  <td>{item.name}</td>
                  <td>{item.unit_price?.toFixed(2)} €</td>
                  <td>{item.quantity}</td>
                  <td><strong>{item.total_value?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Alertes stock bas */}
      {alerts.length > 0 && (
        <div className="inv-section">
          <h3><AlertTriangle size={16} /> Alertes stock bas ({alerts.length})</h3>
          <Table className="inv-table">
            <thead>
              <tr><th>Réf</th><th>Nom</th><th>Qté</th><th>Seuil</th><th>Emplacement</th></tr>
            </thead>
            <tbody>
              {alerts.slice(0, 20).map(item => (
                <tr key={item.id} className="inv-row-warning">
                  <td>{item.reference || '—'}</td>
                  <td>{item.name}</td>
                  <td className="inv-cell-danger">{item.quantity}</td>
                  <td>{item.min_quantity}</td>
                  <td>{item.location_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Locations (Emplacements) View ──
function LocationsView({ locations, onCreate, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', depot_number: 1, type: 'storage', zone: '', capacity: '' });

  const resetForm = () => { setForm({ name: '', code: '', depot_number: 1, type: 'storage', zone: '', capacity: '' }); setEditId(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await onUpdate(editId, form);
      } else {
        await onCreate(form);
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (loc) => {
    setForm({ name: loc.name, code: loc.code, depot_number: loc.depot_number, type: loc.type, zone: loc.zone || '', capacity: loc.capacity || '' });
    setEditId(loc.id);
    setShowForm(true);
  };

  return (
    <div className="inv-locations">
      <div className="inv-toolbar">
        <h3><MapPin size={18} /> Emplacements ({locations.length})</h3>
        <Button variant="ghost" className="inv-btn primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      {showForm && (
        <form className="inv-form" onSubmit={handleSubmit}>
          <div className="inv-form-grid">
            <Input placeholder="Nom *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <Input placeholder="Code *" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required />
            <Select value={form.depot_number} onChange={e => setForm(f => ({ ...f, depot_number: Number(e.target.value) }))}>
              <option value={1}>Dépôt 1</option>
              <option value={2}>Dépôt 2</option>
              <option value={0}>Camion</option>
              <option value={99}>Externe</option>
            </Select>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="storage">Stockage</option>
              <option value="workshop">Atelier</option>
              <option value="vehicle">Véhicule</option>
              <option value="external">Externe</option>
            </Select>
            <Input placeholder="Zone" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
            <Input type="number" placeholder="Capacité" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
          </div>
          <div className="inv-form-actions">
            <Button variant="ghost" type="submit" className="inv-btn primary">{editId ? 'Modifier' : 'Créer'}</Button>
            <Button variant="ghost" type="button" className="inv-btn" onClick={resetForm}>Annuler</Button>
          </div>
        </form>
      )}

      <Table className="inv-table">
        <thead>
          <tr><th>Code</th><th>Nom</th><th>Dépôt</th><th>Type</th><th>Zone</th><th>Capacité</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc.id}>
              <td><code>{loc.code}</code></td>
              <td>{loc.name}</td>
              <td>Dépôt {loc.depot_number}</td>
              <td><span className={`inv-badge ${loc.type}`}>{loc.type}</span></td>
              <td>{loc.zone || '—'}</td>
              <td>{loc.capacity || '—'}</td>
              <td className="inv-actions">
                <Tooltip content="Modifier"><Button variant="ghost" className="inv-btn-icon" onClick={() => startEdit(loc)}><Edit size={14} /></Button></Tooltip>
                <Tooltip content="Supprimer"><Button variant="ghost" className="inv-btn-icon danger" onClick={() => onDelete(loc.id)}><Trash2 size={14} /></Button></Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

// ── Prix View (history + analysis) ──
function PricesView() {
  const [itemId, setItemId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchPrice = async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const [a, h] = await Promise.all([
        api.getPriceAnalysis(itemId),
        api.getItemPriceHistory(itemId),
      ]);
      setAnalysis(a);
      setHistory(h);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inv-prices">
      <div className="inv-toolbar">
        <h3><DollarSign size={18} /> Analyse prix</h3>
        <div className="inv-search-group">
          <Input type="number" placeholder="ID article" value={itemId}
            onChange={e => setItemId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPrice()} />
          <Button variant="ghost" className="inv-btn primary" onClick={searchPrice} disabled={loading}>
            <Search size={14} /> {loading ? '…' : 'Analyser'}
          </Button>
        </div>
      </div>

      {analysis?.item && (
        <div className="inv-price-result">
          <div className="inv-price-header">
            <h4>{analysis.item.name} <small>({analysis.item.reference || 'sans réf.'})</small></h4>
            <span className="inv-price-current">Prix actuel : {analysis.item.current_price?.toFixed(2)} €</span>
          </div>

          {analysis.analysis.status === 'ok' && (
            <>
              <div className="inv-price-kpi">
                <div className="inv-kpi-mini">
                  <span className="label">Prix recommandé</span>
                  <span className="value recommended">{analysis.analysis.recommended_price?.toFixed(2)} €</span>
                </div>
                <div className="inv-kpi-mini">
                  <span className="label">Médiane</span>
                  <span className="value">{analysis.analysis.price_median?.toFixed(2)} €</span>
                </div>
                <div className="inv-kpi-mini">
                  <span className="label">IQR</span>
                  <span className="value">{analysis.analysis.iqr?.toFixed(2)} €</span>
                </div>
                <div className="inv-kpi-mini">
                  <span className="label">σ (écart-type)</span>
                  <span className="value">{analysis.analysis.stddev?.toFixed(2)} €</span>
                </div>
                <div className="inv-kpi-mini">
                  <span className="label">Confiance</span>
                  <span className={`value confidence-${analysis.analysis.confidence >= 70 ? 'high' : analysis.analysis.confidence >= 40 ? 'medium' : 'low'}`}>
                    {analysis.analysis.confidence}/100
                  </span>
                </div>
                <div className="inv-kpi-mini">
                  <span className="label">Outliers</span>
                  <span className={`value ${analysis.analysis.outlier_count > 0 ? 'danger' : ''}`}>
                    {analysis.analysis.outlier_count}
                  </span>
                </div>
              </div>

              {/* Price range bar */}
              <div className="inv-price-range">
                <span className="low">{analysis.analysis.price_low?.toFixed(2)} €</span>
                <div className="inv-price-bar">
                  <div className="inv-price-bar-fill"
                    style={{ left: '25%', width: '50%' }}
                    title={`Q1-Q3: ${analysis.analysis.price_low?.toFixed(2)} – ${analysis.analysis.price_high?.toFixed(2)}`}
                  />
                </div>
                <span className="high">{analysis.analysis.price_high?.toFixed(2)} €</span>
              </div>
            </>
          )}
          {analysis.analysis.status === 'no_data' && (
            <div className="inv-empty">Aucune donnée de prix pour cet article.</div>
          )}
        </div>
      )}

      {/* Historique */}
      {history.length > 0 && (
        <div className="inv-section">
          <h4>Historique des prix ({history.length} entrées)</h4>
          <Table className="inv-table">
            <thead>
              <tr><th>Date</th><th>Source</th><th>Fournisseur</th><th>Prix HT</th><th>Réf.</th></tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{formatDateSimple(h.created_at)}</td>
                  <td><span className={`inv-badge ${h.source}`}>{h.source}</span></td>
                  <td>{h.supplier_name || '—'}</td>
                  <td><strong>{h.price_ht?.toFixed(2)} €</strong></td>
                  <td>{h.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Anomalies View ──
function AnomaliesView({ anomalies, onDetect, onResolve }) {
  const severityColors = { critical: '#dc3545', high: '#fd7e14', medium: '#ffc107', low: '#6c757d' };

  return (
    <div className="inv-anomalies">
      <div className="inv-toolbar">
        <h3><AlertTriangle size={18} /> Anomalies ({anomalies.length} ouvertes)</h3>
        <Button variant="ghost" className="inv-btn primary" onClick={onDetect}><Search size={14} /> Lancer détection</Button>
      </div>

      {anomalies.length === 0 && <div className="inv-empty"><CheckCircle2 size={24} /> Aucune anomalie ouverte</div>}

      <div className="inv-anomaly-list">
        {anomalies.map(a => (
          <div key={a.id} className={`inv-anomaly-card severity-${a.severity}`}>
            <div className="inv-anomaly-header">
              <span className="inv-anomaly-type">{a.type.replace(/_/g, ' ')}</span>
              <span className="inv-anomaly-severity" style={{ color: severityColors[a.severity] }}>
                {a.severity}
              </span>
            </div>
            <div className="inv-anomaly-body">
              <strong>{a.item_name || `#${a.stock_item_id}`}</strong>
              <p>{a.description}</p>
              {a.expected_value != null && (
                <div className="inv-anomaly-values">
                  <span>Attendu: {a.expected_value}</span>
                  <span>Réel: {a.actual_value}</span>
                  {a.deviation_pct != null && <span>Écart: {a.deviation_pct}%</span>}
                </div>
              )}
            </div>
            <div className="inv-anomaly-actions">
              <Button variant="ghost" className="inv-btn small" onClick={() => onResolve(a.id, 'resolved')}>
                <CheckCircle2 size={12} /> Résolu
              </Button>
              <Button variant="ghost" className="inv-btn small muted" onClick={() => onResolve(a.id, 'ignored')}>
                <XCircle size={12} /> Ignorer
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Count View (Comptage inventaire) ──
function CountView({ onSubmitCount }) {
  const [items, setItems] = useState([{ stock_item_id: '', counted_qty: '' }]);
  const [result, setResult] = useState(null);

  const addRow = () => setItems(prev => [...prev, { stock_item_id: '', counted_qty: '' }]);
  const removeRow = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setItems(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const handleSubmit = async () => {
    const valid = items.filter(i => i.stock_item_id && i.counted_qty !== '');
    if (!valid.length) return;
    const r = await onSubmitCount(valid.map(i => ({ stock_item_id: Number(i.stock_item_id), counted_qty: Number(i.counted_qty) })));
    setResult(r);
  };

  return (
    <div className="inv-count">
      <div className="inv-toolbar">
        <h3><ClipboardCheck size={18} /> Comptage inventaire</h3>
        <Button variant="ghost" className="inv-btn" onClick={addRow}><Plus size={14} /> Ajouter ligne</Button>
      </div>

      <div className="inv-count-grid">
        {items.map((item, i) => (
          <div key={i} className="inv-count-row">
            <Input type="number" placeholder="ID article" value={item.stock_item_id}
              onChange={e => updateRow(i, 'stock_item_id', e.target.value)} />
            <Input type="number" placeholder="Qté comptée" value={item.counted_qty}
              onChange={e => updateRow(i, 'counted_qty', e.target.value)} />
            <Button variant="ghost" className="inv-btn-icon danger" onClick={() => removeRow(i)}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>

      <Button variant="ghost" className="inv-btn primary" onClick={handleSubmit}><CheckCircle2 size={14} /> Valider le comptage</Button>

      {result && (
        <div className="inv-count-result">
          <h4>Résultat : {result.counted} comptés, {result.adjustments} ajustement(s)</h4>
          {result.details?.filter(d => d.diff !== 0).map(d => (
            <div key={d.id} className={`inv-count-diff ${d.diff > 0 ? 'positive' : 'negative'}`}>
              <span>{d.name}</span>
              <span>Avant: {d.previous}</span>
              <span>Compté: {d.counted}</span>
              <span className="diff">{d.diff > 0 ? '+' : ''}{d.diff}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mouvements View (données issues du stock) ──
const MOVEMENT_TYPES = {
  in: { label: 'Entrée', color: '#10b981', icon: '📥' },
  out: { label: 'Sortie', color: '#ef4444', icon: '📤' },
  adjustment: { label: 'Ajustement', color: '#f59e0b', icon: '🔧' },
  return: { label: 'Retour', color: '#3b82f6', icon: '↩️' },
};

function MovementsView() {
  const [movements, setMovements] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getStockMovements({});
        setMovements(data.movements || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!typeFilter) return movements;
    return movements.filter(m => m.type === typeFilter);
  }, [movements, typeFilter]);

  if (loading) return <div className="inv-loading"><Spinner size="lg" /><p>Chargement des mouvements…</p></div>;

  return (
    <div className="inv-movements">
      <div className="inv-toolbar">
        <h3><TrendingUp size={18} /> Mouvements ({filtered.length})</h3>
        <Select className="inv-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous types</option>
          {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="inv-empty"><TrendingUp size={48} /><p>Aucun mouvement enregistré</p></div>
      ) : (
        <div className="inv-table-container">
          <Table className="inv-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Article</th>
                <th>Quantité</th>
                <th>Avant → Après</th>
                <th>Motif</th>
                <th>Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const mt = MOVEMENT_TYPES[m.type] || {};
                return (
                  <tr key={m.id}>
                    <td>{formatDateTime(m.created_at)}</td>
                    <td>
                      <span className="inv-movement-badge" style={{ background: (mt.color || '#888') + '20', color: mt.color }}>
                        {mt.icon} {mt.label || m.type}
                      </span>
                    </td>
                    <td>
                      <div className="inv-movement-item">
                        <span>{m.item_name}</span>
                        <small>{m.item_reference}</small>
                      </div>
                    </td>
                    <td className={`inv-movement-qty ${m.type === 'out' ? 'negative' : 'positive'}`}>
                      {m.type === 'out' ? '-' : '+'}{m.quantity} {m.item_unit}
                    </td>
                    <td>{m.previous_quantity} → {m.new_quantity}</td>
                    <td>{m.reason || '—'}</td>
                    <td>{m.user_name || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — InventoryPanel
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
  { id: 'movements', label: 'Mouvements', icon: TrendingUp },
  { id: 'locations', label: 'Emplacements', icon: MapPin },
  { id: 'prices',    label: 'Prix',          icon: DollarSign },
  { id: 'anomalies', label: 'Anomalies',     icon: AlertTriangle },
  { id: 'count',     label: 'Comptage',      icon: ClipboardCheck },
];

export default function InventoryPanel({ _currentUser }) {
  
  const toast = useToast();

  const inv = useInventory({ isAuthenticated: true, toast });

  return (
    <div className="inv-panel">
      <Tabs defaultValue="dashboard">
      {/* Header avec onglets */}
      <div className="inv-header">
        <TabList className="inv-tabs">
          {TABS.map(tab => (
            <Tab
              key={tab.id}
              value={tab.id}
              icon={<tab.icon size={16} />}
              badge={tab.id === 'anomalies' && inv.anomalies.length > 0 ? inv.anomalies.length : undefined}
            >
              {tab.label}
            </Tab>
          ))}
        </TabList>
        <div className="inv-header-stats">
          {inv.stats?.summary && (
            <>
              <span className="inv-stat-badge">{inv.stats.summary.totalItems} articles</span>
              {inv.stats.summary.lowStock > 0 && (
                <span className="inv-stat-badge warning">{inv.stats.summary.lowStock} stock bas</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="inv-content">
        {inv.isLoading ? (
          <div className="inv-loading">
            <Spinner size="lg" />
            <p>Chargement de l'inventaire…</p>
          </div>
        ) : (
          <>
            <TabPanel value="dashboard">
              <DashboardView
                stats={inv.stats}
                alerts={inv.alerts}
                anomalies={inv.anomalies}
                onRefresh={inv.refreshStats}
                onExportCSV={inv.exportCSV}
                onRunAbc={inv.runAbcClassification}
              />
            </TabPanel>
            <TabPanel value="movements"><MovementsView /></TabPanel>
            <TabPanel value="locations">
              <LocationsView
                locations={inv.locations}
                onCreate={inv.createLocation}
                onUpdate={inv.updateLocation}
                onDelete={inv.deleteLocation}
              />
            </TabPanel>
            <TabPanel value="prices"><PricesView /></TabPanel>
            <TabPanel value="anomalies">
              <AnomaliesView
                anomalies={inv.anomalies}
                onDetect={inv.detectAnomalies}
                onResolve={inv.resolveAnomaly}
              />
            </TabPanel>
            <TabPanel value="count">
              <CountView onSubmitCount={inv.submitCount} />
            </TabPanel>
          </>
        )}
      </div>
      </Tabs>
    </div>
  );
}
