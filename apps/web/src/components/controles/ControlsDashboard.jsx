// ═══════════════════════════════════════════════════════════════
// ControlsDashboard.jsx — Tableau de bord des contrôles périodiques
// ═══════════════════════════════════════════════════════════════
import './ControlsDashboard.css';

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  History,
  Package,
  Pencil,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  EmptyState,
  Modal,
  ModalBody,
  ModalHeader,
  ModuleContent,
  ModuleLayout,
  Select,
  Spinner,
  Table,
} from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useListResource } from '../../hooks/useListResource';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { toThumbUrl } from '../equipment/equipmentUtils';
import ControlEditorModal from './ControlEditorModal';
import ControlHistoryModal from './ControlHistoryModal';
import { formatDateFR, formatRelativeDays, STATUS_COLORS, STATUS_LABELS } from './utils';

// Lazy : le panneau d'import PV n'est utile qu'aux admins, on n'embarque pas
// son bundle (drop-zone, parser, etc.) pour les utilisateurs standards.
const PvImportPanel = lazy(() => import('../pv-import/PvImportPanel'));
const EquipmentDetailDialog = lazy(() =>
  import('../equipment/EquipmentDetail').then((m) => ({ default: m.EquipmentDetailDialog })),
);

const STATS_CARDS = [
  { key: 'total', label: 'Total', icon: ShieldAlert, color: '#0f172a' },
  { key: 'a_faire', label: 'À faire', icon: Clock, color: '#1e40af' },
  { key: 'en_retard', label: 'En retard', icon: AlertTriangle, color: '#92400e' },
  { key: 'manque', label: 'Manqués', icon: AlertTriangle, color: '#991b1b' },
  { key: 'within_30', label: 'Sous 30 j', icon: Clock, color: '#0e7490' },
  { key: 'within_7', label: 'Sous 7 j', icon: Clock, color: '#b91c1c' },
];

export default function ControlsDashboard({ user, onNavigateToEntity }) {
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
  const [entityDialog, setEntityDialog] = useState(null);
  const [pvImportOpen, setPvImportOpen] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const entityRequestRef = useRef(0);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const toast = useToast();

  const openEntity = async (control) => {
    if (control.entity_type !== 'equipment') {
      onNavigateToEntity?.(control.entity_type, { id: control.entity_id });
      return;
    }

    const requestId = ++entityRequestRef.current;
    setEntityDialog({ equipment: null, loading: true });
    try {
      const [equipment, categoryResult, photoResult, listsResult] = await Promise.all([
        api.getEquipmentById(control.entity_id),
        api.getEquipmentCategories(),
        api.getEquipmentPhotos().then(
          (data) => ({ data }),
          (error) => ({ error }),
        ),
        api.getEquipmentLists().then(
          (data) => ({ data }),
          (error) => ({ error }),
        ),
      ]);
      if (entityRequestRef.current === requestId) {
        const photosData = photoResult.data || { photos: [], logos: [] };
        const lists = listsResult.data || [];
        const optionalErrors = [photoResult.error, listsResult.error].filter(Boolean);
        if (optionalErrors.length) {
          toast.warning(
            'La fiche est ouverte, mais certaines informations annexes sont indisponibles.',
          );
        }
        setEntityDialog({
          equipment,
          loading: false,
          categories: categoryResult,
          photosList: photosData.photos || [],
          logosList: photosData.logos || [],
          favoriteIds: new Set(
            lists
              .filter(
                (item) =>
                  item.list_type === 'favorite' &&
                  Number(item.equipment_id) === Number(equipment.id),
              )
              .map((item) => Number(item.equipment_id)),
          ),
          watchIds: new Set(
            lists
              .filter(
                (item) =>
                  item.list_type === 'watch' && Number(item.equipment_id) === Number(equipment.id),
              )
              .map((item) => Number(item.equipment_id)),
          ),
        });
      }
    } catch (err) {
      if (entityRequestRef.current === requestId) {
        toast.error(`Impossible d’ouvrir la fiche équipement : ${err.message}`);
        setEntityDialog(null);
      }
    }
  };

  const closeEntity = () => {
    entityRequestRef.current++;
    setEntityDialog(null);
  };

  const toggleEntityList = async (equipmentId, listType) => {
    try {
      const selected =
        listType === 'favorite'
          ? entityDialog.favoriteIds.has(Number(equipmentId))
          : entityDialog.watchIds.has(Number(equipmentId));
      if (selected) {
        await api.removeFromEquipmentList(equipmentId, listType);
      } else {
        await api.addToEquipmentList(equipmentId, listType);
      }
      const lists = await api.getEquipmentLists();
      setEntityDialog((current) => {
        if (!current?.equipment || Number(current.equipment.id) !== Number(equipmentId)) {
          return current;
        }
        const listIds = (type) =>
          new Set(
            lists
              .filter(
                (item) =>
                  item.list_type === type &&
                  Number(item.equipment_id) === Number(current.equipment.id),
              )
              .map((item) => Number(item.equipment_id)),
          );
        return {
          ...current,
          favoriteIds: listIds('favorite'),
          watchIds: listIds('watch'),
        };
      });
    } catch (error) {
      toast.error(`Impossible de modifier la liste équipement : ${error.message}`);
    }
  };

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

  const exportControlsReport = async () => {
    setExportingReport(true);
    try {
      const report = await api.getControlsDashboard(
        filters.type_id ? { type_id: filters.type_id } : {},
      );
      if (!report?.success) throw new Error(report?.error || 'Impossible de charger les contrôles');

      const rows = [...(report.data || [])].sort((a, b) => {
        const typeCompare = (a.type_name || '').localeCompare(b.type_name || '', 'fr');
        if (typeCompare) return typeCompare;
        const dateCompare = (a.next_due_date || '9999').localeCompare(b.next_due_date || '9999');
        if (dateCompare) return dateCompare;
        return (a.entity_name || '').localeCompare(b.entity_name || '', 'fr');
      });
      if (rows.length === 0) {
        toast.info('Aucun contrôle à inclure dans ce rapport.');
        return;
      }

      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const selectedType = types.find((type) => String(type.id) === String(filters.type_id));
      const generatedAt = new Date();
      const generatedLabel = generatedAt.toLocaleString('fr-FR');
      const statusCounts = rows.reduce((counts, row) => {
        counts[row.status] = (counts[row.status] || 0) + 1;
        return counts;
      }, {});

      doc.setFontSize(15);
      doc.text('Rapport des contrôles périodiques', 14, 13);
      doc.setFontSize(9);
      doc.text(
        `Type : ${selectedType ? `${selectedType.code} · ${selectedType.name}` : 'Tous'}  |  Généré le ${generatedLabel}  |  ${rows.length} contrôle(s)`,
        14,
        19,
      );
      doc.text(
        `Effectués : ${statusCounts.EFFECTUE || 0}  ·  À faire : ${statusCounts.A_FAIRE || 0}  ·  En retard : ${statusCounts.EN_RETARD || 0}  ·  Manqués : ${statusCounts.MANQUE || 0}`,
        14,
        24,
      );

      autoTable(doc, {
        startY: 28,
        head: [
          [
            'Type de contrôle',
            'Entité',
            'N° série / immatriculation',
            'Échéance',
            'Statut',
            'Dernier contrôle',
            'Responsable',
            'Périodicité',
            'Observations / interventions',
          ],
        ],
        body: rows.map((row) => [
          `${row.type_code || ''} · ${row.type_name || ''}`,
          `${row.entity_name || row.entity_id || '—'}${row.entity_subtitle ? `\n${row.entity_subtitle}` : ''}`,
          row.entity_type === 'vehicle'
            ? row.entity_registration || '—'
            : row.entity_serial_numbers || row.entity_uid || '—',
          formatDateFR(row.next_due_date),
          STATUS_LABELS[row.status] || row.status || '—',
          formatDateFR(row.last_done_date),
          row.assigned_name || '—',
          row.periodicity_days ? `${row.periodicity_days} j` : '—',
          [
            row.observation,
            row.intervention_ticket_id ? `Demande SAV #${row.intervention_ticket_id}` : '',
          ]
            .filter(Boolean)
            .join('\n') || '—',
        ]),
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 36 },
          2: { cellWidth: 34 },
          3: { cellWidth: 20 },
          4: { cellWidth: 21 },
          5: { cellWidth: 23 },
          6: { cellWidth: 25 },
          7: { cellWidth: 19 },
          8: { cellWidth: 'auto' },
        },
        didDrawPage: (data) => {
          const pageHeight = doc.internal.pageSize.getHeight();
          const pageWidth = doc.internal.pageSize.getWidth();
          doc.setFontSize(8);
          doc.text(`Total : ${rows.length} contrôle(s)`, 14, pageHeight - 6);
          doc.text(`Page ${data.pageNumber}`, pageWidth - 24, pageHeight - 6);
        },
      });

      const typeSuffix = selectedType
        ? `_${String(selectedType.code || selectedType.name)
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '_')
            .replace(/^_|_$/g, '')}`
        : '';
      doc.save(`rapport_controles${typeSuffix}_${generatedAt.toISOString().slice(0, 10)}.pdf`);
      toast.success('Rapport PDF des contrôles téléchargé.');
    } catch (err) {
      console.error('Erreur export rapport contrôles:', err);
      toast.error(`Impossible de générer le rapport PDF : ${err.message}`);
    } finally {
      setExportingReport(false);
    }
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
          <div className="ctrl-toolbar-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={exportingReport || loading}
              onClick={exportControlsReport}
              title="Exporter tous les contrôles au format PDF"
            >
              <Download size={14} /> {exportingReport ? 'Export…' : 'Rapport PDF'}
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPvImportOpen(true)}
                title="Importer un PV PDF (rapport de contrôle)"
              >
                <Upload size={14} /> Importer PV PDF
              </Button>
            )}
          </div>
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
                  <th>Observations / interventions</th>
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
                            <Button
                              type="button"
                              className="ctrl-entity-name ctrl-entity-link"
                              title={`Ouvrir la fiche ${entityKind.toLowerCase()}`}
                              onClick={() => openEntity(c)}
                            >
                              {c.entity_name || c.entity_id}
                            </Button>
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
                      <td className="ctrl-observations-cell">
                        {c.observation ? (
                          <div className="ctrl-observation-text" title={c.observation}>
                            {c.observation}
                          </div>
                        ) : (
                          <span className="ctrl-muted">—</span>
                        )}
                        {c.intervention_ticket_id && (
                          <div className="ctrl-intervention-ticket">
                            Demande SAV #{c.intervention_ticket_id}
                          </div>
                        )}
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
      {entityDialog?.loading && (
        <Modal open onClose={closeEntity} size="lg" className="eq-dialog">
          <ModalHeader onClose={closeEntity} className="eq-dialog-header">
            Fiche équipement
          </ModalHeader>
          <ModalBody className="eq-dialog-body">
            <Spinner />
          </ModalBody>
        </Modal>
      )}
      {entityDialog?.equipment && (
        <Suspense fallback={<Spinner />}>
          <EquipmentDetailDialog
            equipment={entityDialog.equipment}
            categories={entityDialog.categories}
            photosList={entityDialog.photosList}
            logosList={entityDialog.logosList}
            favoriteIds={entityDialog.favoriteIds}
            watchIds={entityDialog.watchIds}
            onToggleList={toggleEntityList}
            isAdmin={isAdmin}
            onClose={closeEntity}
          />
        </Suspense>
      )}
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
