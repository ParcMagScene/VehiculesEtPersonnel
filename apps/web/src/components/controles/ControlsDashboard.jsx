// ═══════════════════════════════════════════════════════════════
// ControlsDashboard.jsx — Tableau de bord des contrôles périodiques
// ═══════════════════════════════════════════════════════════════
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Card,
  EmptyState,
  FilterBar,
  ModuleContent,
  ModuleLayout,
  ModuleToolbar,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Table,
} from '@/design-system';

import { useListResource } from '../../hooks/useListResource';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import ControlEditorModal from './ControlEditorModal';
import ControlHistoryModal from './ControlHistoryModal';
import ControlPerformModal from './ControlPerformModal';
import { formatDueLabel, STATUS_COLORS, STATUS_LABELS } from './utils';

const STATS_CARDS = [
  { key: 'total', label: 'Total', icon: ShieldAlert, color: '#0f172a' },
  { key: 'a_faire', label: 'À faire', icon: Clock, color: '#1e40af' },
  { key: 'en_retard', label: 'En retard', icon: AlertTriangle, color: '#92400e' },
  { key: 'manque', label: 'Manqués', icon: AlertTriangle, color: '#991b1b' },
  { key: 'within_30', label: 'Sous 30 j', icon: Clock, color: '#0e7490' },
  { key: 'within_7', label: 'Sous 7 j', icon: Clock, color: '#b91c1c' },
];

export default function ControlsDashboard({ user }) {
  const isAdmin = !!user?.is_admin || user?.role === 'admin';
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    entity_type: '',
    type_id: '',
    assigned_to: '',
  });
  const [perform, setPerform] = useState(null);
  const [history, setHistory] = useState(null);
  const [editor, setEditor] = useState(null); // { control } pour éditer

  const fetchDashboard = useCallback(async () => {
    const r = await api.getControlsDashboard(filters);
    if (!r?.success) throw new Error(r?.error || 'Erreur');
    return { items: r.data?.items || [], stats: r.data?.stats || {} };
  }, [filters]);

  // useListResource : state + load au mont/filtres + bus 'controls' (création/édition/suppression ailleurs).
  const {
    data,
    loading,
    error,
    reload: load,
  } = useListResource('controls', fetchDashboard, {
    initialData: { items: [], stats: {} },
  });

  useEffect(() => {
    api.getControlTypes(true).then((r) => setTypes(r?.data || []));
  }, []);

  const items = useMemo(() => data.items, [data]);

  const handleDelete = async (ctrl) => {
    if (!window.confirm(`Désactiver le contrôle « ${ctrl.type_name} » ?`)) return;
    const r = await api.deleteControl(ctrl.id);
    if (r?.success) {
      refreshBus.publish('controls');
      load();
    } else alert(r?.error || 'Erreur suppression');
  };

  const handleRecompute = async () => {
    if (!window.confirm('Relancer le calcul des statuts pour tous les contrôles actifs ?')) return;
    const r = await api.recomputeControls();
    if (r?.success) {
      alert(
        `Recalcul OK — ${r.data?.changed || 0} statut(s) mis à jour, ${r.data?.missed || 0} manqué(s).`,
      );
      refreshBus.publish('controls');
      load();
    } else alert(r?.error || 'Erreur');
  };

  return (
    <ModuleLayout>
      <PageHeader title="Contrôles périodiques" subtitle="Équipements & véhicules" />

      <ModuleToolbar>
        <FilterBar>
          <Select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Tous statuts</option>
            <option value="A_FAIRE">À faire</option>
            <option value="EN_RETARD">En retard</option>
            <option value="MANQUE">Manqué</option>
          </Select>
          <Select
            value={filters.entity_type}
            onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))}
          >
            <option value="">Toutes entités</option>
            <option value="vehicle">Véhicules</option>
            <option value="equipment">Équipements</option>
          </Select>
          <Select
            value={filters.type_id}
            onChange={(e) => setFilters((f) => ({ ...f, type_id: e.target.value }))}
          >
            <option value="">Tous types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} · {t.name}
              </option>
            ))}
          </Select>
        </FilterBar>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={load} icon={<RefreshCw size={16} />}>
            Actualiser
          </Button>
          {isAdmin && (
            <Button variant="ghost" onClick={handleRecompute} icon={<RefreshCw size={16} />}>
              Recalcul global
            </Button>
          )}
        </div>
      </ModuleToolbar>

      <ModuleContent>
        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {STATS_CARDS.map(({ key, label, icon: Icon, color }) => (
            <Card key={key} style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color }}>
                <Icon size={18} />
                <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{data.stats?.[key] ?? 0}</div>
            </Card>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6 }}>
            {error.message}
          </div>
        )}

        {loading && <Spinner />}

        {!loading && items.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 size={48} />}
            title="Aucun contrôle à afficher"
            description="Aucun contrôle ne correspond à vos filtres actuels."
          />
        )}

        {!loading && items.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>Entité</th>
                <th>Type</th>
                <th>Échéance</th>
                <th>Statut</th>
                <th>Responsable</th>
                <th>Dernière</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const colors = STATUS_COLORS[c.status] || STATUS_COLORS.A_FAIRE;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.entity_name || c.entity_id}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {c.entity_type === 'vehicle' ? 'Véhicule' : 'Équipement'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.type_code}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{c.type_name}</div>
                    </td>
                    <td>{formatDueLabel(c.next_due_date)}</td>
                    <td>
                      <StatusBadge
                        style={{
                          background: colors.bg,
                          color: colors.fg,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {STATUS_LABELS[c.status] || c.status}
                      </StatusBadge>
                    </td>
                    <td>{c.assigned_name || '—'}</td>
                    <td>{c.last_done_date || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setPerform(c)}
                        icon={<CheckCircle2 size={14} />}
                      >
                        Effectuer
                      </Button>{' '}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHistory(c)}
                        icon={<History size={14} />}
                        aria-label="Historique"
                      />
                      {isAdmin && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditor({ control: c })}
                            icon={<Pencil size={14} />}
                            aria-label="Modifier"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(c)}
                            icon={<Trash2 size={14} />}
                            aria-label="Supprimer"
                          />
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </ModuleContent>

      {perform && (
        <ControlPerformModal control={perform} onClose={() => setPerform(null)} onDone={load} />
      )}
      {history && <ControlHistoryModal control={history} onClose={() => setHistory(null)} />}
      {editor && (
        <ControlEditorModal
          control={editor.control}
          entityType={editor.control.entity_type}
          entityId={editor.control.entity_id}
          onClose={() => setEditor(null)}
          onSaved={load}
        />
      )}
    </ModuleLayout>
  );
}
