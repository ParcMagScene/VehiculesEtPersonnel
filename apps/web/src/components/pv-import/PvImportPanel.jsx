// ═══════════════════════════════════════════════════════════════
// PvImportPanel.jsx — Modal d'import des PV PDF (admin only)
// ═══════════════════════════════════════════════════════════════
// Workflow :
//   1. L'admin glisse 1..n PDF (rapports DEKRA / Apave / Socotec…).
//   2. Chaque PDF est uploadé → parser extrait référence, date, statut,
//      organisme, périodicité. Création d'un pv_imports en statut
//      `pending_resolution`.
//   3. Pour chaque import en attente, l'admin choisit une action :
//        - `lot`              : créer une ligne dans equipment_lots_controls
//                                (cas PV multi-équipements DEKRA).
//        - `create_control`   : créer un equipment_controls + historique
//                                pour une entité unique.
//        - `ignore`           : ne rien faire, marquer comme ignoré.
//   4. La résolution applique le mapping côté backend (transaction).
//
// Le composant est rendu uniquement quand `open` est vrai. Les listes
// (équipements, véhicules, types de contrôle) sont chargées paresseusement
// à l'ouverture du panneau.

import { CheckCircle2, FileText, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  EmptyState,
  InlineAlert,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Spinner,
  Textarea,
} from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import './PvImportPanel.css';

const STATUS_LABELS = {
  pending_resolution: 'À résoudre',
  applied: 'Appliqué',
  ignored: 'Ignoré',
  error: 'Erreur',
};

const STATUS_VARIANTS = {
  pending_resolution: 'warning',
  applied: 'success',
  ignored: 'neutral',
  error: 'danger',
};

const ACTION_OPTIONS = [
  { value: 'lot', label: "Lot d'équipements (multi-S/N)" },
  { value: 'create_control', label: 'Créer un contrôle (entité unique)' },
  { value: 'ignore', label: 'Ignorer ce PV' },
];

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 Mo

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR');
}

function formatSize(bytes) {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

export default function PvImportPanel({ open, onClose }) {
  const toast = useToast();
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending_resolution');
  const [equipments, setEquipments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [controlTypes, setControlTypes] = useState([]);
  const [mappings, setMappings] = useState({}); // id -> { action, ...fields }
  const [applyingId, setApplyingId] = useState(null);

  // Chargement initial : liste imports + référentiels (équipements, véhicules,
  // types de contrôle). On ne le fait qu'à l'ouverture du panneau pour ne
  // pas peser au boot.
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const [imp, eq, vh, ct] = await Promise.all([
        api.listPvImports(params),
        api.getEquipment().catch(() => ({ data: [] })),
        api.getVehicles().catch(() => ({ data: [] })),
        api.getControlTypes(true).catch(() => ({ data: [] })),
      ]);
      setImports(imp?.data || []);
      setEquipments(eq?.data || eq?.equipment || []);
      setVehicles(vh?.data || vh?.vehicles || []);
      setControlTypes(ct?.data || []);
    } catch (err) {
      toast.error('Erreur de chargement : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  // Mémoïsation des options dropdown.
  const equipmentOptions = useMemo(
    () =>
      equipments
        .map((e) => ({
          id: e.id,
          label: `${e.reference || e.serial_number || '?'} — ${e.name || e.model || ''}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [equipments],
  );

  const vehicleOptions = useMemo(
    () =>
      vehicles
        .map((v) => ({
          id: v.id,
          label: `${v.license_plate || v.plate || '?'} — ${v.brand || ''} ${v.model || ''}`.trim(),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [vehicles],
  );

  // Mise à jour d'un mapping (partielle).
  const updateMapping = (id, patch) => {
    setMappings((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  };

  // Mapping initial à la sélection d'action.
  const ensureMapping = (imp) => {
    if (mappings[imp.id]) return mappings[imp.id];
    const init = {
      action: 'lot',
      quantite_controlee: 1,
      quantite_non_controlee: 0,
      entity_type: 'equipment',
      entity_id: '',
      control_type_id: '',
      equipment_id: '',
      notes: '',
    };
    setMappings((m) => ({ ...m, [imp.id]: init }));
    return init;
  };

  // ── Upload ──────────────────────────────────────────────────────
  const uploadFiles = async (files) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const valid = [];
      for (const f of files) {
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
          toast.error(`${f.name} ignoré (PDF uniquement)`);
          continue;
        }
        if (f.size > MAX_FILE_SIZE) {
          toast.error(`${f.name} trop volumineux (30 Mo max)`);
          continue;
        }
        valid.push(f);
      }
      if (!valid.length) return;
      const formData = new FormData();
      valid.forEach((f) => formData.append('files', f));
      const res = await api.uploadPvImports(formData);
      if (!res?.success) throw new Error(res?.error || 'Upload échoué');
      const count = res.data?.length || valid.length;
      toast.success(`${count} PV importé(s)`);
      await loadAll();
    } catch (err) {
      toast.error('Erreur upload : ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  };
  const handleFileInput = (e) => {
    uploadFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  // ── Apply ────────────────────────────────────────────────────────
  const handleApply = async (imp) => {
    const m = mappings[imp.id] || ensureMapping(imp);
    // Validation minimale côté UI.
    if (m.action === 'create_control') {
      if (!m.entity_type || !m.entity_id || !m.control_type_id) {
        toast.error('Entité et type de contrôle requis');
        return;
      }
    }
    if (m.action === 'lot' && Number(m.quantite_controlee || 0) < 1) {
      toast.error('Quantité contrôlée doit être ≥ 1');
      return;
    }
    setApplyingId(imp.id);
    try {
      const res = await api.applyPvImport(imp.id, m);
      if (!res?.success) throw new Error(res?.error || 'Résolution échouée');
      toast.success(m.action === 'ignore' ? 'PV ignoré' : 'PV appliqué');
      await loadAll();
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setApplyingId(null);
    }
  };

  const handleDelete = async (imp) => {
    if (!window.confirm(`Supprimer l'import « ${imp.original_name} » ?`)) return;
    try {
      const res = await api.deletePvImport(imp.id, imp.status === 'applied');
      if (!res?.success) throw new Error(res?.error || 'Suppression échouée');
      toast.success('Import supprimé');
      await loadAll();
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  if (!open) return null;

  return (
    <Modal open onClose={onClose} size="xl" className="pv-import-modal">
      <ModalHeader icon={<FileText size={20} />} onClose={onClose}>
        Import PV PDF (contrôles périodiques)
      </ModalHeader>
      <ModalBody className="pv-import-body">
        {/* Drop zone */}
        <div
          className={`pv-drop-zone ${dragOver ? 'is-drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('pv-import-file-input')?.click()}
        >
          <Upload size={32} />
          <p>
            Glissez vos PV PDF ici, ou <strong>cliquez pour sélectionner</strong>
          </p>
          <p className="pv-drop-hint">PDF uniquement — multi-fichiers — 30 Mo max chacun</p>
          <Input
            id="pv-import-file-input"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="pv-hidden-input"
            onChange={handleFileInput}
          />
          {uploading && (
            <div className="pv-uploading">
              <Spinner size="sm" /> Upload en cours…
            </div>
          )}
        </div>

        {/* Filtre statut */}
        <div className="pv-filter-row">
          <Select size="sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="pending_resolution">À résoudre</option>
            <option value="applied">Appliqués</option>
            <option value="ignored">Ignorés</option>
            <option value="error">En erreur</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={loadAll} disabled={loading}>
            Actualiser
          </Button>
        </div>

        {loading && <Spinner />}

        {!loading && imports.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 size={48} />}
            title="Aucun PV"
            description="Aucun import ne correspond au filtre actuel."
          />
        )}

        {!loading && imports.length > 0 && (
          <div className="pv-list">
            {imports.map((imp) => {
              const parsed =
                typeof imp.parsed_data === 'string'
                  ? safeJson(imp.parsed_data)
                  : imp.parsed_data || {};
              const m = mappings[imp.id] || ensureMapping(imp);
              const isPending = imp.status === 'pending_resolution';
              const pdfUrl = `/${imp.file_path}`;
              return (
                <div key={imp.id} className="pv-card">
                  <div className="pv-card-header">
                    <div className="pv-card-title">
                      <FileText size={16} />
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                        {imp.original_name}
                      </a>
                      <span className="pv-card-size">{formatSize(imp.file_size)}</span>
                    </div>
                    <div className="pv-card-status">
                      <Badge variant={STATUS_VARIANTS[imp.status] || 'neutral'}>
                        {STATUS_LABELS[imp.status] || imp.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(imp)}
                        title="Supprimer"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>

                  <div className="pv-parsed-grid">
                    <div>
                      <span className="pv-label">Référence</span>
                      <span>{parsed.reference || '—'}</span>
                    </div>
                    <div>
                      <span className="pv-label">Date contrôle</span>
                      <span>{formatDate(parsed.dateControle)}</span>
                    </div>
                    <div>
                      <span className="pv-label">Prochain contrôle</span>
                      <span>{formatDate(parsed.prochainControle)}</span>
                    </div>
                    <div>
                      <span className="pv-label">Organisme</span>
                      <span>{parsed.organisme || '—'}</span>
                    </div>
                    <div>
                      <span className="pv-label">Statut</span>
                      <span>{parsed.statut || '—'}</span>
                    </div>
                    <div>
                      <span className="pv-label">Périodicité</span>
                      <span>{parsed.periodicite || '—'}</span>
                    </div>
                    <div>
                      <span className="pv-label">S/N</span>
                      <span>{parsed.serialNumber || '— (multi-équipement)'}</span>
                    </div>
                    <div>
                      <span className="pv-label">Confiance</span>
                      <span>{parsed.confidence || '—'}</span>
                    </div>
                  </div>

                  {parsed.warnings && parsed.warnings.length > 0 && (
                    <InlineAlert variant="info">{parsed.warnings.join(' · ')}</InlineAlert>
                  )}

                  {imp.error_message && (
                    <InlineAlert variant="danger">{imp.error_message}</InlineAlert>
                  )}

                  {/* Bloc résolution — uniquement si en attente */}
                  {isPending && (
                    <div className="pv-resolution">
                      <div className="pv-resolution-row">
                        <label className="pv-field">
                          <span className="pv-label">Action</span>
                          <Select
                            size="sm"
                            value={m.action}
                            onChange={(e) => updateMapping(imp.id, { action: e.target.value })}
                          >
                            {ACTION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </label>
                      </div>

                      {m.action === 'lot' && (
                        <div className="pv-resolution-row">
                          <label className="pv-field">
                            <span className="pv-label">Équipement modèle (optionnel)</span>
                            <Select
                              size="sm"
                              value={m.equipment_id || ''}
                              onChange={(e) =>
                                updateMapping(imp.id, { equipment_id: e.target.value })
                              }
                            >
                              <option value="">— Aucun (lot libre) —</option>
                              {equipmentOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="pv-field pv-field-sm">
                            <span className="pv-label">Qté contrôlée</span>
                            <Input
                              type="number"
                              min="0"
                              value={m.quantite_controlee}
                              onChange={(e) =>
                                updateMapping(imp.id, { quantite_controlee: e.target.value })
                              }
                            />
                          </label>
                          <label className="pv-field pv-field-sm">
                            <span className="pv-label">Qté non contrôlée</span>
                            <Input
                              type="number"
                              min="0"
                              value={m.quantite_non_controlee}
                              onChange={(e) =>
                                updateMapping(imp.id, { quantite_non_controlee: e.target.value })
                              }
                            />
                          </label>
                        </div>
                      )}

                      {m.action === 'create_control' && (
                        <div className="pv-resolution-row">
                          <label className="pv-field">
                            <span className="pv-label">Type d'entité</span>
                            <Select
                              size="sm"
                              value={m.entity_type}
                              onChange={(e) =>
                                updateMapping(imp.id, {
                                  entity_type: e.target.value,
                                  entity_id: '',
                                })
                              }
                            >
                              <option value="equipment">Équipement</option>
                              <option value="vehicle">Véhicule</option>
                            </Select>
                          </label>
                          <label className="pv-field">
                            <span className="pv-label">Entité</span>
                            <Select
                              size="sm"
                              value={m.entity_id}
                              onChange={(e) => updateMapping(imp.id, { entity_id: e.target.value })}
                            >
                              <option value="">— Sélectionner —</option>
                              {(m.entity_type === 'vehicle'
                                ? vehicleOptions
                                : equipmentOptions
                              ).map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="pv-field">
                            <span className="pv-label">Type de contrôle</span>
                            <Select
                              size="sm"
                              value={m.control_type_id}
                              onChange={(e) =>
                                updateMapping(imp.id, { control_type_id: e.target.value })
                              }
                            >
                              <option value="">— Sélectionner —</option>
                              {controlTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.code} · {t.name}
                                </option>
                              ))}
                            </Select>
                          </label>
                        </div>
                      )}

                      {m.action !== 'ignore' && (
                        <div className="pv-resolution-row">
                          <label className="pv-field pv-field-full">
                            <span className="pv-label">Notes (optionnel)</span>
                            <Textarea
                              rows={2}
                              value={m.notes || ''}
                              onChange={(e) => updateMapping(imp.id, { notes: e.target.value })}
                              placeholder="Observations complémentaires…"
                            />
                          </label>
                        </div>
                      )}

                      <div className="pv-resolution-actions">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApply(imp)}
                          disabled={applyingId === imp.id}
                        >
                          {applyingId === imp.id ? 'Application…' : 'Appliquer'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Récap si déjà appliqué */}
                  {imp.status === 'applied' && (
                    <div className="pv-applied-info">
                      Appliqué le {formatDate(imp.applied_at)} par {imp.applied_by || '—'} ·{' '}
                      {imp.matched_count} entité(s) liée(s)
                      {imp.unmatched_count > 0 && ` · ${imp.unmatched_count} non rattachée(s)`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
