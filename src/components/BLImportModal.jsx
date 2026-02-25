import React, { useState, useCallback, useRef } from 'react';
import { FileText, X, Upload, File, CheckCircle, AlertTriangle, Briefcase, Eye, EyeOff, Monitor, Save } from 'lucide-react';
import api from '../utils/api';
import { extractTextFromPDF, smartParse, detectDocumentType, getDocTypeLabel } from '../utils/pdfParser';
import { useToast } from '../hooks/useToast';
import './BLImportModal.css';

// Formater la taille de fichier
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// ═══ Composant Principal ═══
function BLImportModal({ onClose, onImported, defaultAffaireId }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  // States
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [docType, setDocType] = useState(null);
  const [affaireId, setAffaireId] = useState(defaultAffaireId || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Gestion du drag & drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  const handleFileSelect = async (selectedFile) => {
    // Vérifier le type
    if (selectedFile.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés');
      return;
    }
    // Vérifier la taille (20 Mo max)
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 20 Mo)');
      return;
    }

    setFile(selectedFile);
    setParsedData(null);
    setRawText('');
    setDocType(null);

    // Parser immédiatement
    setParsing(true);
    try {
      const text = await extractTextFromPDF(selectedFile);
      setRawText(text);

      const type = detectDocumentType(text);
      setDocType(type);

      const parsed = smartParse(text);
      setParsedData(parsed);

      // Auto-remplir l'affaire si trouvée
      if (parsed?.numero && !affaireId) {
        setAffaireId(parsed.numero);
      }

      toast.success(`PDF analysé — ${getDocTypeLabel(type)}`);
    } catch (err) {
      toast.error('Erreur parsing PDF : ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedData(null);
    setRawText('');
    setDocType(null);
  };

  // Sauvegarder l'import BL dans la base
  const handleSave = async () => {
    if (!file && !rawText) {
      toast.warning('Aucun fichier à importer');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (affaireId) formData.append('affaire_id', affaireId);
      if (rawText) formData.append('raw_text', rawText);
      if (parsedData) formData.append('parsed_data', JSON.stringify(parsedData));
      formData.append('status', 'pending');

      await api.uploadBLImport(formData);
      toast.success('BL importé avec succès');
      onImported?.();
      onClose();
    } catch (err) {
      toast.error('Erreur import : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Générer les événements d'affichage dynamique à partir du BL parsé
  const handleGenerateEvents = async () => {
    if (!parsedData) {
      toast.warning('Aucune donnée parsée à convertir');
      return;
    }

    setGenerating(true);
    try {
      // Sauvegarder d'abord le BL
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (affaireId) formData.append('affaire_id', affaireId);
      if (rawText) formData.append('raw_text', rawText);
      formData.append('parsed_data', JSON.stringify(parsedData));
      formData.append('status', 'validated');

      const blImport = await api.uploadBLImport(formData);

      // Créer les événements d'affichage dynamique
      const today = new Date().toISOString().slice(0, 10);
      const eventsToCreate = [];

      // Événement de livraison si date trouvée
      if (parsedData.date || parsedData.dateLivraison) {
        eventsToCreate.push({
          affaire_id: affaireId || parsedData.numero || null,
          bl_import_id: blImport.id,
          type: 'livraison',
          category: 'prestation',
          date: parsedData.dateLivraison || parsedData.date || today,
          period: 'AM',
          comment: `BL ${file?.name || ''} — ${(parsedData.items || []).length} article(s)`,
          client: parsedData.client || parsedData.destinataire || '',
          location: parsedData.adresse || parsedData.lieu || '',
        });
      }

      // Événement de préparation la veille
      if (parsedData.date || parsedData.dateLivraison) {
        const livrDate = new Date((parsedData.dateLivraison || parsedData.date) + 'T00:00:00');
        livrDate.setDate(livrDate.getDate() - 1);
        const prepDate = livrDate.toISOString().slice(0, 10);
        eventsToCreate.push({
          affaire_id: affaireId || parsedData.numero || null,
          bl_import_id: blImport.id,
          type: 'preparation',
          category: 'prestation',
          date: prepDate,
          period: 'PM',
          comment: `Préparation BL ${file?.name || ''} — ${(parsedData.items || []).length} article(s)`,
          client: parsedData.client || parsedData.destinataire || '',
          location: '',
        });
      }

      // Si pas de date, créer un seul événement pour aujourd'hui
      if (eventsToCreate.length === 0) {
        eventsToCreate.push({
          affaire_id: affaireId || parsedData.numero || null,
          bl_import_id: blImport.id,
          type: 'livraison',
          category: 'prestation',
          date: today,
          period: 'AM',
          comment: `BL ${file?.name || ''} — ${(parsedData.items || []).length} article(s)`,
          client: parsedData.client || parsedData.destinataire || '',
          location: parsedData.adresse || parsedData.lieu || '',
        });
      }

      let created = 0;
      for (const evt of eventsToCreate) {
        try {
          await api.createDisplayEvent(evt);
          created++;
        } catch (err) {
          console.warn('Erreur création événement:', err.message);
        }
      }

      toast.success(`BL importé + ${created} événement(s) d'affichage créé(s)`);
      onImported?.();
      onClose();
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bl-import-overlay" onClick={onClose}>
      <div className="bl-import-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3><FileText size={20} /> Import Bon de Livraison</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Drop zone ou preview fichier */}
          {!file ? (
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} />
              <p className="drop-text">
                Glissez un PDF ici ou <strong>cliquez pour sélectionner</strong>
              </p>
              <p className="drop-hint">PDF uniquement — 20 Mo max</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={e => e.target.files[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <>
              {/* File preview */}
              <div className="file-preview">
                <div className="file-icon"><File size={20} /></div>
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">{formatFileSize(file.size)}</div>
                </div>
                {docType && (
                  <span className={`status-badge ${docType === 'bon_livraison' ? 'success' : 'warning'}`}>
                    {getDocTypeLabel(docType)}
                  </span>
                )}
                <button className="file-remove" onClick={handleRemoveFile} title="Retirer">
                  <X size={16} />
                </button>
              </div>

              {/* Parsing progress */}
              {parsing && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '60%' }} />
                </div>
              )}

              {/* Association affaire */}
              <div className="affaire-section">
                <label><Briefcase size={14} /> Associer à une affaire</label>
                <input
                  type="text"
                  value={affaireId}
                  onChange={e => setAffaireId(e.target.value)}
                  placeholder="AF32844, AF33001..."
                />
              </div>

              {/* Résultats du parsing */}
              {parsedData && (
                <div className="parse-results">
                  <h4>
                    <CheckCircle size={16} style={{ color: '#10b981' }} />
                    Données extraites
                  </h4>

                  {parsedData.numero && (
                    <div className="parsed-field">
                      <span className="field-label">N° Document</span>
                      <span className="field-value">{parsedData.numero}</span>
                    </div>
                  )}
                  {parsedData.client && (
                    <div className="parsed-field">
                      <span className="field-label">Client</span>
                      <span className="field-value">{parsedData.client}</span>
                    </div>
                  )}
                  {parsedData.destinataire && (
                    <div className="parsed-field">
                      <span className="field-label">Destinataire</span>
                      <span className="field-value">{parsedData.destinataire}</span>
                    </div>
                  )}
                  {(parsedData.date || parsedData.dateLivraison) && (
                    <div className="parsed-field">
                      <span className="field-label">Date</span>
                      <span className="field-value">{parsedData.dateLivraison || parsedData.date}</span>
                    </div>
                  )}
                  {parsedData.adresse && (
                    <div className="parsed-field">
                      <span className="field-label">Adresse</span>
                      <span className="field-value">{parsedData.adresse}</span>
                    </div>
                  )}
                  {(parsedData.montantHT || parsedData.montantTTC) && (
                    <div className="parsed-field">
                      <span className="field-label">Montant</span>
                      <span className="field-value">
                        {parsedData.montantHT ? `${parsedData.montantHT} HT` : ''}
                        {parsedData.montantTTC ? ` / ${parsedData.montantTTC} TTC` : ''}
                      </span>
                    </div>
                  )}

                  {/* Articles */}
                  {parsedData.items && parsedData.items.length > 0 && (
                    <div className="parsed-items">
                      <h5>Articles ({parsedData.items.length})</h5>
                      {parsedData.items.slice(0, 15).map((item, idx) => (
                        <div key={idx} className="parsed-item">
                          <span className="item-qty">{item.quantity || item.qte || '1'}</span>
                          <span className="item-desc">{item.description || item.designation || item.label || JSON.stringify(item)}</span>
                        </div>
                      ))}
                      {parsedData.items.length > 15 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '4px 12px' }}>
                          ... et {parsedData.items.length - 15} autre(s)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Texte brut toggle */}
                  <button
                    className="raw-text-toggle"
                    onClick={() => setShowRawText(!showRawText)}
                  >
                    {showRawText ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showRawText ? 'Masquer le texte brut' : 'Voir le texte brut'}
                  </button>
                  {showRawText && (
                    <div className="raw-text-block">{rawText}</div>
                  )}
                </div>
              )}

              {/* Pas de données */}
              {!parsing && !parsedData && rawText && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: 12, borderRadius: 8, marginTop: 12,
                  background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b',
                  fontSize: '0.85rem'
                }}>
                  <AlertTriangle size={16} />
                  Aucune donnée structurée détectée dans ce PDF.
                  <button
                    className="raw-text-toggle"
                    onClick={() => setShowRawText(!showRawText)}
                    style={{ marginLeft: 'auto' }}
                  >
                    {showRawText ? 'Masquer' : 'Voir texte brut'}
                  </button>
                </div>
              )}
              {!parsing && !parsedData && showRawText && rawText && (
                <div className="raw-text-block">{rawText}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="footer-left">
            {parsedData && (
              <span className="status-badge success">
                <CheckCircle size={12} /> Prêt à importer
              </span>
            )}
          </div>
          <div className="footer-right">
            <button className="btn-secondary" onClick={onClose}>Annuler</button>
            {parsedData && (
              <button
                className="btn-generate"
                onClick={handleGenerateEvents}
                disabled={generating || saving}
                title="Importer le BL et créer les événements d'affichage dynamique"
              >
                <Monitor size={15} />
                {generating ? 'Génération...' : 'Importer + Créer événements'}
              </button>
            )}
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!file || saving || generating}
            >
              <Save size={15} />
              {saving ? 'Import...' : 'Enregistrer BL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BLImportModal;
