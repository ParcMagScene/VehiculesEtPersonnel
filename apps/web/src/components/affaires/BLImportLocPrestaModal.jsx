import { useState, useCallback, useRef } from 'react';
import { X, Upload, File, CheckCircle, AlertTriangle, Briefcase, Eye, EyeOff, Monitor, Save, Tag, Layers, Calendar, Package, ShieldAlert, Link2 } from 'lucide-react';
import api from '../../utils/api';
import { extractTextFromPDF, smartParse, getDocTypeLabel, DOC_TYPES } from '../../utils/pdfParser';
import { useToast } from '../../hooks/useToast';
import AddressAutocomplete from '../AddressAutocomplete';
import { CONF_COLORS } from '../../constants/colors';
import './BLImportLocPrestaModal.css';
import { Button, Input, ProgressBar, InlineAlert, Tooltip } from '@/design-system';

// Seuls Location et Prestation sont autorisés ici
const ALLOWED_TYPES = ['Location', 'Prestation'];

// Types d'affaire disponibles (restreints)
const TYPE_OPTIONS = [
  { value: 'Prestation', label: 'Prestation', color: '#3b82f6', icon: '🎭' },
  { value: 'Location', label: 'Location', color: '#f59e0b', icon: '🏗️' },
];

// Couleurs de section
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

// Formater la taille de fichier
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// ═══ Composant Principal ═══
function BLImportLocPrestaModal({ onClose, onImported, defaultAffaireId, defaultAffaireType }) {
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
  const [affaireType, setAffaireType] = useState(
    ALLOWED_TYPES.includes(defaultAffaireType) ? defaultAffaireType : ''
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editedFields, setEditedFields] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [catalogMatches, setCatalogMatches] = useState({});

  // Warning si le doc n'est pas un Bon de Préparation
  const isWrongDocType = docType && docType !== DOC_TYPES.BON_PREPARATION;

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
    if (selectedFile.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 20 Mo)');
      return;
    }

    setFile(selectedFile);
    setParsedData(null);
    setRawText('');
    setDocType(null);
    setEditedFields({});
    setExpandedSections({});

    setParsing(true);
    try {
      const text = await extractTextFromPDF(selectedFile);
      setRawText(text);

      const parsed = smartParse(text);
      setParsedData(parsed);
      setDocType(parsed.docType);

      // Auto-remplir l'affaire
      if (parsed?.numero && !affaireId) {
        setAffaireId(parsed.numero);
      }
      // Auto-remplir le type depuis le parsing
      if (parsed?.type && !affaireType && ALLOWED_TYPES.includes(parsed.type)) {
        setAffaireType(parsed.type);
      }

      // Expand all sections by default
      if (parsed?.sections) {
        const expanded = {};
        parsed.sections.forEach((_, idx) => { expanded[idx] = true; });
        setExpandedSections(expanded);
      }

      if (parsed.docType === DOC_TYPES.BON_PREPARATION) {
        toast.success(`PDF analysé — Bon de Préparation • ${parsed.sections?.length || 0} section(s) • ${parsed.items?.length || 0} article(s)`);
      } else {
        toast.warning(`PDF analysé — ${parsed.docTypeLabel || 'Document inconnu'} (attendu : Bon de Préparation)`);
      }

      // Matching automatique des références avec le catalogue
      if (parsed.items?.length > 0) {
        const refs = parsed.items.map(i => i.reference).filter(Boolean);
        if (refs.length > 0) {
          try {
            const result = await api.matchCatalogReferences(refs);
            if (result?.matches) {
              setCatalogMatches(result.matches);
              const matchCount = Object.keys(result.matches).length;
              if (matchCount > 0) {
                toast.info(`${matchCount}/${refs.length} référence(s) trouvée(s) dans le catalogue`);
              }
            }
          } catch {
            // Silently ignore matching errors
          }
        }
      }
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
    setExpandedSections({});
  };

  const getMergedData = () => {
    if (!parsedData) return null;
    return { ...parsedData, ...editedFields };
  };

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ─── Sauvegarder ───
  const handleSave = async () => {
    if (!file && !rawText) {
      toast.warning('Aucun fichier à importer');
      return;
    }
    if (!affaireType) {
      toast.warning('Veuillez sélectionner un type d\'affaire (Location ou Prestation)');
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
        toast.success(`Bon de Préparation importé — Affaire ${affaireId} créée automatiquement`);
      } else {
        toast.success(`Bon de Préparation importé et lié à l'affaire ${affaireId || '(non spécifiée)'}`);
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

  // ─── Générer événements d'affichage dynamique ───
  const handleGenerateEvents = async () => {
    if (!parsedData) {
      toast.warning('Aucune donnée parsée à convertir');
      return;
    }
    if (!affaireType) {
      toast.warning('Veuillez sélectionner un type d\'affaire');
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

      // Créer les événements d'affichage dynamique à partir des sections et leurs dates
      const today = new Date().toISOString().slice(0, 10);
      const eventsToCreate = [];
      const eventCategory = (affaireType || 'prestation').toLowerCase();

      // Si des sections ont des dates, créer un événement par plage de section
      if (merged.sections && merged.sections.length > 0) {
        const sectionsWithDates = merged.sections.filter(s => s.dateDebut);
        if (sectionsWithDates.length > 0) {
          // Trouver la première date de livraison (plus ancienne)
          let earliestDate = null;
          for (const sec of sectionsWithDates) {
            // dateDebut format: "DD/MM/YYYY AM/PM"
            const dm = sec.dateDebut.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (dm) {
              const isoDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
              if (!earliestDate || isoDate < earliestDate) earliestDate = isoDate;
            }
          }

          // Trouver la dernière date de fin
          let latestDate = null;
          for (const sec of sectionsWithDates) {
            const dm = sec.dateFin?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (dm) {
              const isoDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
              if (!latestDate || isoDate > latestDate) latestDate = isoDate;
            }
          }

          const sectionNames = merged.sections.map(s => s.name).join(', ');
          const totalItems = merged.items?.length || 0;

          // Événement de livraison
          eventsToCreate.push({
            affaire_id: affaireId || merged.numero || null,
            bl_import_id: blImport.id,
            type: 'livraison',
            category: eventCategory,
            date: earliestDate || today,
            period: 'AM',
            comment: `Bon de Préparation ${file?.name || ''} — ${totalItems} article(s) [${sectionNames}]`,
            client: merged.client || merged.destinataire || '',
            location: merged.adresse || merged.lieu || '',
          });

          // Événement de préparation (veille)
          if (earliestDate) {
            const livrDate = new Date(earliestDate + 'T00:00:00');
            livrDate.setDate(livrDate.getDate() - 1);
            const prepDate = livrDate.toISOString().slice(0, 10);
            eventsToCreate.push({
              affaire_id: affaireId || merged.numero || null,
              bl_import_id: blImport.id,
              type: 'preparation',
              category: eventCategory,
              date: prepDate,
              period: 'PM',
              comment: `Préparation ${file?.name || ''} — ${totalItems} article(s) [${sectionNames}]`,
              client: merged.client || merged.destinataire || '',
              location: '',
            });
          }

          // Événement de retour (lendemain de la dernière date)
          if (latestDate) {
            const retDate = new Date(latestDate + 'T00:00:00');
            retDate.setDate(retDate.getDate() + 1);
            const retourDate = retDate.toISOString().slice(0, 10);
            eventsToCreate.push({
              affaire_id: affaireId || merged.numero || null,
              bl_import_id: blImport.id,
              type: 'retour',
              category: eventCategory,
              date: retourDate,
              period: 'AM',
              comment: `Retour matériel ${file?.name || ''} — ${totalItems} article(s)`,
              client: merged.client || merged.destinataire || '',
              location: '',
            });
          }
        }
      }

      // Fallback: un seul événement aujourd'hui
      if (eventsToCreate.length === 0) {
        eventsToCreate.push({
          affaire_id: affaireId || merged.numero || null,
          bl_import_id: blImport.id,
          type: 'livraison',
          category: eventCategory,
          date: merged.date || today,
          period: 'AM',
          comment: `Bon de Préparation ${file?.name || ''} — ${(merged.items || []).length} article(s)`,
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

      let msg = `Bon de Préparation importé + ${created} événement(s) créé(s)`;
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

  // ─── Rendering helpers ───
  const getVal = (key) => editedFields[key] !== undefined ? editedFields[key] : (parsedData?.[key] || '');

  const CONF_LABELS = { high: 'Sûr', medium: 'Incertain', low: 'Douteux' };

  const FIELD_DEFS = [
    { key: 'numero', label: 'N° Affaire' },
    { key: 'client', label: 'Client' },
    { key: 'nomAffaire', label: 'Nom / Objet' },
    { key: 'interlocuteur', label: 'Interlocuteur' },
    { key: 'adresse', label: 'Adresse livraison' },
    { key: 'devis', label: 'Devis' },
    { key: 'tel', label: 'Téléphone' },
    { key: 'fax', label: 'Fax' },
  ];

  return (
    <div className="bl-loc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bl-loc-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="bl-loc-header">
          <h3><Layers size={20} /> Import Bon de Préparation</h3>
          <span className="bl-loc-header-badge">Location / Prestation</span>
          <Button variant="ghost" className="bl-loc-close" onClick={onClose} aria-label="Fermer"><X size={18} /></Button>
        </div>

        {/* Body */}
        <div className="bl-loc-body">
          {/* Drop zone ou preview fichier */}
          {!file ? (
            <div
              className={`bl-loc-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} />
              <p className="bl-loc-drop-text">
                Glissez un <strong>Bon de Préparation</strong> PDF ici
              </p>
              <p className="bl-loc-drop-hint">ou cliquez pour sélectionner — PDF uniquement, 20 Mo max</p>
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
              <div className="bl-loc-file-preview">
                <div className="bl-loc-file-icon"><File size={20} /></div>
                <div className="bl-loc-file-info">
                  <div className="bl-loc-file-name">{file.name}</div>
                  <div className="bl-loc-file-size">{formatFileSize(file.size)}</div>
                </div>
                {docType && (
                  <span className={`bl-loc-badge ${docType === DOC_TYPES.BON_PREPARATION ? 'success' : 'warning'}`}>
                    {getDocTypeLabel(docType)}
                  </span>
                )}
                <Tooltip content="Retirer"><Button variant="ghost" className="bl-loc-file-remove" onClick={handleRemoveFile}>
                  <X size={16} />
                </Button></Tooltip>
              </div>

              {/* Parsing progress */}
              {parsing && (
                <ProgressBar indeterminate color="warning" />
              )}

              {/* Warning si le doc n'est pas un BP */}
              {isWrongDocType && (
                <InlineAlert variant="warning">
                  Ce document est un <strong>{getDocTypeLabel(docType)}</strong>, pas un Bon de Préparation.
                  Utilisez l'import BL Vente/Installation pour ce type de document.
                </InlineAlert>
              )}

              {/* Association affaire */}
              <div className="bl-loc-field-section">
                <label><Briefcase size={14} /> Associer à une affaire</label>
                <Input
                  type="text"
                  value={affaireId}
                  onChange={e => setAffaireId(e.target.value)}
                  placeholder="AF32844, AF33001..."
                />
              </div>

              {/* Type d'affaire (Location ou Prestation seulement) */}
              <div className="bl-loc-field-section">
                <label><Tag size={14} /> Type d'affaire</label>
                <div className="bl-loc-type-buttons">
                  {TYPE_OPTIONS.map(opt => (
                    <Button variant="ghost"                       key={opt.value}
                      type="button"
                      className={`bl-loc-type-btn ${affaireType === opt.value ? 'active' : ''}`}
                      onClick={() => setAffaireType(opt.value)}
                      style={{
                        '--type-color': opt.color,
                        borderColor: affaireType === opt.value ? opt.color : undefined,
                        background: affaireType === opt.value ? `${opt.color}18` : undefined,
                        color: affaireType === opt.value ? opt.color : undefined,
                      }}
                    >
                      {opt.icon} {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Résultats du parsing */}
              {parsedData && !isWrongDocType && (() => {
                const fc = parsedData._fieldConfidence || {};
                return (
                  <div className="bl-loc-results">
                    <h4>
                      <CheckCircle size={16} style={{ color: '#10b981' }} />
                      Données extraites
                      <span className="bl-loc-results-meta">
                        {parsedData.fieldsFound}/{parsedData.fieldsTotal} champs • {parsedData.confidence}% confiance
                      </span>
                    </h4>

                    {/* Champs principaux */}
                    <div className="bl-loc-fields">
                      {FIELD_DEFS.map(field => {
                        const val = getVal(field.key);
                        const conf = fc[field.key];
                        const isEdited = editedFields[field.key] !== undefined;
                        return (
                          <div key={field.key} className="bl-loc-parsed-field">
                            <span
                              className="bl-loc-conf-dot"
                              title={conf ? `${CONF_LABELS[conf]} (${conf})` : 'Non détecté'}
                              style={{ color: conf ? CONF_COLORS[conf] : 'var(--theme-text-muted)' }}
                            >●</span>
                            <span className="bl-loc-field-label">{field.label}</span>
                            {field.key === 'adresse' ? (
                              <AddressAutocomplete
                                value={val}
                                onChange={(v) => setEditedFields(p => ({ ...p, adresse: v }))}
                                placeholder="Adresse non détectée"
                                className="bl-loc-address-input"
                              />
                            ) : (
                              <Input
                                type="text"
                                value={val}
                                onChange={e => {
                                  const v = e.target.value;
                                  setEditedFields(p => ({ ...p, [field.key]: v }));
                                  // Synchroniser le numéro d'affaire avec le champ d'association
                                  if (field.key === 'numero') setAffaireId(v);
                                }}
                                placeholder={`${field.label} non détecté`}
                                className={`bl-loc-field-input ${isEdited ? 'edited' : ''} ${!val ? 'empty' : ''}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ─── Sections avec articles groupés ─── */}
                    {parsedData.sections && parsedData.sections.length > 0 && (
                      <div className="bl-loc-sections">
                        <h5 className="bl-loc-sections-title">
                          <Layers size={14} />
                          Sections ({parsedData.sections.length})
                          <span className="bl-loc-sections-total">
                            {parsedData.items?.length || 0} article(s) au total
                          </span>
                        </h5>
                        {parsedData.sections.map((sec, idx) => {
                          const sc = getSecColor(sec.name);
                          const isExpanded = expandedSections[idx];
                          return (
                            <div
                              key={idx}
                              className={`bl-loc-section ${isExpanded ? 'expanded' : ''}`}
                              style={{ '--sec-bg': sc.bg, '--sec-border': sc.border, '--sec-text': sc.text }}
                            >
                              <div className="bl-loc-section-header" role="button" tabIndex={0} onClick={() => toggleSection(idx)}>
                                <span className="bl-loc-section-icon">{sc.icon}</span>
                                <span className="bl-loc-section-name">{sec.name}</span>
                                <span className="bl-loc-section-count">{sec.items?.length || 0} art.</span>
                                {sec.dateDebut && (
                                  <span className="bl-loc-section-dates">
                                    <Calendar size={12} />
                                    {sec.dateDebut} → {sec.dateFin}
                                  </span>
                                )}
                                <span className={`bl-loc-section-chevron ${isExpanded ? 'open' : ''}`}>▸</span>
                              </div>
                              {isExpanded && sec.items && sec.items.length > 0 && (
                                <div className="bl-loc-section-items">
                                  <div className="bl-loc-items-header">
                                    <Tooltip content="Catalogue" position="bottom"><span className="bl-loc-col-match">🔗</span></Tooltip>
                                    <span className="bl-loc-col-ref">Référence</span>
                                    <span className="bl-loc-col-desc">Désignation</span>
                                    <span className="bl-loc-col-qty">Qté</span>
                                    <span className="bl-loc-col-poids">Poids</span>
                                    <span className="bl-loc-col-vol">Vol.</span>
                                  </div>
                                  {sec.items.map((item, iIdx) => {
                                    const match = item.reference ? catalogMatches[item.reference] : null;
                                    return (
                                    <div key={iIdx} className={`bl-loc-item-row ${match ? 'matched' : ''}`}>
                                      <span className="bl-loc-col-match">
                                        {match ? (
                                          <span title={`✅ ${match.name} (${match.family || ''})`} style={{ cursor: 'help' }}>
                                            <Link2 size={13} style={{ color: '#10b981' }} />
                                          </span>
                                        ) : item.reference ? (
                                          <Tooltip content="Référence non trouvée dans le catalogue" position="bottom"><span style={{ opacity: 0.3 }}>—</span></Tooltip>
                                        ) : null}
                                      </span>
                                      <span className="bl-loc-col-ref">{item.reference || '—'}</span>
                                      <span className="bl-loc-col-desc">{item.description || '—'}</span>
                                      <span className="bl-loc-col-qty">{item.quantity || 0}</span>
                                      <span className="bl-loc-col-poids">{item.poids || '—'}</span>
                                      <span className="bl-loc-col-vol">{item.volume || '—'}</span>
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Résumé global si articles sans sections */}
                    {(!parsedData.sections || parsedData.sections.length === 0) && parsedData.items && parsedData.items.length > 0 && (
                      <div className="bl-loc-flat-items">
                        <h5><Package size={14} /> Articles ({parsedData.items.length})</h5>
                        {parsedData.items.slice(0, 40).map((item, idx) => {
                          const match = item.reference ? catalogMatches[item.reference] : null;
                          return (
                          <div key={idx} className={`bl-loc-item-row flat ${match ? 'matched' : ''}`}>
                            <span className="bl-loc-col-match">
                              {match ? <Link2 size={13} style={{ color: '#10b981' }} title={`✅ ${match.name}`} /> : null}
                            </span>
                            <span className="bl-loc-col-ref">{item.reference || '—'}</span>
                            <span className="bl-loc-col-desc">{item.description || '—'}</span>
                            <span className="bl-loc-col-qty">{item.quantity || 0}</span>
                          </div>
                          );
                        })}
                        {parsedData.items.length > 40 && (
                          <p className="bl-loc-items-more">... et {parsedData.items.length - 40} autre(s)</p>
                        )}
                      </div>
                    )}

                    {/* Toggle texte brut */}
                    <Button variant="ghost"                       className="bl-loc-raw-toggle"
                      onClick={() => setShowRawText(!showRawText)}
                    >
                      {showRawText ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showRawText ? 'Masquer le texte brut' : 'Voir le texte brut'}
                    </Button>
                    {showRawText && (
                      <div className="bl-loc-raw-text">{rawText}</div>
                    )}
                  </div>
                );
              })()}

              {/* Pas de données */}
              {!parsing && !parsedData && rawText && (
                <div className="bl-loc-no-data">
                  <AlertTriangle size={16} />
                  Aucune donnée structurée détectée dans ce PDF.
                  <Button variant="ghost" className="bl-loc-raw-toggle" onClick={() => setShowRawText(!showRawText)} style={{ marginLeft: 'auto' }}>
                    {showRawText ? 'Masquer' : 'Voir texte brut'}
                  </Button>
                </div>
              )}
              {!parsing && !parsedData && showRawText && rawText && (
                <div className="bl-loc-raw-text">{rawText}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bl-loc-footer">
          <div className="bl-loc-footer-left">
            {parsedData && !isWrongDocType && (
              <span className="bl-loc-badge success">
                <CheckCircle size={12} /> Prêt à importer
              </span>
            )}
            {isWrongDocType && (
              <span className="bl-loc-badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                <ShieldAlert size={12} /> Type de document incompatible
              </span>
            )}
          </div>
          <div className="bl-loc-footer-right">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            {parsedData && !isWrongDocType && (
              <Tooltip content="Importer et créer les événements d'affichage dynamique" position="bottom">
                <Button variant="ghost"                 className="bl-loc-btn-events"
                onClick={handleGenerateEvents}
                disabled={generating || saving || !affaireType}
 
              >
                <Monitor size={15} />
                {generating ? 'Génération...' : 'Importer + Événements'}
              </Button>
              </Tooltip>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!file || saving || generating || isWrongDocType || !affaireType}
            >
              <Save size={15} />
              {saving ? 'Import...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BLImportLocPrestaModal;
