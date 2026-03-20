/* ═══════════════════════════════════════════════════════════════
   Composant Desktop — Module Inventaire Mag Scène
   Onglets : Dashboard · Articles · Emplacements · Prix · Anomalies
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import {
  BarChart3, MapPin, DollarSign, AlertTriangle, Package, Search, Plus,
  RefreshCw, Download, Upload, CheckCircle2, XCircle, Eye, Edit, Trash2,
  ChevronDown, ChevronUp, Filter, ArrowUpDown, TrendingUp, TrendingDown,
  Boxes, ClipboardCheck, FileSpreadsheet, Info, Star
} from 'lucide-react';
import api from '../../utils/api';
import { useInventory } from '../../hooks/useInventory';
import './InventoryPanel.css';

// ═══════ SUB-VIEWS (inline pour éviter le surcoût de fichiers séparés) ═══════

// ── Dashboard View ──
function DashboardView({ stats, alerts, anomalies, onRefresh, onExportCSV, onRunAbc }) {
  if (!stats) return <div className="inv-loading">Chargement des statistiques…</div>;
  const { summary } = stats;

  return (
    <div className="inv-dashboard">
      {/* KPI Cards */}
      <div className="inv-kpi-grid">
        <div className="inv-kpi-card">
          <div className="inv-kpi-icon"><Package size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.totalItems}</span>
            <span className="inv-kpi-label">Articles actifs</span>
          </div>
        </div>
        <div className="inv-kpi-card">
          <div className="inv-kpi-icon"><DollarSign size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
            <span className="inv-kpi-label">Valeur totale</span>
          </div>
        </div>
        <div className="inv-kpi-card warning">
          <div className="inv-kpi-icon"><AlertTriangle size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.lowStock}</span>
            <span className="inv-kpi-label">Stock bas</span>
          </div>
        </div>
        <div className="inv-kpi-card danger">
          <div className="inv-kpi-icon"><AlertTriangle size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.openAnomalies}</span>
            <span className="inv-kpi-label">Anomalies ouvertes</span>
          </div>
        </div>
        <div className="inv-kpi-card">
          <div className="inv-kpi-icon"><MapPin size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.locations}</span>
            <span className="inv-kpi-label">Emplacements</span>
          </div>
        </div>
        <div className="inv-kpi-card">
          <div className="inv-kpi-icon"><DollarSign size={24} /></div>
          <div className="inv-kpi-data">
            <span className="inv-kpi-value">{summary.priceEntries}</span>
            <span className="inv-kpi-label">Historiques prix</span>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="inv-actions-bar">
        <button className="inv-btn" onClick={onRefresh}><RefreshCw size={14} /> Rafraîchir</button>
        <button className="inv-btn" onClick={onExportCSV}><Download size={14} /> Export CSV</button>
        <button className="inv-btn" onClick={onRunAbc}><Star size={14} /> Classification ABC</button>
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
          <table className="inv-table">
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
          </table>
        </div>
      )}

      {/* Alertes stock bas */}
      {alerts.length > 0 && (
        <div className="inv-section">
          <h3><AlertTriangle size={16} /> Alertes stock bas ({alerts.length})</h3>
          <table className="inv-table">
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
          </table>
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
        <button className="inv-btn primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {showForm && (
        <form className="inv-form" onSubmit={handleSubmit}>
          <div className="inv-form-grid">
            <input placeholder="Nom *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <input placeholder="Code *" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required />
            <select value={form.depot_number} onChange={e => setForm(f => ({ ...f, depot_number: Number(e.target.value) }))}>
              <option value={1}>Dépôt 1</option>
              <option value={2}>Dépôt 2</option>
              <option value={0}>Camion</option>
              <option value={99}>Externe</option>
            </select>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="storage">Stockage</option>
              <option value="workshop">Atelier</option>
              <option value="vehicle">Véhicule</option>
              <option value="external">Externe</option>
            </select>
            <input placeholder="Zone" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
            <input type="number" placeholder="Capacité" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
          </div>
          <div className="inv-form-actions">
            <button type="submit" className="inv-btn primary">{editId ? 'Modifier' : 'Créer'}</button>
            <button type="button" className="inv-btn" onClick={resetForm}>Annuler</button>
          </div>
        </form>
      )}

      <table className="inv-table">
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
                <button className="inv-btn-icon" onClick={() => startEdit(loc)} title="Modifier"><Edit size={14} /></button>
                <button className="inv-btn-icon danger" onClick={() => onDelete(loc.id)} title="Supprimer"><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <input type="number" placeholder="ID article" value={itemId}
            onChange={e => setItemId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPrice()} />
          <button className="inv-btn primary" onClick={searchPrice} disabled={loading}>
            <Search size={14} /> {loading ? '…' : 'Analyser'}
          </button>
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
          <table className="inv-table">
            <thead>
              <tr><th>Date</th><th>Source</th><th>Fournisseur</th><th>Prix HT</th><th>Réf.</th></tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleDateString('fr-FR')}</td>
                  <td><span className={`inv-badge ${h.source}`}>{h.source}</span></td>
                  <td>{h.supplier_name || '—'}</td>
                  <td><strong>{h.price_ht?.toFixed(2)} €</strong></td>
                  <td>{h.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <button className="inv-btn primary" onClick={onDetect}><Search size={14} /> Lancer détection</button>
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
              <button className="inv-btn small" onClick={() => onResolve(a.id, 'resolved')}>
                <CheckCircle2 size={12} /> Résolu
              </button>
              <button className="inv-btn small muted" onClick={() => onResolve(a.id, 'ignored')}>
                <XCircle size={12} /> Ignorer
              </button>
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
        <button className="inv-btn" onClick={addRow}><Plus size={14} /> Ajouter ligne</button>
      </div>

      <div className="inv-count-grid">
        {items.map((item, i) => (
          <div key={i} className="inv-count-row">
            <input type="number" placeholder="ID article" value={item.stock_item_id}
              onChange={e => updateRow(i, 'stock_item_id', e.target.value)} />
            <input type="number" placeholder="Qté comptée" value={item.counted_qty}
              onChange={e => updateRow(i, 'counted_qty', e.target.value)} />
            <button className="inv-btn-icon danger" onClick={() => removeRow(i)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <button className="inv-btn primary" onClick={handleSubmit}><CheckCircle2 size={14} /> Valider le comptage</button>

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


// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — InventoryPanel
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
  { id: 'locations', label: 'Emplacements', icon: MapPin },
  { id: 'prices',    label: 'Prix',          icon: DollarSign },
  { id: 'anomalies', label: 'Anomalies',     icon: AlertTriangle },
  { id: 'count',     label: 'Comptage',      icon: ClipboardCheck },
];

export default function InventoryPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Fabrication d'un toast minimaliste si pas injecté
  const toast = useMemo(() => ({
    success: () => {},
    error: () => {},
    info: () => {},
  }), []);

  const inv = useInventory({ isAuthenticated: true, toast });

  return (
    <div className="inv-panel">
      {/* Header avec onglets */}
      <div className="inv-header">
        <div className="inv-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`inv-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.id === 'anomalies' && inv.anomalies.length > 0 && (
                  <span className="inv-tab-badge">{inv.anomalies.length}</span>
                )}
              </button>
            );
          })}
        </div>
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
            <div className="loading-spinner" />
            <p>Chargement de l'inventaire…</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                stats={inv.stats}
                alerts={inv.alerts}
                anomalies={inv.anomalies}
                onRefresh={inv.refreshStats}
                onExportCSV={inv.exportCSV}
                onRunAbc={inv.runAbcClassification}
              />
            )}
            {activeTab === 'locations' && (
              <LocationsView
                locations={inv.locations}
                onCreate={inv.createLocation}
                onUpdate={inv.updateLocation}
                onDelete={inv.deleteLocation}
              />
            )}
            {activeTab === 'prices' && <PricesView />}
            {activeTab === 'anomalies' && (
              <AnomaliesView
                anomalies={inv.anomalies}
                onDetect={inv.detectAnomalies}
                onResolve={inv.resolveAnomaly}
              />
            )}
            {activeTab === 'count' && (
              <CountView onSubmitCount={inv.submitCount} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
