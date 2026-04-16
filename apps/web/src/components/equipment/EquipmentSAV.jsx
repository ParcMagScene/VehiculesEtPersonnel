import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Edit2,
  Trash2,
  Wrench,
  Package,
  X,
  ExternalLink,
  Search,
  Calendar,
  CheckCircle,
  DollarSign,
  User,
} from 'lucide-react';
import { SAV_STATUS, SAV_PRIORITY, SAV_TYPES, cleanName } from './equipmentConstants';
import { getCategoryHierarchy } from './equipmentUtils';
import { safeDate } from '../../utils/formatUtils';
import { useToast } from '../../hooks/useToast';
import {
  Button,
  ModalLayout,
  Input,
  Textarea,
  Select,
  Table,
  EmptyState,
  Tooltip,
} from '@/design-system';

// ═══ LISTE DES TICKETS SAV ═══
const SavTicketsList = ({
  tickets,
  _equipment,
  _persons,
  selectedId,
  onSelect,
  onDoubleClick,
  onEdit,
  onDelete,
}) => {
  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={<Wrench size={48} strokeWidth={1} />}
        title="Aucun ticket SAV"
        description="Les tickets apparaîtront ici lorsque du matériel nécessitera une intervention"
      />
    );
  }

  return (
    <div className="eq-tickets-table">
      <Table>
        <thead>
          <tr>
            <th>Priorité</th>
            <th>Titre</th>
            <th>Matériel</th>
            <th className="sav-col-ref">Réf.</th>
            <th className="sav-col-uid">UID</th>
            <th className="sav-col-serial">N° Série</th>
            <th>Type</th>
            <th>Statut</th>
            <th className="sav-col-date">Début</th>
            <th className="sav-col-date">Fin</th>
            <th className="sav-col-cost">Coût</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
            const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
            return (
              <tr
                key={t.id}
                className={`eq-sav-row-clickable${selectedId === t.id ? ' selected' : ''}`}
                onClick={() => onSelect && onSelect(t)}
                onDoubleClick={() => onDoubleClick && onDoubleClick(t)}
              >
                <td>
                  <span
                    className="eq-pri-dot"
                    style={{ background: pri.color }}
                    title={pri.label}
                  />
                </td>
                <td className="eq-ticket-title-cell">{t.title}</td>
                <td>
                  <span className="eq-ticket-eq">
                    {t.categoryIcon}{' '}
                    {t.equipmentName || t.importName || (
                      <em className="eq-ticket-unlinked">Non lié</em>
                    )}
                  </span>
                </td>
                <td className="sav-col-ref">{t.equipmentReference || t.importCode || '—'}</td>
                <td className="sav-col-uid">
                  <code>{t.equipmentUid || '—'}</code>
                </td>
                <td className="sav-col-serial">
                  {t.equipmentSerialNumber || t.importSerial || '—'}
                </td>
                <td>{SAV_TYPES[t.type] || t.type}</td>
                <td>
                  <span className="eq-status-badge" style={{ background: tst.color }}>
                    {tst.label}
                  </span>
                </td>
                <td className="sav-col-date">{safeDate(t.createdAt)}</td>
                <td className="sav-col-date">{safeDate(t.resolvedAt)}</td>
                <td className="sav-col-cost">
                  {t.cost != null ? `${parseFloat(t.cost).toFixed(2)} €` : '—'}
                </td>
                <td>
                  <div className="eq-table-actions">
                    <Tooltip content="Modifier">
                      <Button
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(t);
                        }}
                      >
                        <Edit2 size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Supprimer">
                      <Button
                        variant="danger"
                        size="sm"
                        iconOnly
                        aria-label="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(t.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
};

// ═══ MODAL TICKET SAV ═══
const SavTicketFormModal = ({
  ticket,
  equipment,
  persons,
  categories,
  preselectedEquipment,
  onSave,
  onClose,
}) => {
  const toast = useToast();
  const [form, setForm] = useState({
    equipment_id: ticket?.equipmentId || ticket?.equipment_id || preselectedEquipment?.id || '',
    assigned_to: ticket?.assignedTo || ticket?.assigned_to || '',
    type: ticket?.type || 'panne',
    priority: ticket?.priority || 'medium',
    status: ticket?.status || 'open',
    title: ticket?.title || '',
    description: ticket?.description || '',
    resolution: ticket?.resolution || '',
    cost: ticket?.cost || '',
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allCategories = categories || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const familles = useMemo(
    () => allCategories.filter((c) => c.level === 'family'),
    [allCategories],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sousFamilles = useMemo(
    () => allCategories.filter((c) => c.level === 'subfamily'),
    [allCategories],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const types = useMemo(() => allCategories.filter((c) => c.level === 'category'), [allCategories]);

  const initEquipId = ticket?.equipmentId || ticket?.equipment_id || preselectedEquipment?.id || '';
  const initEquip = initEquipId ? equipment.find((e) => e.id === Number(initEquipId)) : null;
  const initHier = initEquip ? getCategoryHierarchy(initEquip, allCategories) : null;

  const [selFamille, setSelFamille] = useState(
    initHier?.family?.id ? String(initHier.family.id) : '',
  );
  const [selSousFamille, setSelSousFamille] = useState(
    initHier?.subfamily?.id ? String(initHier.subfamily.id) : '',
  );
  const [selType, setSelType] = useState(
    initHier?.category?.id ? String(initHier.category.id) : '',
  );

  const filteredSousFamilles = useMemo(() => {
    if (!selFamille) return [];
    return sousFamilles.filter((s) => String(s.parentId || s.parent_id) === selFamille);
  }, [sousFamilles, selFamille]);

  const filteredTypes = useMemo(() => {
    if (!selSousFamille) return [];
    return types.filter((t) => String(t.parentId || t.parent_id) === selSousFamille);
  }, [types, selSousFamille]);

  const filteredEquipment = useMemo(() => {
    if (selType) return equipment.filter((e) => String(e.categoryId || e.category_id) === selType);
    if (selSousFamille) {
      const typeIds = new Set(
        types.filter((t) => String(t.parentId || t.parent_id) === selSousFamille).map((t) => t.id),
      );
      return equipment.filter((e) => typeIds.has(e.categoryId || e.category_id));
    }
    if (selFamille) {
      const sfIds = sousFamilles
        .filter((s) => String(s.parentId || s.parent_id) === selFamille)
        .map((s) => s.id);
      const typeIds = new Set(
        types.filter((t) => sfIds.includes(t.parentId || t.parent_id)).map((t) => t.id),
      );
      return equipment.filter((e) => typeIds.has(e.categoryId || e.category_id));
    }
    return equipment;
  }, [equipment, sousFamilles, types, selFamille, selSousFamille, selType]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.equipment_id || !form.title.trim())
      return toast.warning('Équipement et titre requis');
    onSave({
      ...form,
      equipment_id: parseInt(form.equipment_id),
      assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
    });
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title={ticket ? '✏️ Modifier le ticket' : '🔧 Nouveau ticket SAV'}
      size="lg"
      className="eq-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="sav-ticket-form">
            {ticket ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form id="sav-ticket-form" onSubmit={handleSubmit} className="eq-modal-body">
        <div className="eq-form-grid">
          <div className="eq-form-field eq-form-full">
            <label>Équipement *</label>
            {preselectedEquipment && !ticket ? (
              <div className="eq-form-locked-value">
                {preselectedEquipment.category_icon || preselectedEquipment.categoryIcon || '📦'}{' '}
                {cleanName(preselectedEquipment.name)}{' '}
                {preselectedEquipment.reference ? `(${preselectedEquipment.reference})` : ''}
              </div>
            ) : (
              <>
                <div className="eq-form-cascade">
                  <Select
                    value={selFamille}
                    onChange={(e) => {
                      setSelFamille(e.target.value);
                      setSelSousFamille('');
                      setSelType('');
                      setForm((f) => ({ ...f, equipment_id: '' }));
                    }}
                  >
                    <option value="">— Famille —</option>
                    {familles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.icon || '📁'} {f.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={selSousFamille}
                    onChange={(e) => {
                      setSelSousFamille(e.target.value);
                      setSelType('');
                      setForm((f) => ({ ...f, equipment_id: '' }));
                    }}
                    disabled={!selFamille}
                  >
                    <option value="">— Catégorie —</option>
                    {filteredSousFamilles.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon || '📂'} {s.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={selType}
                    onChange={(e) => {
                      setSelType(e.target.value);
                      setForm((f) => ({ ...f, equipment_id: '' }));
                    }}
                    disabled={!selSousFamille}
                  >
                    <option value="">— Type —</option>
                    {filteredTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon || '📄'} {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Select
                  value={form.equipment_id}
                  onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                  required
                >
                  <option value="">— Sélectionner l'équipement —</option>
                  {filteredEquipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.categoryIcon || '📦'} {cleanName(eq.name)}{' '}
                      {eq.reference ? `(${eq.reference})` : ''}{' '}
                      {eq.serialNumber || eq.serial_number
                        ? `[S/N: ${eq.serialNumber || eq.serial_number}]`
                        : ''}
                    </option>
                  ))}
                </Select>
                {(() => {
                  const sel = form.equipment_id
                    ? equipment.find((e) => e.id === Number(form.equipment_id))
                    : null;
                  if (!sel) return null;
                  return (
                    <div className="eq-form-cascade-info">
                      {sel.reference && (
                        <span>
                          🏷️ Réf : <strong>{sel.reference}</strong>
                        </span>
                      )}
                      {(sel.serialNumber || sel.serial_number) && (
                        <span>
                          🔢 S/N : <strong>{sel.serialNumber || sel.serial_number}</strong>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <div className="eq-form-field eq-form-full">
            <label>Panne *</label>
            <Input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Batterie ne charge plus"
              autoFocus
            />
          </div>
          <div className="eq-form-field">
            <label>Type</label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(SAV_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="eq-form-field">
            <label>Priorité</label>
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {Object.entries(SAV_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
          {ticket && (
            <div className="eq-form-field">
              <label>Statut</label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {Object.entries(SAV_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="eq-form-field">
            <label>Technicien assigné</label>
            <Select
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            >
              <option value="">— Non assigné —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div className="eq-form-field eq-form-full">
            <label>Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Détails du problème, circonstances..."
            />
          </div>
          {ticket && (
            <>
              <div className="eq-form-field eq-form-full">
                <label>Résolution</label>
                <Textarea
                  value={form.resolution}
                  onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                  rows={2}
                  placeholder="Action corrective, pièces changées..."
                />
              </div>
              <div className="eq-form-field">
                <label>Coût (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </form>
    </ModalLayout>
  );
};

// ═══ FORMULAIRE DEMANDE SAV MOBILE ═══
const MobileSavRequestForm = ({ equipment, onSubmit, onClose }) => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'panne',
    priority: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];
    const q = search.toLowerCase();
    return equipment
      .filter(
        (eq) =>
          (eq.name && eq.name.toLowerCase().includes(q)) ||
          (eq.uid && eq.uid.toLowerCase().includes(q)) ||
          (eq.reference && eq.reference.toLowerCase().includes(q)) ||
          (eq.serialNumber && eq.serialNumber.toLowerCase().includes(q)),
      )
      .slice(0, 20);
  }, [equipment, search]);

  const handleSelect = (eq) => {
    setSelectedEquipment(eq);
    setSearch('');
    setShowResults(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquipment) return toast.warning('Sélectionnez un équipement');
    if (!form.title.trim()) return toast.warning('Titre requis');
    setSubmitting(true);
    try {
      await onSubmit({
        equipment_id: selectedEquipment.id,
        title: form.title,
        description: form.description,
        type: form.type,
        priority: form.priority,
      });
      toast.success('Demande SAV envoyée');
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="🔧 Demande de SAV"
      size="full"
      className="eq-modal eq-mobile-sav-sheet"
      bodyClassName="eq-modal-body"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="mobile-sav-form"
            disabled={submitting || !selectedEquipment}
          >
            {submitting ? 'Envoi…' : '🔧 Envoyer la demande'}
          </Button>
        </>
      }
    >
      <form id="mobile-sav-form" onSubmit={handleSubmit}>
        <div className="eq-form-field eq-form-full eq-sav-equip-field">
          <label>Équipement *</label>
          {selectedEquipment ? (
            <div className="eq-sav-selected-card">
              <span>
                {selectedEquipment.category_icon || selectedEquipment.categoryIcon || '📦'}
              </span>
              <div className="eq-sav-selected-info">
                <div className="eq-sav-selected-name">{selectedEquipment.name}</div>
                <div className="eq-sav-selected-meta">
                  {selectedEquipment.uid}
                  {selectedEquipment.reference ? ` — ${selectedEquipment.reference}` : ''}
                </div>
                {selectedEquipment.serialNumber && (
                  <div className="eq-sav-selected-serial">S/N {selectedEquipment.serialNumber}</div>
                )}
              </div>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSelectedEquipment(null)}
                className="eq-sav-clear-btn"
              >
                <X size={16} />
              </Button>
            </div>
          ) : (
            <div className="eq-sav-search-wrap">
              <div className="eq-sav-search-inner">
                <Search size={16} className="eq-sav-search-icon" />
                <Input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => search.length >= 2 && setShowResults(true)}
                  placeholder="Rechercher un équipement (nom, UID, réf…)"
                  className="eq-sav-search-input"
                  autoFocus
                />
              </div>
              {showResults && filtered.length > 0 && (
                <div
                  className="eq-sav-dropdown"
                  onTouchMove={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollHeight > el.clientHeight) e.stopPropagation();
                  }}
                >
                  {filtered.map((eq) => (
                    <div
                      key={eq.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(eq)}
                      className="eq-sav-dropdown-item"
                    >
                      <span className="eq-sav-dropdown-icon">
                        {eq.category_icon || eq.categoryIcon || '📦'}
                      </span>
                      <div className="eq-sav-dropdown-info">
                        <div className="eq-sav-dropdown-name">{eq.name}</div>
                        <div className="eq-sav-dropdown-ref">
                          {eq.uid}
                          {eq.reference ? ` — ${eq.reference}` : ''}
                        </div>
                        {eq.serialNumber ? (
                          <div className="eq-sav-dropdown-serial">S/N {eq.serialNumber}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showResults && search.length >= 2 && filtered.length === 0 && (
                <div className="eq-sav-dropdown-empty">Aucun résultat</div>
              )}
            </div>
          )}
        </div>

        <div className="eq-form-grid">
          <div className="eq-form-field eq-form-full">
            <label>Titre *</label>
            <Input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Câble arraché, ne charge plus…"
            />
          </div>
          <div className="eq-form-field">
            <label>Type</label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(SAV_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="eq-form-field">
            <label>Priorité</label>
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {Object.entries(SAV_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="eq-form-field eq-form-full">
            <label>Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="Détails du problème, quand c'est arrivé…"
            />
          </div>
        </div>
      </form>
    </ModalLayout>
  );
};

// ═══ VOLET LATÉRAL SAV (clic simple) ═══
const SavSlidePanel = ({
  ticket,
  equipment,
  _persons,
  onClose,
  onEdit,
  onDelete,
  onOpenDialog,
  onOpenEquipmentDialog,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (ticket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [ticket]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose]);

  if (!isVisible && !ticket) return null;

  const t = ticket || {};
  const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
  const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
  const eq = equipment.find((e) => e.id === t.equipmentId);

  return (
    <div
      className={`eq-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`}
      ref={panelRef}
    >
      <div className="eq-slide-header">
        <div className="eq-slide-title-row">
          <span className="eq-slide-name">🔧 {t.title}</span>
          <span className="eq-slide-status" style={{ background: tst.color }}>
            {tst.label}
          </span>
        </div>
        <Tooltip content="Fermer">
          <Button variant="ghost" className="eq-slide-close" onClick={handleClose}>
            <X size={18} />
          </Button>
        </Tooltip>
      </div>
      <div className="eq-slide-body">
        <div className="eq-detail-fields">
          <div className="eq-detail-field">
            <span>🎯</span>
            <span>Priorité</span>
            <strong style={{ color: pri.color }}>{pri.label}</strong>
          </div>
          <div className="eq-detail-field">
            <span>🔧</span>
            <span>Type</span>
            <strong>{SAV_TYPES[t.type] || t.type}</strong>
          </div>
          {eq && (
            <div className="eq-detail-field">
              <Package size={14} />
              <span>Matériel</span>
              <strong
                className="eq-clickable-link"
                onClick={() => onOpenEquipmentDialog && onOpenEquipmentDialog(eq)}
              >
                {eq.categoryIcon || '📦'} {cleanName(eq.name)}
              </strong>
            </div>
          )}
          <div className="eq-detail-field">
            <Calendar size={14} />
            <span>Créé le</span>
            <strong>{safeDate(t.createdAt)}</strong>
          </div>
          {t.resolvedAt && (
            <div className="eq-detail-field">
              <CheckCircle size={14} />
              <span>Résolu le</span>
              <strong>{safeDate(t.resolvedAt)}</strong>
            </div>
          )}
          {t.cost != null && t.cost > 0 && (
            <div className="eq-detail-field">
              <DollarSign size={14} />
              <span>Coût</span>
              <strong>{parseFloat(t.cost).toFixed(2)} €</strong>
            </div>
          )}
        </div>
        {t.description && (
          <div className="eq-detail-notes">
            <h4>Description</h4>
            <p>{t.description}</p>
          </div>
        )}
        {t.resolution && (
          <div className="eq-detail-notes">
            <h4>✅ Résolution</h4>
            <p>{t.resolution}</p>
          </div>
        )}
      </div>
      <div className="eq-slide-footer">
        <Button variant="secondary" onClick={() => onEdit(t)} className="eq-slide-btn-flex">
          <Edit2 size={14} /> Modifier
        </Button>
        <Button
          variant="ghost"
          className="eq-slide-open-btn eq-slide-btn-flex"
          onClick={() => onOpenDialog(t)}
        >
          <ExternalLink size={14} /> Fiche complète
        </Button>
        {onDelete && (
          <Tooltip content="Supprimer">
            <Button
              variant="danger"
              size="sm"
              iconOnly
              onClick={() => onDelete(t.id)}
              className="eq-slide-btn-compact"
            >
              <Trash2 size={14} />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

// ═══ DIALOG DÉTAIL SAV (double-clic) ═══
const SavDetailDialog = ({
  ticket,
  equipment,
  persons,
  isAdmin,
  onClose,
  onEdit,
  onDelete,
  _onOpenEquipmentDialog,
}) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    if (ticket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClosing(false);
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [ticket, handleClose]);

  if (!ticket) return null;

  const t = ticket;
  const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
  const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
  const eq = equipment.find((e) => e.id === t.equipmentId);
  const tech = t.assignedTo ? persons.find((p) => p.id === t.assignedTo) : null;
  const displayRef = eq?.reference || t.importCode || null;
  const displaySerial = eq?.serialNumber || eq?.serial_number || t.importSerial || null;

  return (
    <div
      className={`eq-dialog-overlay${isClosing ? ' closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="eq-dialog eq-dialog-sav">
        <div className="eq-dialog-header">
          <div className="eq-dialog-title-row">
            <span className="eq-dialog-cat" style={{ background: tst.color }}>
              🔧 {tst.label}
            </span>
            {(eq || t.importName || t.importCode) && (
              <span className="eq-dialog-equip-ref">
                {eq ? `${eq.categoryIcon || '📦'} ${cleanName(eq.name)}` : t.importName || ''}{' '}
                {displayRef ? `(${displayRef})` : ''}
              </span>
            )}
          </div>
          <Tooltip content="Fermer">
            <Button variant="ghost" className="eq-dialog-close" onClick={handleClose}>
              <X size={20} />
            </Button>
          </Tooltip>
        </div>
        <div className="eq-dialog-body">
          <div className="eq-detail-body">
            <div className="eq-detail-fields">
              <div className="eq-detail-field">
                <span>🔴</span>
                <span>Panne</span>
                <strong>{t.title}</strong>
              </div>
              <div className="eq-detail-field">
                <span>🎯</span>
                <span>Priorité</span>
                <strong style={{ color: pri.color }}>{pri.label}</strong>
              </div>
              <div className="eq-detail-field">
                <span>🔧</span>
                <span>Type</span>
                <strong>{SAV_TYPES[t.type] || t.type}</strong>
              </div>
              {displayRef && (
                <div className="eq-detail-field">
                  <span>🏷️</span>
                  <span>Référence</span>
                  <strong>{displayRef}</strong>
                </div>
              )}
              {displaySerial && (
                <div className="eq-detail-field">
                  <span>🔢</span>
                  <span>N° Série</span>
                  <strong>{displaySerial}</strong>
                </div>
              )}
              {tech && (
                <div className="eq-detail-field">
                  <User size={14} />
                  <span>Technicien</span>
                  <strong>
                    {tech.firstName} {tech.lastName}
                  </strong>
                </div>
              )}
              <div className="eq-detail-field">
                <Calendar size={14} />
                <span>Créé le</span>
                <strong>{safeDate(t.createdAt)}</strong>
              </div>
              {t.resolvedAt && (
                <div className="eq-detail-field">
                  <CheckCircle size={14} />
                  <span>Résolu le</span>
                  <strong>{safeDate(t.resolvedAt)}</strong>
                </div>
              )}
              {t.cost != null && t.cost > 0 && (
                <div className="eq-detail-field">
                  <DollarSign size={14} />
                  <span>Coût</span>
                  <strong>{parseFloat(t.cost).toFixed(2)} €</strong>
                </div>
              )}
            </div>
            {t.description && (
              <div className="eq-detail-notes">
                <h4>Description</h4>
                <p>{t.description}</p>
              </div>
            )}
            {t.resolution && (
              <div className="eq-detail-notes">
                <h4>✅ Résolution</h4>
                <p>{t.resolution}</p>
              </div>
            )}

            <div className="eq-dialog-actions">
              <Button variant="secondary" onClick={() => onEdit(t)}>
                <Edit2 size={14} /> Modifier
              </Button>
              {isAdmin && (
                <Button variant="danger" onClick={() => onDelete(t.id)}>
                  <Trash2 size={14} /> Supprimer
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { SavTicketsList, SavTicketFormModal, MobileSavRequestForm, SavSlidePanel, SavDetailDialog };
