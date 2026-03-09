/**
 * BLMultiImportModal — Import multiple de BL et BP
 * Drop multiple PDFs, parse them all, review, then batch import
 * Creates new affaires or updates existing ones
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  FileText, X, Upload, File, CheckCircle, AlertTriangle, Briefcase,
  Trash2, Loader, Tag, ChevronDown, ChevronRight, PackagePlus
} from 'lucide-react';
import api from '../utils/api';
import { extractTextFromPDF, smartParse, getDocTypeLabel } from '../utils/pdfParser';
import { AFFAIRE_TYPES } from '../utils/affaireConstants';
import { useToast } from '../hooks/useToast';
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

export default function BLMultiImportModal({ onClose, onImported }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [items, setItems] = useState([]); // { file, status, parsedData, rawText, docType, affaireId, affaireType, error, expanded }
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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
    // Filter duplicates
    const existingNames = new Set(items.map(it => it.file.name));
    const filesToAdd = newFiles.filter(f => !existingNames.has(f.name));
    if (filesToAdd.length === 0) {
      toast.warning('Fichiers déjà ajoutés');
      return;
    }

    // Add items with pending status
    const newItems = filesToAdd.map(f => ({
      file: f,
      status: 'pending',
      parsedData: null,
      rawText: '',
      docType: null,
      affaireId: '',
      affaireType: '',
      error: null,
      expanded: false,
    }));

    const allItems = [...items, ...newItems];
    setItems(allItems);

    // Parse each new file
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
      } catch (err) {
        item.status = 'error';
        item.error = err.message;
      }
      setProgress({ current: i + 1, total: filesToAdd.length });
      setItems([...allItems]); // Force re-render
    }

    setParsing(false);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, updates) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const toggleExpand = (idx) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, expanded: !item.expanded } : item));
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

      // Add all files
      const itemsMeta = [];
      validItems.forEach((item, i) => {
        formData.append('files', item.file);
        itemsMeta.push({
          index: i,
          affaire_id: item.affaireId || null,
          affaire_type: item.affaireType || null,
          parsed_data: item.parsedData,
          raw_text: item.rawText,
          status: 'validated',
        });
      });

      formData.append('items', JSON.stringify(itemsMeta));

      const result = await api.uploadBLImportBatch(formData);
      setImportResults(result);

      const s = result.summary;
      let msg = `${s.imported} BL importé(s)`;
      if (s.created > 0) msg += `, ${s.created} affaire(s) créée(s)`;
      if (s.updated > 0) msg += `, ${s.updated} affaire(s) mise(s) à jour`;
      if (s.failed > 0) msg += ` — ${s.failed} erreur(s)`;
      toast.success(msg);

      if (onImported) onImported();
    } catch (err) {
      toast.error('Erreur import batch : ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const parsedCount = items.filter(it => it.status === 'parsed').length;
  const errorCount = items.filter(it => it.status === 'error').length;
  const uniqueAffaires = new Set(items.filter(it => it.affaireId).map(it => it.affaireId)).size;

  return (
    <div className="bl-import-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bl-multi-import-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3><PackagePlus size={20} /> Import Multiple BL / BP</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
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
                : <span>Glissez plusieurs PDF ici ou <strong>cliquez pour sélectionner</strong></span>
              }
            </p>
            {items.length === 0 && <p className="drop-hint">PDF uniquement — 20 Mo max par fichier — Jusqu'à 50 fichiers</p>}
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
              <div className="batch-progress-bar">
                <div className="batch-progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
              <span className="batch-progress-label">Analyse {progress.current}/{progress.total}...</span>
            </div>
          )}

          {/* Summary */}
          {items.length > 0 && !importResults && (
            <div className="batch-summary">
              <span><FileText size={14} /> {items.length} fichier{items.length > 1 ? 's' : ''}</span>
              {parsedCount > 0 && <span className="badge success"><CheckCircle size={12} /> {parsedCount} analysé{parsedCount > 1 ? 's' : ''}</span>}
              {errorCount > 0 && <span className="badge error"><AlertTriangle size={12} /> {errorCount} erreur{errorCount > 1 ? 's' : ''}</span>}
              {uniqueAffaires > 0 && <span className="badge info"><Briefcase size={12} /> {uniqueAffaires} affaire{uniqueAffaires > 1 ? 's' : ''}</span>}
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
                      <span className={`doc-type-badge ${['bon_livraison','bl_vente','bon_preparation'].includes(item.docType) ? 'success' : 'warning'}`}>
                        {getDocTypeLabel(item.docType)}
                      </span>
                    )}
                    {item.affaireId && (
                      <span className="affaire-badge">
                        <Briefcase size={11} /> {item.affaireId}
                      </span>
                    )}
                    {item.parsedData?.confidence != null && (
                      <span className={`confidence-badge ${item.parsedData.confidence >= 70 ? 'high' : item.parsedData.confidence >= 40 ? 'medium' : 'low'}`}>
                        {item.parsedData.confidence}%
                      </span>
                    )}
                    <button
                      className="batch-file-remove"
                      onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                      title="Retirer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Expanded details */}
                  {item.expanded && item.parsedData && (
                    <div className="batch-file-details">
                      {/* Editable affaire ID + type */}
                      <div className="detail-row">
                        <label><Briefcase size={13} /> Affaire</label>
                        <input
                          type="text"
                          value={item.affaireId}
                          onChange={e => updateItem(idx, { affaireId: e.target.value })}
                          placeholder="AF32844..."
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <div className="detail-row">
                        <label><Tag size={13} /> Type</label>
                        <div className="type-pills">
                          {AFFAIRE_TYPE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              className={item.affaireType === opt.value ? 'active' : ''}
                              style={item.affaireType === opt.value ? { borderColor: opt.color, background: `${opt.color}18`, color: opt.color } : {}}
                              onClick={(e) => { e.stopPropagation(); updateItem(idx, { affaireType: opt.value }); }}
                            >
                              {opt.icon} {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Parsed fields summary */}
                      <div className="detail-fields">
                        {item.parsedData.client && <div><strong>Client :</strong> {item.parsedData.client}</div>}
                        {item.parsedData.date && <div><strong>Date :</strong> {item.parsedData.date}</div>}
                        {item.parsedData.nomAffaire && <div><strong>Objet :</strong> {item.parsedData.nomAffaire}</div>}
                        {item.parsedData.adresse && <div><strong>Adresse :</strong> {item.parsedData.adresse}</div>}
                        {item.parsedData.items?.length > 0 && (
                          <div><strong>Articles :</strong> {item.parsedData.items.length} article(s)</div>
                        )}
                        {item.parsedData.sections?.length > 0 && (
                          <div><strong>Sections :</strong> {item.parsedData.sections.map(s => s.name).join(', ')}</div>
                        )}
                      </div>
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
            <button className="btn-secondary" onClick={onClose}>
              {importResults ? 'Fermer' : 'Annuler'}
            </button>
            {!importResults && (
              <button
                className="btn-primary"
                onClick={handleBatchImport}
                disabled={parsedCount === 0 || importing}
              >
                <PackagePlus size={15} />
                {importing ? `Import en cours...` : `Importer ${parsedCount} BL/BP`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
