import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit2,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { TableVirtuoso } from 'react-virtuoso';

import { Avatar, Button, EmptyState, SearchBar, Select, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { formatPhoneDisplay } from '../PhoneInput';
import { POSITION_CATEGORIES } from './personnelConstants';
import {
  CONTRACT_TYPES,
  NON_PERMANENT_TYPES,
  PERMANENT_TYPES,
  PERSON_TYPES,
} from './personnelConstants';
import { PersonnelSlidePanel } from './PersonnelDetailPanel';
import PersonnelFormModal from './PersonnelFormModal';
import PersonnelImportModal from './PersonnelImportModal';

// ═══════════════════════════════════════
// Composants TableVirtuoso pour la liste personnel
// Définis au module-level pour éviter remounts à chaque render.
// `context` est utilisé pour transmettre selectedId + handlers aux rows.
// ═══════════════════════════════════════
const PpVirtuosoScroller = forwardRef(function PpVirtuosoScroller(props, ref) {
  return <div {...props} ref={ref} />;
});
const PpVirtuosoTable = (props) => <table {...props} className="eq-table pp-table" />;
const PpVirtuosoTableHead = forwardRef(function PpVirtuosoTableHead(props, ref) {
  return <thead {...props} ref={ref} />;
});
const PpVirtuosoTableBody = forwardRef(function PpVirtuosoTableBody(props, ref) {
  return <tbody {...props} ref={ref} />;
});
const PpVirtuosoTableRow = ({ item, context, ...rest }) => {
  if (item?.__group) {
    return <tr {...rest} className="pp-group-header" />;
  }
  const selectedId = context?.selectedId;
  const isSelected = item?.id === selectedId;
  return (
    <tr
      {...rest}
      className={`pp-person-row ${isSelected ? 'selected' : ''}`}
      onClick={() => context?.onSelect?.(item)}
      onDoubleClick={() => context?.onEdit?.(item)}
    />
  );
};

const PP_TABLE_COMPONENTS = {
  Scroller: PpVirtuosoScroller,
  Table: PpVirtuosoTable,
  TableHead: PpVirtuosoTableHead,
  TableBody: PpVirtuosoTableBody,
  TableRow: PpVirtuosoTableRow,
};

export const PersonsTab = ({
  persons,
  setPersons,
  skills,
  positions = [],
  users,
  currentUser,
  personToEdit,
  onPersonToEditConsumed,
}) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const filteredPersons = useMemo(
    () =>
      persons.filter((p) => {
        const matchSearch = `${p.firstName} ${p.lastName} ${p.email || ''} ${p.phone || ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchType =
          !filterType ||
          (filterType === '_permanent'
            ? PERMANENT_TYPES.includes(p.type)
            : filterType === '_non_permanent'
              ? NON_PERMANENT_TYPES.includes(p.type)
              : p.type === filterType);
        const matchStatus = !filterStatus || p.status === filterStatus;
        return matchSearch && matchType && matchStatus;
      }),
    [persons, searchTerm, filterType, filterStatus],
  );

  // Stats
  const stats = useMemo(() => {
    const total = persons.length;
    const active = persons.filter((p) => p.status === STATUS.ACTIVE).length;
    const permanent = persons.filter((p) => PERMANENT_TYPES.includes(p.type)).length;
    const nonPermanent = persons.filter((p) => NON_PERMANENT_TYPES.includes(p.type)).length;
    const inactive = persons.filter((p) => p.status === STATUS.INACTIVE).length;
    return { total, active, permanent, nonPermanent, inactive };
  }, [persons]);

  const openEdit = useCallback((person) => {
    setEditingPerson(person);
    setShowFormModal(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditingPerson(null);
    setShowFormModal(true);
  }, []);

  // Ouvrir automatiquement la fiche si une personne est demandée par le parent
  useEffect(() => {
    if (personToEdit) {
      openEdit(personToEdit);
      onPersonToEditConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personToEdit]);

  const handleSave = async (payload) => {
    try {
      const forfaitPatch = payload._forfait;
      const cleanPayload = { ...payload };
      delete cleanPayload._forfait;

      let personId;
      if (editingPerson) {
        const updated = await api.updatePerson(editingPerson.id, cleanPayload);
        setPersons((prev) => prev.map((p) => (p.id === editingPerson.id ? updated : p)));
        personId = editingPerson.id;
      } else {
        const created = await api.createPerson(cleanPayload);
        setPersons((prev) => [...prev, created]);
        personId = created?.id;
      }

      if (forfaitPatch && personId) {
        try {
          await api.updateForfaitConfig(personId, forfaitPatch);
        } catch (fErr) {
          const errs = fErr?.response?.data?.eligibility?.errors || [];
          if (errs.length > 0) {
            const msgs = errs.map((err) => {
              if (err.code === 'CLASSIFICATION_TOO_LOW') return `niveau ≥ ${err.min} requis`;
              if (err.code === 'SALARY_BELOW_MIN')
                return `salaire ≥ ${err.required} € (min + ${err.premiumPct} %)`;
              if (err.code === 'NOT_PERMANENT') return 'type permanent requis';
              return err.code;
            });
            toast.warning(`Fiche enregistrée. Forfait-jours non activé : ${msgs.join(' · ')}`);
          } else {
            const msg = fErr?.response?.data?.error || fErr?.message || 'Erreur config forfait';
            toast.error(`Fiche enregistrée, forfait non appliqué : ${msg}`);
          }
        }
      }

      refreshBus.publish('persons');
      setShowFormModal(false);
      setEditingPerson(null);
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = useCallback(
    (id) => {
      confirm({
        title: 'Supprimer cette personne',
        message: 'Supprimer cette personne ?',
        variant: 'danger',
        confirmLabel: 'Supprimer',
        onConfirm: async () => {
          try {
            await api.deletePerson(id);
            refreshBus.publish('persons');
            setPersons((prev) => prev.filter((p) => p.id !== id));
            if (selectedPerson?.id === id) setSelectedPerson(null);
          } catch (err) {
            toast.error('Erreur : ' + (err.message || 'Impossible de supprimer'));
          }
        },
      });
    },
    // setPersons est stable (setter useState), pas besoin dans les deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirm, selectedPerson, toast],
  );

  const getTypeBadge = useCallback((person) => {
    const t = person.type;
    if (t === 'permanent') return { label: 'Permanent', cls: 'type-permanent' };
    if (t === 'salarié') return { label: 'Salarié', cls: 'type-salarie' };
    if (t === 'stagiaire') return { label: 'Stagiaire', cls: 'type-stagiaire' };
    if (t === 'apprenti') return { label: 'Apprenti', cls: 'type-apprenti' };
    if (t === 'contractuel') {
      const sub =
        CONTRACT_TYPES.find((c) => c.value === person.contractType)?.label ||
        person.contractType ||
        'Contractuel';
      return { label: sub, cls: 'type-contractuel' };
    }
    return { label: t, cls: '' };
  }, []);

  // [PERF Sprint 4] Mémorisation des sous-listes permanents/non-permanents :
  // évite 2 .filter() supplémentaires à chaque render (en plus de filteredPersons).
  const permanentsList = useMemo(
    () => filteredPersons.filter((p) => PERMANENT_TYPES.includes(p.type)),
    [filteredPersons],
  );
  const nonPermanentsList = useMemo(
    () => filteredPersons.filter((p) => NON_PERMANENT_TYPES.includes(p.type)),
    [filteredPersons],
  );

  // [PERF Phase 4.L] Données aplaties pour TableVirtuoso :
  // chaque élément est soit un séparateur de groupe (__group=true), soit une personne.
  // Cela permet la virtualisation tout en conservant les en-têtes de section.
  const ppTableData = useMemo(() => {
    const items = [];
    if (permanentsList.length > 0) {
      items.push({
        __group: true,
        kind: 'permanent',
        label: 'Permanents',
        count: permanentsList.length,
      });
      items.push(...permanentsList);
    }
    if (nonPermanentsList.length > 0) {
      items.push({
        __group: true,
        kind: 'non-permanent',
        label: 'Non-permanents',
        count: nonPermanentsList.length,
      });
      items.push(...nonPermanentsList);
    }
    return items;
  }, [permanentsList, nonPermanentsList]);

  // Context partagé avec les composants TableVirtuoso (au module-level).
  // Toggle sélection au clic, ouverture édition au double-clic.
  const ppTableContext = useMemo(
    () => ({
      selectedId: selectedPerson?.id || null,
      onSelect: (person) => setSelectedPerson((prev) => (prev?.id === person.id ? null : person)),
      onEdit: (person) => openEdit(person),
    }),
    // openEdit est stable (defined plus haut sans deps externes); selectedPerson change le HIT visuel
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPerson?.id],
  );

  return (
    <div className="personnel-tab-content">
      {/* Toolbar */}
      <div className="eq-toolbar pp-toolbar">
        <div className="eq-toolbar-actions">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher..."
            size="sm"
          />
          <Select
            className="eq-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Tous les types</option>
            {PERSON_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          {currentUser?.isAdmin && (
            <Tooltip content="Importer depuis un CSV" position="bottom">
              <Button variant="secondary" onClick={() => setShowImportModal(true)}>
                <Upload size={14} /> Import CSV
              </Button>
            </Tooltip>
          )}
          <Button variant="primary" onClick={openCreate}>
            <Plus size={14} /> Personnel
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="eq-header pp-header">
        <div className="eq-stats-row">
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat ${!filterType && !filterStatus ? 'active' : ''}`}
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
            }}
          >
            <Users size={16} />
            <span className="eq-stat-value">{stats.total}</span>
            <span className="eq-stat-label">Total</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat eq-stat-available ${filterStatus === STATUS.ACTIVE ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus(filterStatus === STATUS.ACTIVE ? '' : 'active');
              setFilterType('');
            }}
          >
            <CheckCircle size={16} />
            <span className="eq-stat-value">{stats.active}</span>
            <span className="eq-stat-label">Actifs</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat eq-stat-inuse ${filterType === '_permanent' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('');
              setFilterType(filterType === '_permanent' ? '' : '_permanent');
            }}
          >
            <User size={16} />
            <span className="eq-stat-value">{stats.permanent}</span>
            <span className="eq-stat-label">Permanents</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat eq-stat-maint ${filterType === '_non_permanent' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('');
              setFilterType(filterType === '_non_permanent' ? '' : '_non_permanent');
            }}
          >
            <Clock size={16} />
            <span className="eq-stat-value">{stats.nonPermanent}</span>
            <span className="eq-stat-label">Non-permanents</span>
          </div>
          {stats.inactive > 0 && (
            <div
              role="button"
              tabIndex={0}
              className={`eq-stat eq-stat-tickets ${filterStatus === STATUS.INACTIVE ? 'active' : ''}`}
              onClick={() => setFilterStatus(filterStatus === STATUS.INACTIVE ? '' : 'inactive')}
            >
              <AlertTriangle size={16} />
              <span className="eq-stat-value">{stats.inactive}</span>
              <span className="eq-stat-label">Inactifs</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="eq-content-wrapper">
        <div className="eq-content">
          {filteredPersons.length === 0 ? (
            <EmptyState
              icon={<Users size={48} strokeWidth={1} />}
              title={searchTerm ? 'Aucun résultat' : 'Aucune personne enregistrée'}
              description="Ajoutez votre premier personnel avec le bouton +"
            />
          ) : (
            <div className="eq-table-wrap">
              <TableVirtuoso
                style={{ height: '100%' }}
                data={ppTableData}
                overscan={200}
                increaseViewportBy={200}
                components={PP_TABLE_COMPONENTS}
                computeItemKey={(_idx, item) => (item?.__group ? `g-${item.kind}` : `p-${item.id}`)}
                context={ppTableContext}
                fixedHeaderContent={() => (
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Catégorie</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Postes</th>
                    <th>Statut</th>
                    <th style={{ width: 70 }}>Actions</th>
                  </tr>
                )}
                itemContent={(_idx, item) => {
                  if (item?.__group) {
                    return (
                      <td colSpan={9}>
                        <span className={`pp-group-label ${item.kind}`}>
                          {item.label} ({item.count})
                        </span>
                      </td>
                    );
                  }
                  const person = item;
                  const badge = getTypeBadge(person);
                  let postes = [];
                  try {
                    const raw = person.defaultPositions || person.default_positions;
                    postes = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
                  } catch {
                    /* ignore */
                  }
                  return (
                    <>
                      <td className="eq-table-thumb">
                        <Avatar name={`${person.firstName} ${person.lastName}`} size="xs" />
                      </td>
                      <td className="eq-table-name">{person.lastName}</td>
                      <td>{person.firstName}</td>
                      <td>
                        <span className={`pp-type-badge ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="pp-phone-cell">{formatPhoneDisplay(person.phone) || '—'}</td>
                      <td className="pp-email-cell">{person.email || '—'}</td>
                      <td className="pp-postes-cell">
                        {postes.length > 0 ? (
                          <div className="pp-postes-chips">
                            {postes.slice(0, 2).map((name, i) => {
                              const posObj = positions.find((p) => p.name === name);
                              const catColor =
                                POSITION_CATEGORIES.find((c) => c.value === posObj?.category)
                                  ?.color || 'var(--theme-text-gray)';
                              return (
                                <span
                                  key={i}
                                  className="skill-chip-mini"
                                  style={{ '--chip-color': catColor }}
                                >
                                  {name}
                                </span>
                              );
                            })}
                            {postes.length > 2 && (
                              <span className="skill-more">+{postes.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`pp-status-dot ${person.status}`}>
                          {person.status === STATUS.ACTIVE ? '● Actif' : '○ Inactif'}
                        </span>
                      </td>
                      <td className="pp-actions-cell">
                        <Tooltip content="Modifier">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(person);
                            }}
                            aria-label="Modifier"
                          >
                            <Edit2 size={14} />
                          </Button>
                        </Tooltip>
                        {currentUser?.isAdmin && (
                          <Tooltip content="Supprimer">
                            <Button
                              variant="danger"
                              size="sm"
                              iconOnly
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(person.id);
                              }}
                              aria-label="Supprimer"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </Tooltip>
                        )}
                      </td>
                    </>
                  );
                }}
              />
            </div>
          )}
        </div>

        {/* Slide panel détail (clic simple) */}
        <PersonnelSlidePanel
          person={selectedPerson}
          positions={positions}
          skills={skills}
          onClose={() => setSelectedPerson(null)}
          onEdit={(person) => {
            setSelectedPerson(null);
            openEdit(person);
          }}
        />
      </div>

      {/* Modal formulaire (ajout/édition) */}
      {showFormModal && (
        <PersonnelFormModal
          person={editingPerson}
          skills={skills}
          positions={positions}
          users={users}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={() => {
            setShowFormModal(false);
            setEditingPerson(null);
          }}
        />
      )}

      {/* Modal Import CSV */}
      {showImportModal && (
        <PersonnelImportModal
          onClose={() => setShowImportModal(false)}
          onImportDone={async () => {
            try {
              const data = await api.getPersons();
              setPersons(data);
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      {ConfirmDialogRenderer}
    </div>
  );
};

export default PersonsTab;
