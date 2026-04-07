/**
 * BLMultiImportModal — Import unifié BL / BP (un ou plusieurs)
 * Drop one or many PDFs, parse them, review with full detail, then batch import.
 * Creates new affaires or updates existing ones.
 */
import { useState, useCallback, useRef } from 'react';
import {
  FileText, X, Upload, File, CheckCircle, AlertTriangle, Briefcase,
  Trash2, Loader, Tag, ChevronDown, ChevronRight, PackagePlus,
  Eye, EyeOff, Layers, Package
} from 'lucide-react';
import api from '../../utils/api';
import { extractTextFromPDF, smartParse, getDocTypeLabel, DOC_TYPES } from '../../utils/pdfParser';
import { AFFAIRE_TYPES } from '../../utils/affaireConstants';
import { useToast } from '../../hooks/useToast';
import { Button, Input, ProgressBar } from '@/design-system';
import { STATUS } from '../../constants';

import './BLMultiImportModal.css';

const AFFAIRE_TYPE_OPTIONS = AFFAIRE_TYPES;

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const STATUS_ICONS = {
  pending: <Loader size={14} className="spin-slow" />,
  parsed: <CheckCircle size={14} style={{ color: '#10b981' }} />,
  error: <AlertTriangle size={14} style={{ color: '#ef4444' }} />,
};

const FIELD_DEFS = [
  { key: 'numero', label: 'N° Affaire' },
  { key: 'client', label: 'Client' },
  { key: 'date', label: 'Date' },
  { key: 'nomAffaire', label: 'Nom / Objet' },
  { key: 'interlocuteur', label: 'Interlocuteur' },
  { key: 'adresse', label: 'Adresse' },
  { key: 'devis', label: 'Devis' },
  { key: 'tel', label: 'Téléphone' },
];

const CONF_COLORS = { high: '#10b981', medium: '#f59e0b', low: '#ef4444' };
const CONF_LABELS = { high: 'Sûr', medium: 'Incertain', low: 'Douteux' };

const SECTION_COLORS = {
  SONORISATION: { bg: 'rgba(99, 102, 241, 0.10)', border: 'rgba(99, 102, 241, 0.3)', text: '#818cf8', icon: '🔊' },
  LUMIERE: { bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', icon: '💡' },
  LUMIÈRE: { bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', icon: '💡' },
  'ÉCLAIRAGE': { bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', icon: '💡' },
  'REGIE/PLATEAU': { bg: 'rgba(16, 185, 129, 0.10)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', icon: '🎬' },
  RÉGIE: { bg: 'rgba(16, 185, 129, 0.10)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', icon: '🎬' },
  STRUCTURE: { bg: 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', icon: '🏗️' },
  VIDEO: { bg: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa', icon: '📹' },
  VIDÉO: { bg: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa', icon: '📹' },
  AUDIOVISUEL: { bg: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa', icon: '🎥' },
  ELECTRICITE: { bg: 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', icon: '⚡' },
  'ÉLECTRICITÉ': { bg: 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', icon: '⚡' },
  CÂBLAGE: { bg: 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', icon: '⚡' },
  BACKLINE: { bg: 'rgba(16, 185, 129, 0.10)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', icon: '🎸' },
  'RIDEAU-MACHINERIE': { bg: 'rgba(236, 72, 153, 0.10)', border: 'rgba(236, 72, 153, 0.3)', text: '#f472b6', icon: '🎭' },
  RIDEAU: { bg: 'rgba(236, 72, 153, 0.10)', border: 'rgba(236, 72, 153, 0.3)', text: '#f472b6', icon: '🎭' },
  INFORMATIQUE: { bg: 'rgba(6, 182, 212, 0.10)', border: 'rgba(6, 182, 212, 0.3)', text: '#22d3ee', icon: '💻' },
  ACCROCHE: { bg: 'rgba(20, 184, 166, 0.10)', border: 'rgba(20, 184, 166, 0.3)', text: '#2dd4bf', icon: '🔗' },
  MOTORISATION: { bg: 'rgba(249, 115, 22, 0.10)', border: 'rgba(249, 115, 22, 0.3)', text: '#fb923c', icon: '⚙️' },
  MOBILIER: { bg: 'rgba(107, 114, 128, 0.10)', border: 'rgba(107, 114, 128, 0.3)', text: '#9ca3af', icon: '🪑' },
  OUTILLAGE: { bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', icon: '🔧' },
  VENTE: { bg: 'rgba(251, 191, 36, 0.10)', border: 'rgba(251, 191, 36, 0.3)', text: '#fbbf24', icon: '🛒' },
  DIFFUSION: { bg: 'rgba(99, 102, 241, 0.10)', border: 'rgba(99, 102, 241, 0.3)', text: '#818cf8', icon: '🔊' },
  DIVERS: { bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.3)', text: 'var(--theme-text-muted)', icon: '📦' },
};
const getSecColor = (name) => SECTION_COLORS[name] || SECTION_COLORS.DIVERS;

export default function BLMultiImportModal({ onClose, onImported, defaultAffaireType }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  // items: { file, status, parsedData, rawText, docType, affaireId, affaireType, editedFields, error, expanded, showRaw, showArticles, expandedSections }
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  // Global type applied to all items (when multi-import)
  const [globalType, setGlobalType] = useState(defaultAffaireType || '');

  // Drag & Drop handlers
  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (files.length === 0) return;
    addFiles(files);
  }, []);

  const addFiles = async (newFiles) => {
    const existingNames = new Set(items.map(it => it.file.name));
    const filesToAdd = newFiles.filter(f => !existingNames.has(f.name));
    if (filesToAdd.length === 0) {
      toast.warning('Fichiers déjà ajoutés');
      return;
    }

    const newItems = filesToAdd.map(f => ({
      file: f,
      status: STATUS.PENDING,
      parsedData: null,
      rawText: '',
      docType: null,
      affaireId: '',
      affaireType: '',
      editedFields: {},
      error: null,
      expanded: false,
      showRaw: false,
      showArticles: false,
      expandedSections: {},
    }));

    const allItems = [...items, ...newItems];
    setItems(allItems);

    setParsing(true);
    setProgress({ current: 0, total: filesToAdd.length });

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      try {
        const text = await extractTextFromPDF(item.file);
        const parsed = smartParse(text);
        item.status = 'parsed';
        item.parsedData = parsed;
        item.rawText = text;
        item.docType = parsed.docType;
        item.affaireId = parsed.numero || '';
        item.affaireType = parsed.type || '';
        // Auto-expand if single file
        if (allItems.length === 1) item.expanded = true;
      } catch (err) {
        item.status = 'error';
        item.error = err.message;
      }
      setProgress({ current: i + 1, total: filesToAdd.length });
      setItems([...allItems]);
    }

    setParsing(false);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, updates) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const updateField = (idx, key, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const ef = { ...item.editedFields, [key]: value };
      const updates = { editedFields: ef };
      if (key === 'numero') updates.affaireId = value;
      return { ...item, ...updates };
    }));
  };

  const toggleExpand = (idx) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, expanded: !item.expanded } : item));
  };

  const toggleSection = (idx, secIdx) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, expandedSections: { ...item.expandedSections, [secIdx]: !item.expandedSections[secIdx] } };
    }));
  };

  const getVal = (item, key) => {
    if (item.editedFields[key] !== undefined) return item.editedFields[key];
    return item.parsedData?.[key] || '';
  };

  // getMergedData for an item
  const getMergedData = (item) => {
    if (!item.parsedData) return null;
    return { ...item.parsedData, ...item.editedFields };
  };

  // Batch import
  const handleBatchImport = async () => {
    const validItems = items.filter(it => it.status === 'parsed');
    if (validItems.length === 0) {
      toast.warning('Aucun fichier à importer');
      return;
    }

    setImporting(true);
    setImportResults(null);

    try {
      const formData = new FormData();

      const itemsMeta = [];
      validItems.forEach((item, i) => {
        formData.append('files', item.file);
        const merged = getMergedData(item);
        // Type effectif : celui du fichier, sinon le type global
        const effectiveType = item.affaireType || globalType || null;
        itemsMeta.push({
          index: i,
          affaire_id: item.affaireId || null,
          affaire_type: effectiveType,
          parsed_data: merged,
          raw_text: item.rawText,
          status: STATUS.VALIDATED,
          force_type: !!effectiveType,
        });
      });

      formData.append('items', JSON.stringify(itemsMeta));

      const result = await api.uploadBLImportBatch(formData);
      setImportResults(result);

      const s = result.summary;
      let msg = `${s.imported} BL/BP importé(s)`;
      if (s.created > 0) msg += `, ${s.created} affaire(s) créée(s)`;
      if (s.updated > 0) msg += `, ${s.updated} affaire(s) mise(s) à jour`;
      if (s.failed > 0) msg += ` — ${s.failed} erreur(s)`;
      toast.success(msg);

      if (onImported) onImported();
    } catch (err) {
      toast.error('Erreur import : ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const parsedCount = items.filter(it => it.status === 'parsed').length;
  const errorCount = items.filter(it => it.status === 'error').length;
  const uniqueAffaires = new Set(items.filter(it => it.affaireId).map(it => it.affaireId)).size;
  const totalArticles = items.reduce((sum, it) => sum + (it.parsedData?.items?.length || 0), 0);

  return (
    <div className="bl-import-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bl-multi-import-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <h3><PackagePlus size={20} /> Import BL / BP</h3>
          <Button variant="ghost" className="modal-close" onClick={onClose}><X size={18} /></Button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Drop zone */}
          <div
            className={`drop-zone multi ${dragOver ? 'drag-over' : ''} ${items.length > 0 ? 'compact' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={items.length > 0 ? 20 : 36} />
            <p className="drop-text">
              {items.length > 0
                ? <span>Ajouter d'autres PDFs</span>
                : <span>Glissez un ou plusieurs PDF ici ou <strong>cliquez pour sélectionner</strong></span>
              }
            </p>
            {items.length === 0 && <p className="drop-hint">BL Vente, Bons de Préparation, BL Location… — PDF uniquement — 20 Mo max</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
                if (files.length > 0) addFiles(files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Progress bar */}
          {parsing && (
            <div className="batch-progress">
              <ProgressBar value={progress.current} max={progress.total || 1} label={`Analyse ${progress.current}/${progress.total}...`} />
            </div>
          )}

          {/* ─── Global type selector (multi-import) ─── */}
          {items.length > 1 && !importResults && (
            <div className="batch-global-type">
              <div className="batch-global-type-label">
                <Tag size={14} />
                <span>Type d'affaire pour l'import</span>
                <span className="batch-global-type-hint">(appliqué à tous les fichiers sans type individuel)</span>
              </div>
              <div className="type-pills global">
                {AFFAIRE_TYPE_OPTIONS.map(opt => (
                  <Button variant="ghost"                     key={opt.value}
                    type="button"
                    className={globalType === opt.value ? 'active' : ''}
                    style={globalType === opt.value ? { borderColor: opt.color, background: `${opt.color}18`, color: opt.color } : {}}
                    onClick={() => {
                      setGlobalType(prev => prev === opt.value ? '' : opt.value);
                    }}
                  >
                    {opt.icon} {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {items.length > 0 && !importResults && (
            <div className="batch-summary">
              <span><FileText size={14} /> {items.length} fichier{items.length > 1 ? 's' : ''}</span>
              {parsedCount > 0 && <span className="badge success"><CheckCircle size={12} /> {parsedCount} analysé{parsedCount > 1 ? 's' : ''}</span>}
              {errorCount > 0 && <span className="badge error"><AlertTriangle size={12} /> {errorCount} erreur{errorCount > 1 ? 's' : ''}</span>}
              {uniqueAffaires > 0 && <span className="badge info"><Briefcase size={12} /> {uniqueAffaires} affaire{uniqueAffaires > 1 ? 's' : ''}</span>}
              {totalArticles > 0 && <span className="badge info"><Package size={12} /> {totalArticles} article{totalArticles > 1 ? 's' : ''}</span>}
            </div>
          )}

          {/* Import results summary */}
          {importResults && (
            <div className="batch-results-summary">
              <h4><CheckCircle size={16} /> Import terminé</h4>
              <div className="results-grid">
                <div className="result-stat"><span className="result-num">{importResults.summary.imported}</span><span>Importé(s)</span></div>
                <div className="result-stat created"><span className="result-num">{importResults.summary.created}</span><span>Affaire(s) créée(s)</span></div>
                <div className="result-stat updated"><span className="result-num">{importResults.summary.updated}</span><span>Affaire(s) maj</span></div>
                {importResults.summary.failed > 0 && (
                  <div className="result-stat failed"><span className="result-num">{importResults.summary.failed}</span><span>Erreur(s)</span></div>
                )}
              </div>
            </div>
          )}

          {/* File list */}
          {items.length > 0 && (
            <div className="batch-file-list">
              {items.map((item, idx) => (
                <div key={idx} className={`batch-file-item ${item.status}`}>
                  <div className="batch-file-header" onClick={() => toggleExpand(idx)}>
                    <span className="batch-file-expand">
                      {item.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    {STATUS_ICONS[item.status]}
                    <div className="batch-file-icon"><File size={16} /></div>
                    <div className="batch-file-info">
                      <span className="batch-file-name">{item.file.name}</span>
                      <span className="batch-file-size">{formatFileSize(item.file.size)}</span>
                    </div>
                    {item.docType && (
                      <span className={`doc-type-badge ${[DOC_TYPES.BON_LIVRAISON, DOC_TYPES.BL_VENTE, DOC_TYPES.BON_PREPARATION].includes(item.docType) ? 'success' : 'warning'}`}>
                        {getDocTypeLabel(item.docType)}
                      </span>
                    )}
                    {item.affaireId && (
                      <span className="affaire-badge">
                        <Briefcase size={11} /> {item.affaireId}
                      </span>
                    )}
                    {(item.affaireType || globalType) && (
                      <span className="type-badge-mini" style={{ color: AFFAIRE_TYPE_OPTIONS.find(o => o.value === (item.affaireType || globalType))?.color }}>
                        {AFFAIRE_TYPE_OPTIONS.find(o => o.value === (item.affaireType || globalType))?.icon}
                      </span>
                    )}
                    {item.parsedData?.confidence != null && (
                      <span className={`confidence-badge ${item.parsedData.confidence >= 70 ? 'high' : item.parsedData.confidence >= 40 ? 'medium' : 'low'}`}>
                        {item.parsedData.confidence}%
                      </span>
                    )}
                    <Button variant="ghost"                       className="batch-file-remove"
                      onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                      title="Retirer"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {/* ─── Expanded details ─── */}
                  {item.expanded && item.parsedData && (
                    <div className="batch-file-details">
                      {/* Affaire ID + Type */}
                      <div className="detail-row">
                        <label><Briefcase size={13} /> Affaire</label>
                        <Input
                          type="text"
                          value={item.affaireId}
                          onChange={e => updateItem(idx, { affaireId: e.target.value, editedFields: { ...item.editedFields, numero: e.target.value } })}
                          placeholder="AF32844..."
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <div className="detail-row">
                        <label><Tag size={13} /> Type</label>
                        <div className="type-pills">
                          {AFFAIRE_TYPE_OPTIONS.map(opt => (
                            <Button variant="ghost"                               key={opt.value}
                              type="button"
                              className={item.affaireType === opt.value ? 'active' : ''}
                              style={item.affaireType === opt.value ? { borderColor: opt.color, background: `${opt.color}18`, color: opt.color } : {}}
                              onClick={(e) => { e.stopPropagation(); updateItem(idx, { affaireType: opt.value }); }}
                            >
                              {opt.icon} {opt.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* ─── Full field grid with confidence ─── */}
                      <div className="detail-fields-grid">
                        <div className="detail-fields-header">
                          <CheckCircle size={13} style={{ color: '#10b981' }} />
                          <span>Données extraites</span>
                          <span className="detail-fields-meta">
                            {item.parsedData.fieldsFound}/{item.parsedData.fieldsTotal} champs • {item.parsedData.confidence}%
                          </span>
                        </div>
                        {FIELD_DEFS.map(field => {
                          const val = getVal(item, field.key);
                          const fc = item.parsedData._fieldConfidence || {};
                          const conf = fc[field.key];
                          const isEdited = item.editedFields[field.key] !== undefined;
                          return (
                            <div key={field.key} className="detail-parsed-field">
                              <span
                                className="conf-dot"
                                title={conf ? `${CONF_LABELS[conf]} (${conf})` : 'Non détecté'}
                                style={{ color: conf ? CONF_COLORS[conf] : 'var(--theme-text-muted)' }}
                              >●</span>
                              <span className="field-label">{field.label}</span>
                              <Input
                                type="text"
                                value={val}
                                onChange={e => updateField(idx, field.key, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                placeholder={`${field.label} non détecté`}
                                className={`field-input ${isEdited ? 'edited' : ''} ${!val ? 'empty' : ''}`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* ─── Sections (for BP documents) ─── */}
                      {item.parsedData.sections && item.parsedData.sections.length > 0 && (
                        <div className="detail-sections">
                          <div className="detail-sections-title">
                            <Layers size={13} />
                            Sections ({item.parsedData.sections.length})
                            <span className="detail-sections-total">{item.parsedData.items?.length || 0} article(s)</span>
                          </div>
                          {item.parsedData.sections.map((sec, sIdx) => {
                            const sc = getSecColor(sec.name);
                            const isOpen = item.expandedSections[sIdx];
                            return (
                              <div key={sIdx} className="detail-section" style={{ '--sec-bg': sc.bg, '--sec-border': sc.border, '--sec-text': sc.text }}>
                                <div className="detail-section-header" onClick={(e) => { e.stopPropagation(); toggleSection(idx, sIdx); }}>
                                  <span>{sc.icon}</span>
                                  <span className="detail-section-name">{sec.name}</span>
                                  <span className="detail-section-count">{sec.items?.length || 0} art.</span>
                                  {sec.dateDebut && <span className="detail-section-dates">{sec.dateDebut} → {sec.dateFin}</span>}
                                  <span className={`detail-section-chevron ${isOpen ? 'open' : ''}`}>▸</span>
                                </div>
                                {isOpen && sec.items && sec.items.length > 0 && (
                                  <div className="detail-section-items">
                                    {sec.items.slice(0, 25).map((si, siIdx) => (
                                      <div key={siIdx} className="detail-section-item-row">
                                        <span className="item-ref">{si.reference || '—'}</span>
                                        <span className="item-desc">{si.description || '—'}</span>
                                        <span className="item-qty">{si.quantity || 0}</span>
                                      </div>
                                    ))}
                                    {sec.items.length > 25 && (
                                      <div className="detail-section-more">... +{sec.items.length - 25} autre(s)</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ─── Articles (flat, for non-section docs) ─── */}
                      {(!item.parsedData.sections || item.parsedData.sections.length === 0) && item.parsedData.items && item.parsedData.items.length > 0 && (
                        <div className="detail-articles">
                          <Button variant="ghost"                             type="button"
                            className="detail-articles-toggle"
                            onClick={(e) => { e.stopPropagation(); updateItem(idx, { showArticles: !item.showArticles }); }}
                          >
                            <Package size={13} />
                            Articles ({item.parsedData.items.length})
                            {item.showArticles ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </Button>
                          {item.showArticles && (
                            <div className="detail-articles-list">
                              {item.parsedData.items.slice(0, 30).map((art, aIdx) => (
                                <div key={aIdx} className="detail-article-row">
                                  <span className="item-qty">{art.quantity || art.qte || '1'}</span>
                                  <span className="item-desc">
                                    {art.description || art.designation || art.label || '—'}
                                    {art.code && <span className="item-code">({art.code})</span>}
                                  </span>
                                  {(art.reference || art.section) && <span className="item-ref-small">{art.reference || art.section}</span>}
                                  {art.fournisseur && <span className="item-supplier">{art.fournisseur}</span>}
                                </div>
                              ))}
                              {item.parsedData.items.length > 30 && (
                                <div className="detail-section-more">... +{item.parsedData.items.length - 30} autre(s)</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ─── Fournisseurs ─── */}
                      {item.parsedData.fournisseurs && item.parsedData.fournisseurs.length > 0 && (
                        <div className="detail-fournisseurs">
                          <span className="detail-fourn-label">🏭 Fournisseurs :</span>
                          {item.parsedData.fournisseurs.map((f, fi) => (
                            <span key={fi} className="detail-fourn-tag">{f}</span>
                          ))}
                        </div>
                      )}

                      {/* ─── Raw text toggle ─── */}
                      <Button variant="ghost"                         type="button"
                        className="detail-raw-toggle"
                        onClick={(e) => { e.stopPropagation(); updateItem(idx, { showRaw: !item.showRaw }); }}
                      >
                        {item.showRaw ? <EyeOff size={13} /> : <Eye size={13} />}
                        {item.showRaw ? 'Masquer texte brut' : 'Voir texte brut'}
                      </Button>
                      {item.showRaw && (
                        <div className="detail-raw-text">{item.rawText}</div>
                      )}
                    </div>
                  )}

                  {/* Error display */}
                  {item.status === 'error' && (
                    <div className="batch-file-error">
                      <AlertTriangle size={12} /> {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="footer-left">
            {parsedCount > 0 && !importResults && (
              <span className="status-badge success">
                <CheckCircle size={12} /> {parsedCount} prêt{parsedCount > 1 ? 's' : ''} à importer
              </span>
            )}
          </div>
          <div className="footer-right">
            <Button variant="ghost" onClick={onClose}>
              {importResults ? 'Fermer' : 'Annuler'}
            </Button>
            {!importResults && (
              <Button
                variant="primary"
                onClick={handleBatchImport}
                disabled={parsedCount === 0 || importing}
              >
                <PackagePlus size={15} />
                {importing ? 'Import en cours...' : `Importer ${parsedCount} BL/BP`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
