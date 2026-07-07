// ═══════════════════════════════════════════════════════════════
// ControlsDashboard.jsx — Tableau de bord des contrôles périodiques
// ═══════════════════════════════════════════════════════════════
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Package,
  Pencil,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  EmptyState,
  ModuleContent,
  ModuleLayout,
  Select,
  Spinner,
  Table,
} from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useListResource } from '../../hooks/useListResource';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { toThumbUrl } from '../equipment/equipmentUtils';
import ControlEditorModal from './ControlEditorModal';
import ControlHistoryModal from './ControlHistoryModal';
import './ControlsDashboard.css';
import { formatDateFR, formatRelativeDays, STATUS_COLORS, STATUS_LABELS } from './utils';

// Lazy : le panneau d'import PV n'est utile qu'aux admins, on n'embarque pas
// son bundle (drop-zone, parser, etc.) pour les utilisateurs standards.
const PvImportPanel = lazy(() => import('../pv-import/PvImportPanel'));

const STATS_CARDS = [
  { key: 'total', label: 'Total', icon: ShieldAlert, color: '#0f172a' },
  { key: 'a_faire', label: 'À faire', icon: Clock, color: '#1e40af' },
  { key: 'en_retard', label: 'En retard', icon: AlertTriangle, color: '#92400e' },
  { key: 'manque', label: 'Manqués', icon: AlertTriangle, color: '#991b1b' },
  { key: 'within_30', label: 'Sous 30 j', icon: Clock, color: '#0e7490' },
  { key: 'within_7', label: 'Sous 7 j', icon: Clock, color: '#b91c1c' },
];

export default function ControlsDashboard({ user }) {
  const isAdmin = !!user?.isAdmin || !!user?.is_admin || user?.role === 'admin';
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    entity_type: '',
    type_id: '',
    assigned_to: '',
  });
  // Filtres appliqués côté client (le backend renvoie déjà la liste filtrée
  // par status/entity_type/type_id ; ces deux-là sont purement UX et évitent
  // un aller-retour réseau).
  const [dueWindow, setDueWindow] = useState(''); // '', 'overdue', 'within_7', 'within_30', 'upcoming'
  const [subtype, setSubtype] = useState('');
  // Tri par clic sur les en-têtes. Valeur initiale = échéance croissante (ordre
  // SQL d'origine), pour ne pas surprendre l'utilisateur.
  const [sort, setSort] = useState({ key: 'next_due_date', dir: 'asc' });
  const [history, setHistory] = useState(null);
  const [editor, setEditor] = useState(null); // { control } pour éditer
  const [pvImportOpen, setPvImportOpen] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const fetchDashboard = useCallback(async () => {
    const r = await api.getControlsDashboard(filters);
    if (!r?.success) throw new Error(r?.error || 'Erreur');
    // Le backend renvoie { success, data: rows, stats } — data est directement
    // la liste des contrôles, stats est au même niveau que data.
    return { items: r.data || [], stats: r.stats || {} };
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

  // Rafraîchissement automatique :
  //   - quand l'onglet/fenêtre redevient visible (retour depuis un autre
  //     workspace, un autre onglet navigateur, ou levée du screensaver) ;
  //   - quand la fenêtre reprend le focus (changement d'app macOS).
  // Évite d'avoir un bouton « Actualiser » manuel : les données restent
  // toujours fraîches sans action utilisateur.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const onFocus = () => load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  // Helper : extrait la sous-catégorie d'un contrôle (type véhicule ou
  // catégorie équipement) à partir du sous-titre fourni par le backend.
  // Véhicule : « TYPE · BRAND MODEL » → on garde le « TYPE ».
  // Équipement : sous-titre = nom catégorie feuille (gardé tel quel).
  const subtypeOf = (c) => {
    const raw = (c.entity_subtitle || '').trim();
    if (!raw) return '';
    if (c.entity_type === 'vehicle') {
      const head = raw.split('·')[0].trim();
      return head || raw;
    }
    return raw;
  };

  const allItems = data.items;

  // Liste distincte des sous-catégories présentes (utilisée pour peupler le
  // Select). Calculée sur l'ensemble brut pour ne pas se vider quand on filtre.
  const subtypeOptions = useMemo(() => {
    const set = new Set();
    for (const c of allItems) {
      const s = subtypeOf(c);
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [allItems]);

  const items = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filtered =
      !dueWindow && !subtype
        ? allItems
        : allItems.filter((c) => {
            if (subtype && subtypeOf(c) !== subtype) return false;
            if (dueWindow) {
              const isLate = c.status === 'EN_RETARD' || c.status === 'MANQUE';
              if (dueWindow === 'overdue') {
                if (!isLate) return false;
              } else {
                if (isLate) return false;
                if (!c.next_due_date) return false;
                const due = new Date(c.next_due_date + 'T00:00:00');
                const days = Math.round((due.getTime() - today.getTime()) / 86400000);
                if (dueWindow === 'within_7' && !(days >= 0 && days <= 7)) return false;
                if (dueWindow === 'within_30' && !(days >= 0 && days <= 30)) return false;
                if (dueWindow === 'upcoming' && !(days >= 0)) return false;
              }
            }
            return true;
          });

    // Tri : accesseur par clé + comparateur générique (string localeCompare,
    // dates ISO comparables lexicographiquement, null toujours en queue).
    const accessors = {
      entity_name: (c) => (c.entity_name || c.entity_id || '').toString().toLowerCase(),
      type_code: (c) => (c.type_code || '').toString().toLowerCase(),
      next_due_date: (c) => c.next_due_date || '',
      status: (c) => c.status || '',
      assigned_name: (c) => (c.assigned_name || '').toString().toLowerCase(),
      last_done_date: (c) => c.last_done_date || '',
    };
    const accessor = accessors[sort.key];
    if (!accessor) return filtered;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      // Vides toujours en bas, indépendamment du sens.
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [allItems, dueWindow, subtype, sort]);

  const toggleSort = (key) => {
    setSort((s) => {
      if (s.key !== key) return { key, dir: 'asc' };
      return { key, dir: s.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  // Helper rendu icône de tri. Volontairement nommé en minuscule + appelé
  // comme une fonction (pas un composant) pour éviter la règle eslint-plugin-
  // react « Cannot create components during render » qui interdit la
  // déclaration d'un composant à l'intérieur d'un autre composant.
  const renderSortIcon = (k) => {
    if (sort.key !== k) return <ArrowUpDown size={12} className="ctrl-th-sort-icon" />;
    return sort.dir === 'asc' ? (
      <ArrowUp size={12} className="ctrl-th-sort-icon is-active" />
    ) : (
      <ArrowDown size={12} className="ctrl-th-sort-icon is-active" />
    );
  };

  const handleDelete = (ctrl) => {
    confirm({
      title: 'Désactiver le contrôle',
      message: `Désactiver le contrôle « ${ctrl.type_name} » ?`,
      variant: 'danger',
      confirmLabel: 'Désactiver',
      onConfirm: async () => {
        const r = await api.deleteControl(ctrl.id);
        if (r?.success) {
          refreshBus.publish('controls');
          load();
        } else {
          window.alert(r?.error || 'Erreur suppression');
        }
      },
    });
  };

  return (
    <ModuleLayout>
      <ModuleContent>
        {/* Filtres uniquement. Les actions « Actualiser » / « Recalcul global »
            ont été retirées : le rechargement est automatique au retour sur
            l'onglet/fenêtre et après toute mutation via refreshBus. */}
        <div className="ctrl-toolbar">
          <div className="ctrl-filters">
            <Select
              size="sm"
              fullWidth
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Tous statuts</option>
              <option value="A_FAIRE">À faire</option>
              <option value="EN_RETARD">En retard</option>
              <option value="MANQUE">Manqué</option>
            </Select>
            <Select
              size="sm"
              fullWidth
              value={filters.entity_type}
              onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))}
            >
              <option value="">Toutes entités</option>
              <option value="vehicle">Véhicules</option>
              <option value="equipment">Équipements</option>
            </Select>
            <Select
              size="sm"
              fullWidth
              value={filters.type_id}
              onChange={(e) => setFilters((f) => ({ ...f, type_id: e.target.value }))}
            >
              <option value="">Tous types contrôle</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.name}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              fullWidth
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
            >
              <option value="">Toutes catégories</option>
              {subtypeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              fullWidth
              value={dueWindow}
              onChange={(e) => setDueWindow(e.target.value)}
            >
              <option value="">Toutes échéances</option>
              <option value="overdue">Dépassée</option>
              <option value="within_7">Sous 7 j</option>
              <option value="within_30">Sous 30 j</option>
              <option value="upcoming">À venir</option>
            </Select>
          </div>
          {isAdmin && (
            <div className="ctrl-toolbar-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPvImportOpen(true)}
                title="Importer un PV PDF (rapport de contrôle)"
              >
                <Upload size={14} /> Importer PV PDF
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="ctrl-stats-grid">
          {STATS_CARDS.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="ctrl-stat-card" style={{ '--ctrl-accent': color }}>
              <div className="ctrl-stat-header">
                <Icon size={14} />
                <span>{label}</span>
              </div>
              <div className="ctrl-stat-value">{data.stats?.[key] ?? 0}</div>
            </div>
          ))}
        </div>

        {error && <div className="ctrl-error">{error.message}</div>}

        {loading && <Spinner />}

        {!loading && items.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 size={48} />}
            title="Aucun contrôle à afficher"
            description="Aucun contrôle ne correspond à vos filtres actuels."
          />
        )}

        {!loading && items.length > 0 && (
          <div className="ctrl-table-wrap">
            <Table className="ctrl-table">
              <thead>
                <tr>
                  <th
                    className="is-sortable"
                    onClick={() => toggleSort('entity_name')}
                    aria-sort={
                      sort.key === 'entity_name'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    Entité {renderSortIcon('entity_name')}
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => toggleSort('type_code')}
                    aria-sort={
                      sort.key === 'type_code'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    Type {renderSortIcon('type_code')}
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => toggleSort('next_due_date')}
                    aria-sort={
                      sort.key === 'next_due_date'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    Échéance {renderSortIcon('next_due_date')}
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => toggleSort('status')}
                    aria-sort={
                      sort.key === 'status'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    Statut {renderSortIcon('status')}
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => toggleSort('assigned_name')}
                    aria-sort={
                      sort.key === 'assigned_name'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    Responsable {renderSortIcon('assigned_name')}
                  </th>
                  <th
                    className="is-sortable"
                    onClick={() => toggleSort('last_done_date')}
                    aria-sort={
                      sort.key === 'last_done_date'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    Dernière {renderSortIcon('last_done_date')}
                  </th>
                  <th className="ctrl-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const colors = STATUS_COLORS[c.status] || STATUS_COLORS.A_FAIRE;
                  const isVehicle = c.entity_type === 'vehicle';
                  const entityKind = isVehicle ? 'Véhicule' : 'Équipement';
                  // Sous-titre fourni par le backend (type véhicule + brand/model, ou catégorie eq).
                  const subtitle = (c.entity_subtitle || '').trim().replace(/^· /, '').trim();
                  const dueRel = formatRelativeDays(c.next_due_date);
                  const isLate = c.status === 'EN_RETARD' || c.status === 'MANQUE';
                  // "Sous 7 j" → warning amber.
                  let isSoon = false;
                  if (!isLate && c.next_due_date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const due = new Date(c.next_due_date + 'T00:00:00');
                    const days = Math.round((due.getTime() - today.getTime()) / 86400000);
                    isSoon = days >= 0 && days <= 7;
                  }
                  const dueCls = `ctrl-due${isLate ? ' is-late' : isSoon ? ' is-soon' : ''}`;
                  const dueRelCls = `ctrl-due-rel${isLate ? ' is-late' : isSoon ? ' is-soon' : ''}`;
                  // Photo : construit l'URL selon entity_type. Les valeurs
                  // « generic:… » (catégorie équipement) sont ignorées :
                  // pas de miniature, on retombe sur le placeholder.
                  let photoUrl = null;
                  if (c.entity_photo && !c.entity_photo.startsWith('generic:')) {
                    const rawPhotoUrl = isVehicle
                      ? `/Photos/${c.entity_photo}`
                      : `/Photos/Matériel/${c.entity_photo}`;
                    photoUrl = toThumbUrl(rawPhotoUrl, 80);
                  }
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="ctrl-entity-cell">
                          {photoUrl ? (
                            <img
                              className="ctrl-entity-thumb"
                              src={photoUrl}
                              alt=""
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.style.removeProperty('display');
                              }}
                            />
                          ) : null}
                          <div
                            className="ctrl-entity-thumb ctrl-entity-thumb-placeholder"
                            style={photoUrl ? { display: 'none' } : undefined}
                            aria-hidden="true"
                          >
                            {isVehicle ? <Truck size={18} /> : <Package size={18} />}
                          </div>
                          <div className="ctrl-entity-info">
                            <div className="ctrl-entity-name" title={c.entity_name || c.entity_id}>
                              {c.entity_name || c.entity_id}
                            </div>
                            <div className="ctrl-entity-meta">
                              <span className={`ctrl-kind-pill${isVehicle ? ' is-vehicle' : ''}`}>
                                {entityKind}
                              </span>
                              {subtitle && <span>{subtitle}</span>}
                              {c.entity_uid && <span className="ctrl-uid">{c.entity_uid}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="ctrl-type-code">{c.type_code}</div>
                        <div className="ctrl-type-name">{c.type_name}</div>
                      </td>
                      <td>
                        <div className={dueCls}>{formatDateFR(c.next_due_date)}</div>
                        {dueRel && <div className={dueRelCls}>{dueRel}</div>}
                      </td>
                      <td>
                        <span
                          className="ctrl-status-pill"
                          style={{
                            background: colors.bg,
                            color: colors.fg,
                            borderColor: colors.border,
                          }}
                        >
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td>{c.assigned_name || <span className="ctrl-muted">—</span>}</td>
                      <td>
                        {c.last_done_date ? (
                          <>
                            <div className="ctrl-last">{formatDateFR(c.last_done_date)}</div>
                            <div className="ctrl-last-rel">
                              {formatRelativeDays(c.last_done_date)}
                            </div>
                          </>
                        ) : (
                          <span className="ctrl-muted">—</span>
                        )}
                      </td>
                      <td className="ctrl-actions-cell">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            // Équipement : ouvre directement l'éditeur de
                            // contrôle (mode édition, pas de bascule module).
                            // Véhicule : déclenche le modal KM & CT (édition
                            // des contrôles techniques) géré au niveau App.jsx.
                            if (c.entity_type === 'equipment') {
                              setEditor({ control: c });
                            } else {
                              window.dispatchEvent(
                                new CustomEvent('emag:open-entity', {
                                  detail: { type: c.entity_type, id: c.entity_id },
                                }),
                              );
                            }
                          }}
                          icon={<ExternalLink size={14} />}
                        >
                          Ouvrir
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
          </div>
        )}
      </ModuleContent>

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
      {ConfirmDialogRenderer}
      {pvImportOpen && (
        <Suspense fallback={null}>
          <PvImportPanel
            open={pvImportOpen}
            onClose={() => {
              setPvImportOpen(false);
              load();
            }}
          />
        </Suspense>
      )}
    </ModuleLayout>
  );
}
