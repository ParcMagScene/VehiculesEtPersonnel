import './BLImportModal.css';

import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Eye,
  EyeOff,
  File,
  Layers,
  Link2,
  Monitor,
  Package,
  Save,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import {
  Button,
  InlineAlert,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ProgressBar,
  Tooltip,
} from '@/design-system';

import { CONF_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import { AFFAIRE_TYPES } from '../../utils/affaireConstants';
import api from '../../utils/api';
import { DOC_TYPES, extractTextFromPDF, getDocTypeLabel, smartParse } from '../../utils/pdfParser';
import AddressAutocomplete from '../AddressAutocomplete';

// Tous les types d'affaire sont supportés (Location, Prestation, Installation, Vente, Tournée).
const TYPE_OPTIONS = AFFAIRE_TYPES;

// Couleurs de section
const SECTION_COLORS = {
  SONORISATION: {
    bg: 'rgba(99, 102, 241, 0.10)',
    border: 'rgba(99, 102, 241, 0.3)',
    text: '#818cf8',
    icon: '🔊',
  },
  LUMIERE: {
    bg: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.3)',
    text: '#fbbf24',
    icon: '💡',
  },
  LUMIÈRE: {
    bg: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.3)',
    text: '#fbbf24',
    icon: '💡',
  },
  ÉCLAIRAGE: {
    bg: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.3)',
    text: '#fbbf24',
    icon: '💡',
  },
  'REGIE/PLATEAU': {
    bg: 'rgba(16, 185, 129, 0.10)',
    border: 'rgba(16, 185, 129, 0.3)',
    text: '#34d399',
    icon: '🎬',
  },
  RÉGIE: {
    bg: 'rgba(16, 185, 129, 0.10)',
    border: 'rgba(16, 185, 129, 0.3)',
    text: '#34d399',
    icon: '🎬',
  },
  STRUCTURE: {
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.3)',
    text: '#f87171',
    icon: '🏗️',
  },
  VIDEO: {
    bg: 'rgba(139, 92, 246, 0.10)',
    border: 'rgba(139, 92, 246, 0.3)',
    text: '#a78bfa',
    icon: '📹',
  },
  VIDÉO: {
    bg: 'rgba(139, 92, 246, 0.10)',
    border: 'rgba(139, 92, 246, 0.3)',
    text: '#a78bfa',
    icon: '📹',
  },
  AUDIOVISUEL: {
    bg: 'rgba(139, 92, 246, 0.10)',
    border: 'rgba(139, 92, 246, 0.3)',
    text: '#a78bfa',
    icon: '🎥',
  },
  ELECTRICITE: {
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.3)',
    text: '#f87171',
    icon: '⚡',
  },
  ÉLECTRICITÉ: {
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.3)',
    text: '#f87171',
    icon: '⚡',
  },
  CÂBLAGE: {
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.3)',
    text: '#f87171',
    icon: '⚡',
  },
  BACKLINE: {
    bg: 'rgba(16, 185, 129, 0.10)',
    border: 'rgba(16, 185, 129, 0.3)',
    text: '#34d399',
    icon: '🎸',
  },
  'RIDEAU-MACHINERIE': {
    bg: 'rgba(236, 72, 153, 0.10)',
    border: 'rgba(236, 72, 153, 0.3)',
    text: '#f472b6',
    icon: '🎭',
  },
  RIDEAU: {
    bg: 'rgba(236, 72, 153, 0.10)',
    border: 'rgba(236, 72, 153, 0.3)',
    text: '#f472b6',
    icon: '🎭',
  },
  INFORMATIQUE: {
    bg: 'rgba(6, 182, 212, 0.10)',
    border: 'rgba(6, 182, 212, 0.3)',
    text: '#22d3ee',
    icon: '💻',
  },
  ACCROCHE: {
    bg: 'rgba(20, 184, 166, 0.10)',
    border: 'rgba(20, 184, 166, 0.3)',
    text: '#2dd4bf',
    icon: '🔗',
  },
  MOTORISATION: {
    bg: 'rgba(249, 115, 22, 0.10)',
    border: 'rgba(249, 115, 22, 0.3)',
    text: '#fb923c',
    icon: '⚙️',
  },
  MOBILIER: {
    bg: 'rgba(107, 114, 128, 0.10)',
    border: 'rgba(107, 114, 128, 0.3)',
    text: '#9ca3af',
    icon: '🪑',
  },
  OUTILLAGE: {
    bg: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.3)',
    text: '#fbbf24',
    icon: '🔧',
  },
  VENTE: {
    bg: 'rgba(251, 191, 36, 0.10)',
    border: 'rgba(251, 191, 36, 0.3)',
    text: '#fbbf24',
    icon: '🛒',
  },
  DIFFUSION: {
    bg: 'rgba(99, 102, 241, 0.10)',
    border: 'rgba(99, 102, 241, 0.3)',
    text: '#818cf8',
    icon: '🔊',
  },
  DIVERS: {
    bg: 'rgba(148, 163, 184, 0.10)',
    border: 'rgba(148, 163, 184, 0.3)',
    text: 'var(--theme-text-muted)',
    icon: '📦',
  },
};
const getSecColor = (name) => SECTION_COLORS[name] || SECTION_COLORS.DIVERS;

// Formater la taille de fichier
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// ═══ Composant Principal ═══
/**
 * BLImportModal — Import unifie de Bon de Livraison / Bon de Preparation (BL/BP).
 *
 * Modal d'import PDF (drag & drop ou selection) qui :
 *  - accepte un OU plusieurs fichiers (file d'attente avec revue par fichier),
 *  - accepte tous les types d'affaire (Location, Prestation, Installation, Vente, Tournee),
 *  - extrait le texte du PDF cote client puis applique smartParse,
 *  - rapproche les lignes extraites avec le catalogue (catalogMatches),
 *  - permet le pliage/depliage par section (expandedSections),
 *  - cree ensuite l'enregistrement bl_imports cote serveur (affaire auto-creee si
 *    elle n'existe pas).
 *
 * En mode multi-fichier, l'utilisateur revoit chaque fichier puis clique
 * "Importer & Suivant" : la modale reste ouverte et avance dans la queue.
 *
 * @param {Object} props
 * @param {() => void} props.onClose - Ferme la modal (avec garde dirty form).
 * @param {(result: any) => void} props.onImported - Callback apres import OK
 *   (appele une seule fois en fin de batch).
 * @param {string} [props.defaultAffaireId] - Affaire pre-selectionnee.
 * @param {string} [props.defaultAffaireType] - Type d'affaire pre-selectionne.
 */
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
  const [expandedSections, setExpandedSections] = useState({});
  const [catalogMatches, setCatalogMatches] = useState({});
  // ─── File d'attente multi-fichier ───
  // pendingFiles : fichiers en attente de traitement (FIFO)
  // processedFiles : historique { name, status: 'imported'|'error', error? }
  const [pendingFiles, setPendingFiles] = useState([]);
  const [processedFiles, setProcessedFiles] = useState([]);

  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { resetDirty, guardClose } = useDirtyForm(
    {
      fileName: file?.name || '',
      affaireId,
      affaireType,
      editedFields,
      pending: pendingFiles.length,
    },
    { confirmer: confirm },
  );
  const handleSafeClose = guardClose(onClose);

  // Information si le doc detecte n'est pas un Bon de Preparation (non bloquant).
  const isWrongDocType = docType && docType !== DOC_TYPES.BON_PREPARATION;
  const totalQueue = (file ? 1 : 0) + pendingFiles.length + processedFiles.length;
  const isBatch = totalQueue > 1;

  // Gestion du drag & drop (multi-fichier)
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
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) handleFilesSelect(dropped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reinit du brouillon courant (entre 2 fichiers d'un batch).
  const resetCurrentDraft = () => {
    setFile(null);
    setParsedData(null);
    setRawText('');
    setDocType(null);
    setEditedFields({});
    setExpandedSections({});
    setCatalogMatches({});
    setAffaireId(defaultAffaireId || '');
    setAffaireType(defaultAffaireType || '');
  };

  // Selection multi-fichier : 1er = brouillon courant, le reste va en queue.
  const handleFilesSelect = (files) => {
    if (!files || files.length === 0) return;
    const pdfs = files.filter((f) => f.type === 'application/pdf');
    if (pdfs.length === 0) {
      toast.error('Seuls les fichiers PDF sont acceptes');
      return;
    }
    if (pdfs.length < files.length) {
      toast.warning(`${files.length - pdfs.length} fichier(s) ignore(s) (non PDF)`);
    }
    const tooBig = pdfs.filter((f) => f.size > 20 * 1024 * 1024);
    const ok = pdfs.filter((f) => f.size <= 20 * 1024 * 1024);
    if (tooBig.length > 0) {
      toast.warning(`${tooBig.length} fichier(s) trop volumineux (max 20 Mo) ignore(s)`);
    }
    if (ok.length === 0) return;
    if (file) {
      // Brouillon courant en cours d'edition : on empile tout en queue.
      setPendingFiles((prev) => [...prev, ...ok]);
      toast.info(`${ok.length} fichier(s) ajoute(s) a la file d'attente`);
      return;
    }
    const [first, ...rest] = ok;
    if (rest.length > 0) setPendingFiles((prev) => [...prev, ...rest]);
    handleFileSelect(first);
  };

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
    setCatalogMatches({});

    setParsing(true);
    try {
      const text = await extractTextFromPDF(selectedFile);
      setRawText(text);

      const parsed = smartParse(text, selectedFile?.name || '');
      setParsedData(parsed);
      setDocType(parsed.docType);

      // Auto-remplir l'affaire (toujours, pour faciliter la revue par fichier)
      if (parsed?.numero) {
        setAffaireId(parsed.numero);
      }
      // Auto-remplir le type depuis le parsing (tous types acceptés)
      if (parsed?.type) {
        setAffaireType(parsed.type);
      }

      // Alerte si le parsing n'a pas trouvé de numéro d'affaire
      if (!parsed?.numero && !affaireId) {
        toast.warning(
          "Numéro d'affaire non détecté dans le PDF. Veuillez le saisir manuellement avant d'importer.",
        );
      }

      // Expand all sections by default
      if (parsed?.sections) {
        const expanded = {};
        parsed.sections.forEach((_, idx) => {
          expanded[idx] = true;
        });
        setExpandedSections(expanded);
      }

      if (parsed.docType === DOC_TYPES.BON_PREPARATION) {
        toast.success(
          `PDF analysé — Bon de Préparation • ${parsed.sections?.length || 0} section(s) • ${parsed.items?.length || 0} article(s)`,
        );
      } else {
        toast.info(`PDF analysé — ${parsed.docTypeLabel || 'Document inconnu'}`);
      }

      // Matching automatique des références avec le catalogue
      if (parsed.items?.length > 0) {
        const refs = parsed.items.map((i) => i.reference).filter(Boolean);
        if (refs.length > 0) {
          try {
            const result = await api.matchCatalogReferences(refs);
            if (result?.matches) {
              setCatalogMatches(result.matches);
              const matchCount = Object.keys(result.matches).length;
              if (matchCount > 0) {
                toast.info(
                  `${matchCount}/${refs.length} référence(s) trouvée(s) dans le catalogue`,
                );
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

  // Avance vers le fichier suivant (apres import reussi en mode batch).
  const advanceToNextFile = async () => {
    setPendingFiles((prev) => {
      const [next, ...rest] = prev;
      if (next) {
        // Charger le prochain de façon differee pour que les autres setStates soient appliques
        resetCurrentDraft();
        setTimeout(() => handleFileSelect(next), 0);
        return rest;
      }
      return prev;
    });
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedData(null);
    setRawText('');
    setDocType(null);
    setEditedFields({});
    setExpandedSections({});
    setCatalogMatches({});
  };

  // Retire un fichier en attente (avant traitement).
  const removePendingAt = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const getMergedData = () => {
    if (!parsedData) return null;
    return { ...parsedData, ...editedFields };
  };

  const toggleSection = (idx) => {
    setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ─── Sauvegarder ───
  const handleSave = async () => {
    if (!file && !rawText) {
      toast.warning('Aucun fichier à importer');
      return;
    }
    if (!affaireType) {
      toast.warning("Veuillez sélectionner un type d'affaire");
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
        toast.success(`BL/BP importé — Affaire ${affaireId} créée automatiquement`);
      } else {
        toast.success(`BL/BP importé et lié à l'affaire ${affaireId || '(non spécifiée)'}`);
      }
      const importedName = file?.name || '(texte)';
      setProcessedFiles((prev) => [...prev, { name: importedName, status: 'imported' }]);
      // Mode batch : avancer au suivant si la queue n'est pas vide
      if (pendingFiles.length > 0) {
        await advanceToNextFile();
      } else {
        resetDirty();
        if (onImported) onImported();
        else onClose();
      }
    } catch (err) {
      toast.error('Erreur import : ' + err.message);
      const failedName = file?.name || '(texte)';
      setProcessedFiles((prev) => [
        ...prev,
        { name: failedName, status: 'error', error: err.message },
      ]);
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
      toast.warning("Veuillez sélectionner un type d'affaire");
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
        const sectionsWithDates = merged.sections.filter((s) => s.dateDebut);
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

          const sectionNames = merged.sections.map((s) => s.name).join(', ');
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

      let msg = `BL/BP importé + ${created} événement(s) créé(s)`;
      if (blImport.affaireCreated) {
        msg += ` — Affaire ${affaireId} créée automatiquement`;
      }
      toast.success(msg);
      const importedName = file?.name || '(texte)';
      setProcessedFiles((prev) => [...prev, { name: importedName, status: 'imported' }]);
      // Mode batch : avancer au suivant si la queue n'est pas vide
      if (pendingFiles.length > 0) {
        await advanceToNextFile();
      } else {
        resetDirty();
        if (onImported) onImported();
        else onClose();
      }
    } catch (err) {
      toast.error('Erreur : ' + err.message);
      const failedName = file?.name || '(texte)';
      setProcessedFiles((prev) => [
        ...prev,
        { name: failedName, status: 'error', error: err.message },
      ]);
    } finally {
      setGenerating(false);
    }
  };

  // ─── Rendering helpers ───
  const getVal = (key) =>
    editedFields[key] !== undefined ? editedFields[key] : parsedData?.[key] || '';

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
    <>
      <Modal open={true} onClose={handleSafeClose} size="xl" className="bl-loc-modal">
        <ModalHeader icon={<Layers size={20} />} onClose={handleSafeClose}>
          Import BL / BP
          <span className="bl-loc-header-badge">
            {isBatch
              ? `Lot • ${processedFiles.length}/${totalQueue}`
              : 'Bon de Livraison / Préparation'}
          </span>
        </ModalHeader>
        <ModalBody className="bl-loc-body">
          {/* Bandeau queue (multi-fichier) */}
          {(pendingFiles.length > 0 || processedFiles.length > 0) && (
            <div className="bl-loc-queue-strip">
              <div className="bl-loc-queue-header">
                <Layers size={14} />
                <span>
                  File d&apos;attente — {processedFiles.length} traité(s), {pendingFiles.length} en
                  attente
                  {file ? ' (1 en cours)' : ''}
                </span>
              </div>
              <div className="bl-loc-queue-items">
                {processedFiles.map((p, idx) => (
                  <span
                    key={`done-${idx}`}
                    className={`bl-loc-queue-chip ${p.status}`}
                    title={p.error || p.name}
                  >
                    {p.status === 'imported' ? (
                      <CheckSquare size={12} />
                    ) : (
                      <AlertTriangle size={12} />
                    )}
                    {p.name}
                  </span>
                ))}
                {file && (
                  <span className="bl-loc-queue-chip current" title={file.name}>
                    <ChevronRight size={12} /> {file.name}
                  </span>
                )}
                {pendingFiles.map((f, idx) => (
                  <span key={`pend-${idx}`} className="bl-loc-queue-chip pending" title={f.name}>
                    {f.name}
                    <button
                      type="button"
                      className="bl-loc-queue-chip-remove"
                      onClick={() => removePendingAt(idx)}
                      aria-label={`Retirer ${f.name}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

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
                Glissez un ou plusieurs <strong>BL / BP</strong> PDF ici
              </p>
              <p className="bl-loc-drop-hint">
                ou cliquez pour sélectionner — PDF uniquement, 20 Mo max par fichier
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                className="u-hidden"
                onChange={(e) =>
                  e.target.files?.length && handleFilesSelect(Array.from(e.target.files))
                }
              />
            </div>
          ) : (
            <>
              {/* File preview */}
              <div className="bl-loc-file-preview">
                <div className="bl-loc-file-icon">
                  <File size={20} />
                </div>
                <div className="bl-loc-file-info">
                  <div className="bl-loc-file-name">{file.name}</div>
                  <div className="bl-loc-file-size">{formatFileSize(file.size)}</div>
                </div>
                {docType && (
                  <span
                    className={`bl-loc-badge ${docType === DOC_TYPES.BON_PREPARATION ? 'success' : 'warning'}`}
                  >
                    {getDocTypeLabel(docType)}
                  </span>
                )}
                <Tooltip content="Retirer">
                  <Button variant="ghost" className="bl-loc-file-remove" onClick={handleRemoveFile}>
                    <X size={16} />
                  </Button>
                </Tooltip>
              </div>

              {/* Parsing progress */}
              {parsing && <ProgressBar indeterminate color="warning" />}

              {/* Info si le doc detecte n'est pas un Bon de Preparation (non bloquant) */}
              {isWrongDocType && (
                <InlineAlert variant="info">
                  Document détecté : <strong>{getDocTypeLabel(docType)}</strong>. Vous pouvez
                  l&apos;importer tel quel — le rapprochement avec le catalogue n&apos;est optimal
                  que pour les Bons de Préparation.
                </InlineAlert>
              )}

              {/* Association affaire */}
              <div className="bl-loc-field-section">
                <label>
                  <Briefcase size={14} /> Associer à une affaire
                </label>
                <Input
                  type="text"
                  value={affaireId}
                  onChange={(e) => setAffaireId(e.target.value)}
                  placeholder="AF32844, AF33001..."
                />
              </div>

              {/* Type d'affaire */}
              <div className="bl-loc-field-section">
                <label>
                  <Tag size={14} /> Type d'affaire
                </label>
                <div className="bl-loc-type-buttons">
                  {TYPE_OPTIONS.map((opt) => (
                    <Button
                      variant="ghost"
                      key={opt.value}
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
              {parsedData &&
                !isWrongDocType &&
                (() => {
                  const fc = parsedData._fieldConfidence || {};
                  return (
                    <div className="bl-loc-results">
                      <h4>
                        <CheckCircle size={16} style={{ color: STATUS_COLORS.success }} />
                        Données extraites
                        <span className="bl-loc-results-meta">
                          {parsedData.fieldsFound}/{parsedData.fieldsTotal} champs •{' '}
                          {parsedData.confidence}% confiance
                        </span>
                      </h4>

                      {/* Champs principaux */}
                      <div className="bl-loc-fields">
                        {FIELD_DEFS.map((field) => {
                          const val = getVal(field.key);
                          const conf = fc[field.key];
                          const isEdited = editedFields[field.key] !== undefined;
                          return (
                            <div key={field.key} className="bl-loc-parsed-field">
                              <span
                                className="bl-loc-conf-dot"
                                title={conf ? `${CONF_LABELS[conf]} (${conf})` : 'Non détecté'}
                                style={{
                                  color: conf ? CONF_COLORS[conf] : 'var(--theme-text-muted)',
                                }}
                              >
                                ●
                              </span>
                              <span className="bl-loc-field-label">{field.label}</span>
                              {field.key === 'adresse' ? (
                                <AddressAutocomplete
                                  value={val}
                                  onChange={(v) => setEditedFields((p) => ({ ...p, adresse: v }))}
                                  placeholder="Adresse non détectée"
                                  className="bl-loc-address-input"
                                />
                              ) : (
                                <Input
                                  type="text"
                                  value={val}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditedFields((p) => ({ ...p, [field.key]: v }));
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
                                style={{
                                  '--sec-bg': sc.bg,
                                  '--sec-border': sc.border,
                                  '--sec-text': sc.text,
                                }}
                              >
                                <div
                                  className="bl-loc-section-header"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleSection(idx)}
                                >
                                  <span className="bl-loc-section-icon">{sc.icon}</span>
                                  <span className="bl-loc-section-name">{sec.name}</span>
                                  <span className="bl-loc-section-count">
                                    {sec.items?.length || 0} art.
                                  </span>
                                  {sec.dateDebut && (
                                    <span className="bl-loc-section-dates">
                                      <Calendar size={12} />
                                      {sec.dateDebut} → {sec.dateFin}
                                    </span>
                                  )}
                                  <span
                                    className={`bl-loc-section-chevron ${isExpanded ? 'open' : ''}`}
                                  >
                                    ▸
                                  </span>
                                </div>
                                {isExpanded && sec.items && sec.items.length > 0 && (
                                  <div className="bl-loc-section-items">
                                    <div className="bl-loc-items-header">
                                      <Tooltip content="Catalogue" position="bottom">
                                        <span className="bl-loc-col-match">🔗</span>
                                      </Tooltip>
                                      <span className="bl-loc-col-ref">Référence</span>
                                      <span className="bl-loc-col-desc">Désignation</span>
                                      <span className="bl-loc-col-qty">Qté</span>
                                      <span className="bl-loc-col-poids">Poids</span>
                                      <span className="bl-loc-col-vol">Vol.</span>
                                    </div>
                                    {sec.items.map((item, iIdx) => {
                                      const match = item.reference
                                        ? catalogMatches[item.reference]
                                        : null;
                                      return (
                                        <div
                                          key={iIdx}
                                          className={`bl-loc-item-row ${match ? 'matched' : ''}`}
                                        >
                                          <span className="bl-loc-col-match">
                                            {match ? (
                                              <span
                                                title={`✅ ${match.name} (${match.family || ''})`}
                                                style={{ cursor: 'help' }}
                                              >
                                                <Link2
                                                  size={13}
                                                  style={{ color: STATUS_COLORS.success }}
                                                />
                                              </span>
                                            ) : item.reference ? (
                                              <Tooltip
                                                content="Référence non trouvée dans le catalogue"
                                                position="bottom"
                                              >
                                                <span className="u-opacity-30">—</span>
                                              </Tooltip>
                                            ) : null}
                                          </span>
                                          <span className="bl-loc-col-ref">
                                            {item.reference || '—'}
                                          </span>
                                          <span className="bl-loc-col-desc">
                                            {item.description || '—'}
                                          </span>
                                          <span className="bl-loc-col-qty">
                                            {item.quantity || 0}
                                          </span>
                                          <span className="bl-loc-col-poids">
                                            {item.poids || '—'}
                                          </span>
                                          <span className="bl-loc-col-vol">
                                            {item.volume || '—'}
                                          </span>
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
                      {(!parsedData.sections || parsedData.sections.length === 0) &&
                        parsedData.items &&
                        parsedData.items.length > 0 && (
                          <div className="bl-loc-flat-items">
                            <h5>
                              <Package size={14} /> Articles ({parsedData.items.length})
                            </h5>
                            {parsedData.items.slice(0, 40).map((item, idx) => {
                              const match = item.reference ? catalogMatches[item.reference] : null;
                              return (
                                <div
                                  key={idx}
                                  className={`bl-loc-item-row flat ${match ? 'matched' : ''}`}
                                >
                                  <span className="bl-loc-col-match">
                                    {match ? (
                                      <Link2
                                        size={13}
                                        style={{ color: STATUS_COLORS.success }}
                                        title={`✅ ${match.name}`}
                                      />
                                    ) : null}
                                  </span>
                                  <span className="bl-loc-col-ref">{item.reference || '—'}</span>
                                  <span className="bl-loc-col-desc">{item.description || '—'}</span>
                                  <span className="bl-loc-col-qty">{item.quantity || 0}</span>
                                </div>
                              );
                            })}
                            {parsedData.items.length > 40 && (
                              <p className="bl-loc-items-more">
                                ... et {parsedData.items.length - 40} autre(s)
                              </p>
                            )}
                          </div>
                        )}

                      {/* Toggle texte brut */}
                      <Button
                        variant="ghost"
                        className="bl-loc-raw-toggle"
                        onClick={() => setShowRawText(!showRawText)}
                      >
                        {showRawText ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showRawText ? 'Masquer le texte brut' : 'Voir le texte brut'}
                      </Button>
                      {showRawText && <div className="bl-loc-raw-text">{rawText}</div>}
                    </div>
                  );
                })()}

              {/* Pas de données */}
              {!parsing && !parsedData && rawText && (
                <div className="bl-loc-no-data">
                  <AlertTriangle size={16} />
                  Aucune donnée structurée détectée dans ce PDF.
                  <Button
                    variant="ghost"
                    className="bl-loc-raw-toggle u-ml-auto"
                    onClick={() => setShowRawText(!showRawText)}
                  >
                    {showRawText ? 'Masquer' : 'Voir texte brut'}
                  </Button>
                </div>
              )}
              {!parsing && !parsedData && showRawText && rawText && (
                <div className="bl-loc-raw-text">{rawText}</div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter className="bl-loc-footer">
          <div className="bl-loc-footer-left">
            {parsedData && (
              <span className="bl-loc-badge success">
                <CheckCircle size={12} /> Prêt à importer
              </span>
            )}
            {isWrongDocType && (
              <span
                className="bl-loc-badge"
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: STATUS_COLORS.warning,
                }}
              >
                <AlertTriangle size={12} /> {getDocTypeLabel(docType)}
              </span>
            )}
          </div>
          <div className="bl-loc-footer-right">
            <Button variant="ghost" onClick={handleSafeClose}>
              Annuler
            </Button>
            {parsedData && (
              <Tooltip
                content="Importer et créer les événements d'affichage dynamique"
                position="bottom"
              >
                <Button
                  variant="ghost"
                  className="bl-loc-btn-events"
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
              disabled={!file || saving || generating || !affaireType}
            >
              <Save size={15} />
              {saving
                ? 'Import...'
                : pendingFiles.length > 0
                  ? `Importer & Suivant (${pendingFiles.length})`
                  : 'Enregistrer'}
            </Button>
          </div>
        </ModalFooter>
      </Modal>
      {ConfirmDialogRenderer}
    </>
  );
}

export default BLImportModal;
