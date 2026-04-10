import { useState, useCallback, useRef } from 'react';
import { FileText, X, Upload, File, CheckCircle, AlertTriangle, Briefcase, Eye, EyeOff, Monitor, Save, Tag, ShieldAlert } from 'lucide-react';
import api from '../../utils/api';
import { extractTextFromPDF, smartParse, getDocTypeLabel } from '../../utils/pdfParser';
import { useToast } from '../../hooks/useToast';
import { AFFAIRE_TYPES } from '../../utils/affaireConstants';
import AddressAutocomplete from '../AddressAutocomplete';
import { CONF_COLORS } from '../../constants/colors';
import './BLImportModal.css';
import { Button, Input, ProgressBar, Tooltip } from '@/design-system';

// Types d'affaire incompatibles avec un BL Vente
const BL_VENTE_FORBIDDEN_TYPES = ['Location', 'Prestation'];

// Formater la taille de fichier
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// Alias pour compatibilité
const AFFAIRE_TYPE_OPTIONS = AFFAIRE_TYPES;

// ═══ Composant Principal ═══
function BLImportModal({ onClose, onImported, defaultAffaireId, defaultAffaireType }) {
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
  const [affaireType, setAffaireType] = useState(defaultAffaireType || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editedFields, setEditedFields] = useState({});

  // Vérification incompatibilité BL Vente ↔ type d'affaire
  const isBLVenteIncompat = docType === 'bl_vente' && BL_VENTE_FORBIDDEN_TYPES.includes(affaireType);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const parsed = smartParse(text);
      setParsedData(parsed);
      setDocType(parsed.docType);

      // Auto-remplir l'affaire si trouvée
      if (parsed?.numero && !affaireId) {
        setAffaireId(parsed.numero);
      }
      // Auto-remplir le type si détecté
      if (parsed?.type && !affaireType) {
        setAffaireType(parsed.type);
      }

      toast.success(`PDF analysé — ${parsed.docTypeLabel}`);
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
    setEditedFields({});
  };

  // Sauvegarder l'import BL dans la base
  // Fusionner les champs édités avec les données parsées
  const getMergedData = () => {
    if (!parsedData) return null;
    return { ...parsedData, ...editedFields };
  };

  const handleSave = async () => {
    if (!file && !rawText) {
      toast.warning('Aucun fichier à importer');
      return;
    }
    if (isBLVenteIncompat) {
      toast.error('Un Bon de Livraison Vente ne peut pas être importé dans une affaire ' + affaireType);
      return;
    }

    setSaving(true);
    try {
      const merged = getMergedData();
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (affaireId) formData.append('affaire_id', affaireId);
      if (affaireType) formData.append('affaire_type', affaireType);
      if (rawText) formData.append('raw_text', rawText);
      if (merged) formData.append('parsed_data', JSON.stringify(merged));
      formData.append('status', 'pending');

      const result = await api.uploadBLImport(formData);
      if (result.affaireCreated) {
        toast.success(`BL importé — Affaire ${affaireId} créée automatiquement`);
      } else {
        toast.success(`BL importé et lié à l'affaire ${affaireId || '(non spécifiée)'}`);
      }
      if (onImported) {
        onImported();
      } else {
        onClose();
      }
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
    if (isBLVenteIncompat) {
      toast.error('Un Bon de Livraison Vente ne peut pas être importé dans une affaire ' + affaireType);
      return;
    }

    setGenerating(true);
    try {
      const merged = getMergedData();
      // Sauvegarder d'abord le BL
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (affaireId) formData.append('affaire_id', affaireId);
      if (affaireType) formData.append('affaire_type', affaireType);
      if (rawText) formData.append('raw_text', rawText);
      formData.append('parsed_data', JSON.stringify(merged));
      formData.append('status', 'validated');

      const blImport = await api.uploadBLImport(formData);

      // Créer les événements d'affichage dynamique
      const today = new Date().toISOString().slice(0, 10);
      const eventsToCreate = [];
      const eventCategory = (affaireType || merged.type || 'prestation').toLowerCase();

      // Événement de livraison si date trouvée
      if (merged.date || merged.dateLivraison) {
        eventsToCreate.push({
          affaire_id: affaireId || merged.numero || null,
          bl_import_id: blImport.id,
          type: 'livraison',
          category: eventCategory,
          date: merged.dateLivraison || merged.date || today,
          period: 'AM',
          comment: `BL ${file?.name || ''} — ${(merged.items || []).length} article(s)`,
          client: merged.client || merged.destinataire || '',
          location: merged.adresse || merged.lieu || '',
        });
      }

      // Événement de préparation la veille
      if (merged.date || merged.dateLivraison) {
        const livrDate = new Date((merged.dateLivraison || merged.date) + 'T00:00:00');
        livrDate.setDate(livrDate.getDate() - 1);
        const prepDate = livrDate.toISOString().slice(0, 10);
        eventsToCreate.push({
          affaire_id: affaireId || merged.numero || null,
          bl_import_id: blImport.id,
          type: 'preparation',
          category: eventCategory,
          date: prepDate,
          period: 'PM',
          comment: `Préparation BL ${file?.name || ''} — ${(merged.items || []).length} article(s)`,
          client: merged.client || merged.destinataire || '',
          location: '',
        });
      }

      // Si pas de date, créer un seul événement pour aujourd'hui
      if (eventsToCreate.length === 0) {
        eventsToCreate.push({
          affaire_id: affaireId || merged.numero || null,
          bl_import_id: blImport.id,
          type: 'livraison',
          category: eventCategory,
          date: today,
          period: 'AM',
          comment: `BL ${file?.name || ''} — ${(merged.items || []).length} article(s)`,
          client: merged.client || merged.destinataire || '',
          location: merged.adresse || merged.lieu || '',
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

      let msg = `BL importé + ${created} événement(s) d'affichage créé(s)`;
      if (blImport.affaireCreated) {
        msg += ` — Affaire ${affaireId} créée automatiquement`;
      }
      toast.success(msg);
      if (onImported) {
        onImported();
      } else {
        onClose();
      }
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bl-import-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bl-import-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <h3><FileText size={20} /> Import Bon de Livraison</h3>
          <Button variant="ghost" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={18} /></Button>
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
                className="bl-hidden-input"
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
                  <span className={`status-badge ${['bon_livraison','bl_vente','bon_preparation'].includes(docType) ? 'success' : 'warning'}`}>
                    {getDocTypeLabel(docType)}
                  </span>
                )}
                <Tooltip content="Retirer"><Button variant="ghost" className="file-remove" onClick={handleRemoveFile}>
                  <X size={16} />
                </Button></Tooltip>
              </div>

              {/* Parsing progress */}
              {parsing && (
                <ProgressBar indeterminate />
              )}

              {/* Association affaire */}
              <div className="affaire-section">
                <label><Briefcase size={14} /> Associer à une affaire</label>
                <Input
                  type="text"
                  value={affaireId}
                  onChange={e => setAffaireId(e.target.value)}
                  placeholder="AF32844, AF33001..."
                />
              </div>

              {/* Type d'affaire */}
              <div className="affaire-section">
                <label><Tag size={14} /> Type d'affaire</label>
                <div className="bl-type-buttons">
                  {AFFAIRE_TYPE_OPTIONS.map(opt => (
                    <Button variant="ghost"                       key={opt.value}
                      type="button"
                      onClick={() => setAffaireType(opt.value)}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: '0.8rem',
                        border: affaireType === opt.value ? `2px solid ${opt.color}` : '1px solid var(--theme-border)',
                        background: affaireType === opt.value ? `${opt.color}18` : 'transparent',
                        color: affaireType === opt.value ? opt.color : 'var(--theme-text-secondary)',
                        cursor: 'pointer', fontWeight: affaireType === opt.value ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.icon} {opt.label}
                    </Button>
                  ))}
                </div>
                {isBLVenteIncompat && (
                  <div className="bl-incompat-alert">
                    <ShieldAlert size={16} />
                    <span>
                      Un <strong>Bon de Livraison Vente</strong> ne peut pas être importé dans une affaire <strong>{affaireType}</strong>.
                      Sélectionnez <em>Vente</em> ou <em>Installation</em>.
                    </span>
                  </div>
                )}
              </div>

              {/* Résultats du parsing */}
              {parsedData && (() => {
                const CONF_LABELS = { high: 'Sûr', medium: 'Incertain', low: 'Douteux' };
                const FIELD_DEFS = [
                  { key: 'numero', label: 'N° Affaire' },
                  { key: 'client', label: 'Client' },
                  { key: 'date', label: 'Date' },
                  { key: 'nomAffaire', label: 'Nom / Objet' },
                  { key: 'interlocuteur', label: 'Interlocuteur' },
                  { key: 'adresse', label: 'Adresse' },
                  { key: 'devis', label: 'Devis' },
                  { key: 'tel', label: 'Téléphone' },
                  { key: 'fax', label: 'Fax' },
                ];
                const fc = parsedData._fieldConfidence || {};
                const getVal = (key) => editedFields[key] !== undefined ? editedFields[key] : (parsedData[key] || '');
                return (
                  <div className="parse-results">
                    <h4>
                      <CheckCircle size={16} className="bl-success-icon" />
                      Données extraites
                      <span className="bl-field-count">
                        {parsedData.fieldsFound}/{parsedData.fieldsTotal} champs • {parsedData.confidence}% confiance
                      </span>
                    </h4>

                    {FIELD_DEFS.map(field => {
                      const val = getVal(field.key);
                      const conf = fc[field.key];
                      const isEdited = editedFields[field.key] !== undefined;
                      const inputStyle = {
                        flex: 1, padding: '3px 8px', borderRadius: 5, fontSize: '0.82rem',
                        border: `1px solid ${!val ? '#ef444440' : isEdited ? '#3b82f680' : 'var(--theme-border)'}`,
                        background: isEdited ? '#3b82f608' : 'var(--theme-bg-secondary)',
                        color: 'var(--theme-text-primary)',
                      };
                      return (
                        <div key={field.key} className="parsed-field">
                          <span
                            className="conf-dot bl-conf-dot"
                            title={conf ? `${CONF_LABELS[conf]} (${conf})` : 'Non détecté'}
                            style={{ color: conf ? CONF_COLORS[conf] : 'var(--theme-text-muted)' }}
                          >●</span>
                          <span className="field-label">{field.label}</span>
                          {field.key === 'adresse' ? (
                            <AddressAutocomplete
                              value={val}
                              onChange={(v) => setEditedFields(p => ({ ...p, adresse: v }))}
                              placeholder="Adresse non détectée"
                              className="bl-address-input"
                              style={inputStyle}
                            />
                          ) : (
                            <Input
                              type="text"
                              value={val}
                              onChange={e => {
                                const v = e.target.value;
                                setEditedFields(p => ({ ...p, [field.key]: v }));
                                if (field.key === 'numero') setAffaireId(v);
                              }}
                              placeholder={`${field.label} non détecté`}
                              style={inputStyle}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Sections (Format B) */}
                    {parsedData.sections && parsedData.sections.length > 0 && (
                      <div className="bl-sections-wrap">
                        <h5 className="bl-sections-title">📂 Sections ({parsedData.sections.length})</h5>
                        {parsedData.sections.map((sec, idx) => (
                          <div key={idx} className="bl-section-item">
                            <strong>{sec.name}</strong> — {sec.items?.length || 0} article(s)
                            {sec.dateDebut && <span> • {sec.dateDebut} → {sec.dateFin}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fournisseurs */}
                    {parsedData.fournisseurs && parsedData.fournisseurs.length > 0 && (
                      <div className="bl-suppliers-wrap">
                        <h5 className="bl-suppliers-title">🏭 Fournisseurs ({parsedData.fournisseurs.length})</h5>
                        <div className="bl-supplier-tags">
                          {parsedData.fournisseurs.map((f, idx) => (
                            <span key={idx} className="bl-supplier-tag">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Articles */}
                    {parsedData.items && parsedData.items.length > 0 && (
                      <div className="parsed-items">
                        <h5>Articles ({parsedData.items.length})</h5>
                        {parsedData.items.slice(0, 30).map((item, idx) => (
                          <div key={idx} className="parsed-item">
                            <span className="item-qty">{item.quantity || item.qte || '1'}</span>
                            <span className="item-desc">
                              {item.description || item.designation || item.label || JSON.stringify(item)}
                              {item.code && <span className="bl-item-code">({item.code})</span>}
                            </span>
                            {(item.reference || item.section) && (
                              <span className="bl-item-ref">({item.reference || item.section})</span>
                            )}
                            {item.fournisseur && (
                              <span className="bl-item-supplier">{item.fournisseur}</span>
                            )}
                          </div>
                        ))}
                        {parsedData.items.length > 30 && (
                          <p className="bl-items-more">
                            ... et {parsedData.items.length - 30} autre(s)
                          </p>
                        )}
                      </div>
                    )}

                    {/* Texte brut toggle */}
                    <Button variant="ghost"                       className="raw-text-toggle"
                      onClick={() => setShowRawText(!showRawText)}
                    >
                      {showRawText ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showRawText ? 'Masquer le texte brut' : 'Voir le texte brut'}
                    </Button>
                    {showRawText && (
                      <div className="raw-text-block">{rawText}</div>
                    )}
                  </div>
                );
              })()}

              {/* Pas de données */}
              {!parsing && !parsedData && rawText && (
                <div className="bl-no-data-alert">
                  <AlertTriangle size={16} />
                  Aucune donnée structurée détectée dans ce PDF.
                  <Button variant="ghost"                     className="raw-text-toggle bl-no-data-btn"
                    onClick={() => setShowRawText(!showRawText)}
                  >
                    {showRawText ? 'Masquer' : 'Voir texte brut'}
                  </Button>
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
            {parsedData && !isBLVenteIncompat && (
              <span className="status-badge success">
                <CheckCircle size={12} /> Prêt à importer
              </span>
            )}
            {isBLVenteIncompat && (
              <span className="status-badge bl-blocked-badge">
                <ShieldAlert size={12} /> Import bloqué
              </span>
            )}
          </div>
          <div className="footer-right">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            {parsedData && (
              <Button variant="ghost"                 className="btn-generate"
                onClick={handleGenerateEvents}
                disabled={generating || saving || isBLVenteIncompat}
                title={isBLVenteIncompat ? 'Type d\'affaire incompatible avec un BL Vente' : 'Importer le BL et créer les événements d\'affichage dynamique'}
              >
                <Monitor size={15} />
                {generating ? 'Génération...' : 'Importer + Créer événements'}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!file || saving || generating || isBLVenteIncompat}
            >
              <Save size={15} />
              {saving ? 'Import...' : 'Enregistrer BL'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BLImportModal;
