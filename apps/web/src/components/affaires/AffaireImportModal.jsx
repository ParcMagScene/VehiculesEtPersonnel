import React, { useState, useRef, useEffect, useCallback } from 'react';
import logger from "../../utils/logger";
import api, { getApiUrl } from '../../utils/api';
import './AffaireImportModal.css';
import { extractTextFromPDF, parseBonLivraison, parseDate, smartParse, batchParsePDFs, getDocTypeLabel, DOC_TYPES } from '../../utils/pdfParser';
import { addToIndexedDB, updateInIndexedDB, loadFromIndexedDB, STORES } from '../../utils/indexedDB';
import PhoneInput from '../PhoneInput';
import AddressAutocomplete from '../AddressAutocomplete';
import { useToast } from '../../hooks/useToast';

const AffaireImportModal = ({ 
  isOpen, 
  onClose, 
  event,
  onEventCreated,
  onEventUpdated,
  onRequestEditReservation
}) => {
  const toast = useToast();
  const [step, setStep] = useState('upload'); // 'choice', 'upload', 'form', 'edit-event', 'upload-additional'
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [additionalBLs, setAdditionalBLs] = useState([]);
  const [formData, setFormData] = useState({
    numeroAffaire: '',
    type: 'Prestation',
    client: '',
    interlocuteur: '',
    tel: '',
    fax: '',
    dateDebut: '',
    devis: '',
    adresseLivraison: '',
    titre: '',
    description: ''
  });
  const [eventFormData, setEventFormData] = useState({
    titre: '',
    description: '',
    dateDebut: '',
    dateFin: ''
  });
  const [existingAffaires, setExistingAffaires] = useState([]);
  const [replaceConfirm, setReplaceConfirm] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // ═══ Nouveaux états : aperçu PDF, détection type, batch ═══
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [detectedDocType, setDetectedDocType] = useState(null); // { docType, docTypeLabel, confidence }
  const [extractedText, setExtractedText] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchResults, setBatchResults] = useState([]); // [{ file, docType, confidence, info, error }]
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(-1);
  
  const fileInputRef = useRef(null);
  const additionalFileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  // Convertir les dates en format string
  const getDateString = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date.split('T')[0];
    if (date instanceof Date) return date.toISOString().split('T')[0];
    // Google Calendar format: { dateTime: "2026-01-29T10:00:00+01:00" } ou { date: "2026-01-29" }
    if (date.dateTime) return date.dateTime.split('T')[0];
    if (date.date) return date.date;
    return '';
  };

  // Déterminer le workflow en fonction de l'événement
  const workflow = event 
    ? (event.extendedProps?.numeroAffaire ? 'update' : 'import-or-create')
    : 'new';

  useEffect(() => {
    if (isOpen && event) {
      logger.log('🔄 Modal ouvert pour event:', event.id, event.summary);
      logger.log('📅 Event complet:', event);
      
      // Réinitialiser complètement tous les états
      setAdditionalBLs([]);
      setExistingAffaires([]);
      
      // Nettoyer le titre en enlevant le numéro d'affaire
      const cleanTitle = (title, numeroAffaire) => {
        if (!title || !numeroAffaire) return title || '';
        // Enlever "AF32624", "af 32624", "AF 32624", etc.
        const pattern = new RegExp(`\\s*${numeroAffaire.replace(/\s+/g, '\\s*')}\\s*`, 'gi');
        return title.replace(pattern, ' ').trim();
      };
      
      // Réinitialiser le formulaire avec les données de l'événement Google
      const initialFormData = {
        numeroAffaire: event.affaire || event.extendedProps?.numeroAffaire || '',
        type: 'Prestation',
        client: '',
        interlocuteur: '',
        tel: '',
        fax: '',
        dateDebut: getDateString(event.start),
        devis: '',
        adresseLivraison: '',
        titre: cleanTitle(event.summary, event.affaire || event.extendedProps?.numeroAffaire),
        description: event.extendedProps?.description || event.description || ''
      };
      
      logger.log('📝 Formulaire initialisé avec:', initialFormData.titre, '- N° affaire:', initialFormData.numeroAffaire);
      
      setFormData(initialFormData);
      setInitialFormData(initialFormData); // Sauvegarder pour comparaison
      setHasChanges(false); // Reset des changements
      
      // Log immédiat après setFormData
      setTimeout(() => {
        logger.log('🔍 State formData après setFormData:', formData.client, formData.titre);
      }, 100);
      
      setEventFormData({
        titre: event.summary || '',
        description: event.extendedProps?.description || event.description || '',
        dateDebut: getDateString(event.start),
        dateFin: getDateString(event.end)
      });
      setPdfFile(null);
      
      // Charger les affaires de CET événement spécifique
      const loadAffaires = async () => {
        try {
          const allAffaires = await loadFromIndexedDB(STORES.affaires, []);
          logger.log('📦 Toutes les affaires:', allAffaires.map(a => ({ id: a.eventId, client: a.client })));
          
          const affaires = allAffaires.filter(a => a.eventId === event.id);
          logger.log('🎯 Affaires pour cet event:', affaires);
          
          setExistingAffaires(affaires);
          
          // Définir le step en fonction de l'existence d'affaires
          setStep(affaires.length > 0 ? 'choice' : 'upload');
          
          // Si une affaire existe, pré-remplir le formulaire
          if (affaires.length > 0) {
            const affaire = affaires[0];
            logger.log('✏️ Pré-remplissage avec affaire:', affaire.client);
            
            setFormData({
              ...initialFormData,
              numeroAffaire: affaire.numeroAffaire || '',
              type: affaire.type || 'Prestation',
              client: affaire.client || '',
              interlocuteur: affaire.interlocuteur || '',
              tel: affaire.tel || '',
              fax: affaire.fax || '',
              dateDebut: affaire.dateDebut || initialFormData.dateDebut,
              devis: affaire.devis || '',
              adresseLivraison: affaire.adresseLivraison || '',
              titre: event.summary || '',
              description: affaire.description || initialFormData.description
            });
            
            // Charger les BL additionnels
            if (affaire.additionalBLs) {
              setAdditionalBLs(affaire.additionalBLs);
            }
          } else {
            logger.log('ℹ️ Aucune affaire, utilisation des données Google Calendar');
          }
        } catch (error) {
          console.error('Erreur chargement affaires:', error);
        }
      };
      
      loadAffaires();
    }
  }, [isOpen, event?.id]);

  // Détecter les changements dans le formulaire
  useEffect(() => {
    if (!initialFormData) {
      setHasChanges(false);
      return;
    }
    
    const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    setHasChanges(hasChanged);
  }, [formData, initialFormData]);

  const loadExistingAffaires = async () => {
    if (!event?.id) return;
    
    try {
      const allAffaires = await loadFromIndexedDB(STORES.affaires, []);
      const affaires = allAffaires.filter(a => a.eventId === event.id);
      setExistingAffaires(affaires);
      
      // Si une affaire existe, pré-remplir le formulaire avec les données de l'affaire
      if (affaires.length > 0) {
        const affaire = affaires[0];
        setFormData(prev => ({
          ...prev,
          numeroAffaire: affaire.numeroAffaire || '',
          type: affaire.type || 'Prestation',
          client: affaire.client || '',
          interlocuteur: affaire.interlocuteur || '',
          tel: affaire.tel || '',
          fax: affaire.fax || '',
          dateDebut: affaire.dateDebut || prev.dateDebut,
          devis: affaire.devis || '',
          adresseLivraison: affaire.adresseLivraison || '',
          titre: event.summary || '',
          description: affaire.description || prev.description
        }));
        
        // Charger les BL additionnels
        if (affaire.additionalBLs) {
          setAdditionalBLs(affaire.additionalBLs);
        }
      }
    } catch (error) {
      console.error('Erreur chargement affaires:', error);
    }
  };

  const handleAdditionalBLUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      toast.warning('Veuillez sélectionner un fichier PDF');
      return;
    }

    try {
      const reader = new FileReader();
      const pdfData = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const newBL = {
        fileName: file.name,
        data: pdfData,
        uploadedAt: new Date().toISOString()
      };

      setAdditionalBLs(prev => [...prev, newBL]);
      setStep('form');
    } catch (error) {
      console.error('Erreur upload BL additionnel:', error);
      toast.error('Erreur lors de l\'upload du BL');
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileSelection(files[0]);
    }
  };

  const handleFileInput = async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = async (file) => {
    if (file.type !== 'application/pdf') {
      toast.warning('Veuillez sélectionner un fichier PDF');
      return;
    }

    // Vérifier si le PDF existe déjà
    const existingPdf = existingAffaires.find(a => a.pdfFileName === file.name);
    if (existingPdf && workflow === 'update') {
      setReplaceConfirm({ file, existing: existingPdf });
      return;
    }

    await processPDF(file);
  };

  const processPDF = async (file, forceReplace = false) => {
    setIsProcessing(true);
    setPdfFile(file);

    try {
      logger.log('🚀 Démarrage du traitement PDF:', file.name);
      
      // Extraire le texte du PDF
      const text = await extractTextFromPDF(file);
      logger.log('📝 Texte extrait:', text.substring(0, 200) + '...');
      setExtractedText(text);
      
      // Générer l'aperçu PDF
      const previewUrl = URL.createObjectURL(file);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(previewUrl);
      
      // Parse intelligent : détection auto du type + parseur spécialisé
      const parsed = smartParse(text);
      const info = parsed.info;
      setDetectedDocType({ docType: parsed.docType, docTypeLabel: parsed.docTypeLabel, confidence: parsed.confidence });
      logger.log('📊 Informations parsées (%s, confiance %d%):', parsed.docTypeLabel, parsed.confidence, info);

      // Vérifier si ce numéro d'affaire existe déjà
      const numeroAffaire = info.numeroAffaire || '';
      if (numeroAffaire && existingAffaires.length > 0 && !forceReplace) {
        const existing = existingAffaires.find(a => 
          a.numeroAffaire && a.numeroAffaire.toLowerCase() === numeroAffaire.toLowerCase()
        );
        
        if (existing) {
          // BL existe déjà, demander confirmation
          setReplaceConfirm({
            file,
            numeroAffaire,
            existing,
            action: 'replace' // ou 'add' si l'utilisateur choisit d'ajouter
          });
          setIsProcessing(false);
          return;
        }
      }
      
      // Préremplir le formulaire (dateLocation est normalisé par smartParse)
      const dateValue = info.dateLocation || info.dateDevis || info.dateFacture || null;
      setFormData(prev => ({
        ...prev,
        numeroAffaire: info.numeroAffaire || prev.numeroAffaire,
        type: info.type || prev.type,
        client: info.client || prev.client,
        interlocuteur: info.interlocuteur || prev.interlocuteur,
        tel: info.tel || prev.tel,
        fax: info.fax || prev.fax,
        dateDebut: dateValue || prev.dateDebut,
        devis: info.devis || prev.devis,
        adresseLivraison: info.adresseLivraison || prev.adresseLivraison,
        titre: prev.titre || info.nomAffaire || '',
        description: prev.description || `${info.client || ''} - ${info.nomAffaire || ''}`
      }));

      logger.log('✅ Formulaire prérempli avec succès');
      setStep('form');
    } catch (error) {
      console.error('❌ Erreur traitement PDF:', error);
      toast.warning(`Erreur lors de l'analyse du PDF: ${error.message} Veuillez remplir le formulaire manuellement.`);
      setStep('form');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReplace = async (action = 'replace') => {
    if (replaceConfirm) {
      if (action === 'replace') {
        // Remplacer le BL existant
        await processPDF(replaceConfirm.file, true);
      } else if (action === 'add') {
        // Ajouter comme nouveau BL sans remplacer
        // On force le traitement même si le numéro existe
        await processPDF(replaceConfirm.file, true);
      }
      setReplaceConfirm(null);
    }
  };

  const handleCancelReplace = () => {
    setReplaceConfirm(null);
    setPdfFile(null);
  };

  const savePDFToStorage = async (file, eventId, affaireId) => {
    try {
      // Créer un dossier virtuel pour l'événement dans IndexedDB
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
          try {
            const pdfData = {
              eventId,
              affaireId,
              fileName: file.name,
              data: e.target.result,
              uploadDate: new Date().toISOString()
            };
            
            // Sauvegarder aussi le PDF physiquement sur le serveur
            try {
              const formData = new FormData();
              formData.append('pdf', file);
              formData.append('affaireId', affaireId);
              
              const token = localStorage.getItem('auth_token');
              const response = await fetch(`${getApiUrl()}/upload-bl`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
              });
              
              if (response.ok) {
                const result = await response.json();
                pdfData.serverPath = result.path;
              } else {
                console.warn('⚠️ Échec sauvegarde serveur, PDF uniquement dans IndexedDB');
              }
            } catch (serverError) {
              console.warn('⚠️ Erreur sauvegarde serveur:', serverError);
            }
            
            // Pour l'instant, on stocke les métadonnées dans l'affaire
            // Le blob PDF sera stocké dans le navigateur via IndexedDB
            resolve(pdfData);
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Erreur sauvegarde PDF:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!formData.numeroAffaire || !formData.client) {
      toast.warning('Veuillez renseigner au moins le numéro d\'affaire et le client');
      return;
    }

    setIsProcessing(true);

    try {
      const eventId = event?.id;

      // Sauvegarder le PDF
      let pdfData = null;
      if (pdfFile) {
        pdfData = await savePDFToStorage(pdfFile, eventId, formData.numeroAffaire);
      }

      // Sauvegarder l'affaire en base de données via l'API
      const affairePayload = {
        numero_affaire: formData.numeroAffaire,
        type: formData.type,
        client: formData.client,
        interlocuteur: formData.interlocuteur,
        tel: formData.tel,
        fax: formData.fax,
        date_debut: formData.dateDebut,
        date_fin: '', // Sera enrichi via l'événement Google
        devis: formData.devis,
        adresse_livraison: formData.adresseLivraison,
        titre: formData.titre,
        description: formData.description,
        google_event_id: eventId || '',
        event_name: event?.summary || '',
      };

      // Calculer date_fin depuis l'événement si disponible
      if (event?.end) {
        affairePayload.date_fin = typeof event.end === 'string'
          ? event.end.split('T')[0]
          : event.end?.date || event.end?.dateTime?.split('T')[0] || '';
      }

      try {
        await api.createOrUpdateAffaire(affairePayload);
        logger.log('✅ Affaire sauvegardée en DB:', formData.numeroAffaire);
      } catch (dbError) {
        console.error('Erreur sauvegarde affaire en DB:', dbError);
      }

      // Garder aussi dans IndexedDB pour le cache local (PDF data etc.)
      const affaire = {
        eventId,
        numeroAffaire: formData.numeroAffaire,
        type: formData.type,
        client: formData.client,
        interlocuteur: formData.interlocuteur,
        tel: formData.tel,
        fax: formData.fax,
        dateDebut: formData.dateDebut,
        devis: formData.devis,
        adresseLivraison: formData.adresseLivraison,
        pdfFileName: pdfFile?.name,
        pdfData: pdfData?.data,
        additionalBLs: additionalBLs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Vérifier si l'affaire existe déjà dans IndexedDB
      const existing = existingAffaires.find(a => a.numeroAffaire === formData.numeroAffaire);
      
      if (existing) {
        affaire.id = existing.id;
        await updateInIndexedDB(STORES.affaires, affaire);
      } else {
        await addToIndexedDB(STORES.affaires, affaire);
      }

      // Mettre à jour l'événement Google Calendar avec le numéro d'affaire
      if (event && formData.numeroAffaire) {
        const updatedEvent = {
          ...event,
          affaire: formData.numeroAffaire,
          extendedProps: {
            ...event.extendedProps,
            numeroAffaire: formData.numeroAffaire,
            description: formData.description
          }
        };
        
        // Notifier le parent que l'événement a été mis à jour
        if (onEventUpdated) {
          onEventUpdated(updatedEvent);
        }
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde de l\'affaire');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateWithoutPDF = () => {
    setStep('form');
  };

  // ═══ Handlers batch mode ═══
  const handleBatchUpload = async (files) => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      toast.warning('Aucun fichier PDF sélectionné');
      return;
    }
    if (pdfFiles.length === 1) {
      setBatchMode(false);
      await handleFileSelection(pdfFiles[0]);
      return;
    }
    // Mode batch
    setBatchMode(true);
    setIsProcessing(true);
    setBatchProgress({ current: 0, total: pdfFiles.length });
    setBatchResults([]);
    setSelectedBatchIndex(-1);

    const results = await batchParsePDFs(pdfFiles, (current, total, result) => {
      setBatchProgress({ current, total });
      setBatchResults(prev => [...prev, result]);
    });

    setIsProcessing(false);
    logger.log('📦 Batch terminé:', results.length, 'fichiers traités');
  };

  const handleSelectBatchResult = (index) => {
    setSelectedBatchIndex(index);
    const result = batchResults[index];
    if (!result || result.error) return;

    setPdfFile(result.file);
    setDetectedDocType({ docType: result.docType, docTypeLabel: result.docTypeLabel, confidence: result.confidence });
    setExtractedText(result.text);

    const info = result.info;
    const dateValue = info.dateLocation || info.dateDevis || info.dateFacture || null;
    setFormData(prev => ({
      ...prev,
      numeroAffaire: info.numeroAffaire || prev.numeroAffaire,
      type: info.type || prev.type,
      client: info.client || prev.client,
      interlocuteur: info.interlocuteur || prev.interlocuteur,
      tel: info.tel || prev.tel,
      fax: info.fax || prev.fax,
      dateDebut: dateValue || prev.dateDebut,
      devis: info.devis || prev.devis,
      adresseLivraison: info.adresseLivraison || prev.adresseLivraison,
      titre: prev.titre || info.nomAffaire || '',
      description: prev.description || `${info.client || ''} - ${info.nomAffaire || ''}`
    }));

    // Preview URL
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(URL.createObjectURL(result.file));
    setStep('form');
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 70) return '#10b981';
    if (confidence >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 70) return 'Élevée';
    if (confidence >= 40) return 'Moyenne';
    return 'Faible';
  };

  const resetForm = () => {
    setStep('choice');
    setPdfFile(null);
    setFormData({
      numeroAffaire: '',
      type: 'Prestation',
      client: '',
      interlocuteur: '',
      tel: '',
      fax: '',
      dateDebut: '',
      devis: '',
      adresseLivraison: '',
      titre: '',
      description: ''
    });
    setExistingAffaires([]);
    setReplaceConfirm(null);
    setDetectedDocType(null);
    setExtractedText('');
    setBatchMode(false);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: 0 });
    setSelectedBatchIndex(-1);
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    setShowPreview(false);
  };

  if (!isOpen) return null;

  return (
    <div className="affaire-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="affaire-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="affaire-modal-header">
          <h2>
            {step === 'choice' && 'Import BL'}
            {step === 'upload' && 'Import BL - Sélection du fichier'}
            {step === 'upload-additional' && 'Ajouter un BL supplémentaire'}
            {step === 'form' && `Import BL - ${formData.numeroAffaire || 'Informations'}`}
            {step === 'edit-event' && 'Modifier l\'événement'}
          </h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="affaire-modal-body">
          {/* Étape 1: Choix de l'action */}
          {step === 'choice' && (
            <div className="choice-step">
              {workflow === 'new' && (
                <>
                  <button 
                    className="choice-button"
                    onClick={() => setStep('upload')}
                  >
                    📄 Importer un BL pour cet événement
                  </button>
                </>
              )}
              
              {workflow === 'import-or-create' && (
                <>
                  <button 
                    className="choice-button"
                    onClick={() => setStep('form')}
                  >
                    ✏️ Modifier les informations
                  </button>
                  <button 
                    className="choice-button"
                    onClick={() => setStep('upload')}
                  >
                    📄 {existingAffaires.length > 0 ? 'Remplacer le BL' : 'Importer un BL'}
                  </button>
                  <button 
                    className="choice-button"
                    onClick={() => setStep('upload-additional')}
                  >
                    📎 Ajouter un BL supplémentaire
                  </button>
                </>
              )}
              
              {workflow === 'update' && (
                <button 
                  className="choice-button"
                  onClick={() => setStep('upload')}
                >
                  📄 Importer/Remplacer le BL
                </button>
              )}
            </div>
          )}

          {/* Étape 2: Upload du PDF (simple ou batch) */}
          {step === 'upload' && !isProcessing && !batchMode && (
            <div 
              ref={dropZoneRef}
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const files = e.dataTransfer.files;
                if (files.length > 1) {
                  handleBatchUpload(files);
                } else if (files.length === 1) {
                  handleFileSelection(files[0]);
                }
              }}
            >
              <div className="drop-zone-content">
                <div className="drop-zone-icon">📁</div>
                <p className="drop-zone-text">
                  Glissez-déposez un ou plusieurs PDF ici
                </p>
                <p className="drop-zone-or">ou</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button 
                    className="browse-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Parcourir
                  </button>
                  <button 
                    className="browse-button batch-browse"
                    onClick={() => {
                      fileInputRef.current.multiple = true;
                      fileInputRef.current?.click();
                    }}
                  >
                    📦 Lot de PDFs
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files.length > 1) {
                      handleBatchUpload(files);
                    } else if (files.length === 1) {
                      handleFileSelection(files[0]);
                    }
                    fileInputRef.current.multiple = false;
                  }}
                />
              </div>
            </div>
          )}

          {/* Résultats batch */}
          {step === 'upload' && !isProcessing && batchMode && batchResults.length > 0 && (
            <div className="batch-results-panel">
              <div className="batch-results-header">
                <h3>📦 {batchResults.length} documents analysés</h3>
                <button className="btn-reset-batch" onClick={() => { setBatchMode(false); setBatchResults([]); }}>
                  ← Retour
                </button>
              </div>
              <div className="batch-results-list">
                {batchResults.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`batch-result-item ${selectedBatchIndex === idx ? 'selected' : ''} ${result.error ? 'error' : ''}`}
                    onClick={() => !result.error && handleSelectBatchResult(idx)}
                  >
                    <div className="batch-result-file">
                      <span className="batch-result-icon">{result.error ? '❌' : '📄'}</span>
                      <span className="batch-result-name">{result.file.name}</span>
                    </div>
                    {result.error ? (
                      <span className="batch-result-error">{result.error}</span>
                    ) : (
                      <div className="batch-result-meta">
                        <span className="doc-type-badge" style={{ background: getConfidenceColor(result.confidence) + '20', color: getConfidenceColor(result.confidence), border: `1px solid ${getConfidenceColor(result.confidence)}40` }}>
                          {result.docTypeLabel}
                        </span>
                        <span className="batch-result-fields">
                          {result.info.fieldsFound}/{result.info.fieldsTotal} champs
                        </span>
                        {result.info.numeroAffaire && (
                          <span className="batch-result-affaire">{result.info.numeroAffaire}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              {batchMode ? (
                <div>
                  <p>Analyse des PDFs... {batchProgress.current}/{batchProgress.total}</p>
                  <div className="batch-progress-bar">
                    <div className="batch-progress-fill" style={{ width: `${batchProgress.total ? (batchProgress.current / batchProgress.total * 100) : 0}%` }} />
                  </div>
                </div>
              ) : (
                <p>Analyse du PDF en cours...</p>
              )}
            </div>
          )}

          {/* Confirmation de remplacement */}
          {replaceConfirm && (
            <div className="replace-confirm">
              <p className="warning-text">
                ⚠️ Le BL <strong>{replaceConfirm.numeroAffaire}</strong> existe déjà pour cet événement
              </p>
              <p style={{ marginBottom: '16px', color: 'var(--theme-text-secondary)' }}>
                Que souhaitez-vous faire ?
              </p>
              <div className="button-group">
                <button className="btn-cancel" onClick={handleCancelReplace}>
                  Annuler
                </button>
                <button 
                  className="btn-add" 
                  onClick={() => handleConfirmReplace('add')}
                  style={{
                    background: 'var(--theme-success)',
                    color: 'var(--theme-text-inverse)'
                  }}
                >
                  ➕ Ajouter comme nouvelle affaire
                </button>
                <button 
                  className="btn-confirm" 
                  onClick={() => handleConfirmReplace('replace')}
                >
                  🔄 Remplacer les données existantes
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--theme-text-muted)', marginTop: '12px' }}>
                <strong>Ajouter :</strong> Crée une nouvelle affaire avec ce BL, liée à cet événement<br/>
                <strong>Remplacer :</strong> Met à jour les données de l'affaire existante avec ce BL
              </p>
            </div>
          )}

          {/* Étape 3: Formulaire */}
          {step === 'form' && !isProcessing && (
            <div className="form-step">
              {/* Informations de l'événement Google */}
              {event && (
                <div className="event-info" style={{
                  background: 'var(--theme-info-bg)',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  fontSize: '14px',
                  border: '1px solid var(--theme-info-border)'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--theme-info-text)' }}>
                    📅 Événement Google Calendar
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <strong>Début :</strong> {getDateString(event.start) || 'Non défini'}
                    </div>
                    <div>
                      <strong>Fin :</strong> {getDateString(event.end) || 'Non défini'}
                    </div>
                  </div>
                  {event.location && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Lieu :</strong> {event.location}
                    </div>
                  )}
                </div>
              )}
              
              {/* Badge type de document détecté */}
              {detectedDocType && (
                <div className="detected-doc-banner">
                  <div className="doc-type-info">
                    <span className="doc-type-badge" style={{ background: getConfidenceColor(detectedDocType.confidence) + '20', color: getConfidenceColor(detectedDocType.confidence), border: `1px solid ${getConfidenceColor(detectedDocType.confidence)}40` }}>
                      {detectedDocType.docTypeLabel}
                    </span>
                    <span className="doc-confidence">
                      Confiance : <strong style={{ color: getConfidenceColor(detectedDocType.confidence) }}>{detectedDocType.confidence}%</strong>
                      <span className="confidence-label"> ({getConfidenceLabel(detectedDocType.confidence)})</span>
                    </span>
                  </div>
                </div>
              )}

              {pdfFile && (
                <div className="pdf-indicator" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✅ PDF analysé: {pdfFile.name}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-view-pdf"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? '🔽 Masquer' : '👁️ Aperçu'}
                    </button>
                    <button 
                      className="btn-view-pdf"
                      onClick={() => {
                        if (pdfPreviewUrl) {
                          window.open(pdfPreviewUrl, '_blank');
                        } else {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            const blob = new Blob([e.target.result], { type: 'application/pdf' });
                            window.open(URL.createObjectURL(blob), '_blank');
                          };
                          reader.readAsArrayBuffer(pdfFile);
                        }
                      }}
                    >
                      🔗 Ouvrir
                    </button>
                  </div>
                </div>
              )}

              {/* Aperçu PDF inline */}
              {showPreview && pdfPreviewUrl && (
                <div className="pdf-preview-container">
                  <iframe
                    src={pdfPreviewUrl}
                    title="Aperçu PDF"
                    className="pdf-preview-iframe"
                  />
                </div>
              )}
              
              {/* Afficher le BL existant */}
              {!pdfFile && existingAffaires.length > 0 && existingAffaires[0].pdfData && (
                <div className="pdf-indicator" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📄 BL principal: {existingAffaires[0].pdfFileName}</span>
                  <button 
                    className="btn-view-pdf"
                    onClick={() => {
                      const pdfData = existingAffaires[0].pdfData;
                      const byteCharacters = atob(pdfData.split(',')[1]);
                      const byteNumbers = new Array(byteCharacters.length);
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      const byteArray = new Uint8Array(byteNumbers);
                      const blob = new Blob([byteArray], { type: 'application/pdf' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }}
                  >
                    👁️ Voir le PDF
                  </button>
                </div>
              )}

              {/* Afficher les BL additionnels */}
              {additionalBLs.length > 0 && (
                <div className="additional-bls-list">
                  <h4>BL additionnels ({additionalBLs.length})</h4>
                  {additionalBLs.map((bl, index) => (
                    <div key={index} className="pdf-indicator" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span>📎 {bl.fileName}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-view-pdf"
                          onClick={() => {
                            const byteCharacters = atob(bl.data.split(',')[1]);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: 'application/pdf' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }}
                        >
                          👁️ Voir
                        </button>
                        <button 
                          className="btn-delete-pdf"
                          onClick={() => {
                            setAdditionalBLs(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="form-group">
                <label>Numéro d'affaire *</label>
                <input
                  type="text"
                  value={formData.numeroAffaire}
                  onChange={(e) => setFormData(prev => ({ ...prev, numeroAffaire: e.target.value }))}
                  placeholder="AF32742"
                />
              </div>

              <div className="form-group">
                <label>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="Prestation">Prestation</option>
                  <option value="Location">Location</option>
                  <option value="Installation">Installation</option>
                </select>
              </div>

              <div className="form-group">
                <label>Client</label>
                <input
                  type="text"
                  value={formData.client}
                  onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                  placeholder="VILLE DU CHAMBON FEUGEROLLES"
                />
              </div>

              <div className="form-group">
                <label>Interlocuteur</label>
                <input
                  type="text"
                  value={formData.interlocuteur}
                  onChange={(e) => setFormData(prev => ({ ...prev, interlocuteur: e.target.value }))}
                  placeholder="Monsieur Guillaume RIBOUAT"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Téléphone</label>
                  <PhoneInput
                    value={formData.tel}
                    onChange={(val) => setFormData(prev => ({ ...prev, tel: val }))}
                  />
                </div>

                <div className="form-group">
                  <label>Fax</label>
                  <PhoneInput
                    value={formData.fax}
                    onChange={(val) => setFormData(prev => ({ ...prev, fax: val }))}
                    placeholder="01 23 45 67 89"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date de l'affaire *</label>
                  <input
                    type="date"
                    value={formData.dateDebut}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateDebut: e.target.value }))}
                  />
                  <small style={{ color: 'var(--theme-text-gray)', fontSize: '12px' }}>
                    Date de la prestation (doit être dans la période de l'événement)
                  </small>
                </div>

                <div className="form-group">
                  <label>Devis</label>
                  <input
                    type="text"
                    value={formData.devis}
                    onChange={(e) => setFormData(prev => ({ ...prev, devis: e.target.value }))}
                    placeholder="1001 du 20/01/2026"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Adresse de livraison</label>
                <AddressAutocomplete
                  as="textarea"
                  value={formData.adresseLivraison}
                  onChange={(val) => setFormData(prev => ({ ...prev, adresseLivraison: val }))}
                  placeholder="Adresse complète de livraison"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Titre de l'événement</label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData(prev => ({ ...prev, titre: e.target.value }))}
                  placeholder="Titre qui apparaîtra dans le calendrier"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Notes ou informations complémentaires"
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button className="btn-submit" onClick={handleSubmit}>
                  Valider l'import
                </button>
              </div>
            </div>
          )}

          {/* Étape 4: Upload BL additionnel */}
          {step === 'upload-additional' && !isProcessing && (
            <div className="upload-additional-step">
              <p style={{ marginBottom: '20px', color: 'var(--theme-text-secondary)' }}>
                Ajoutez des BL supplémentaires sans analyse automatique
              </p>
              <div 
                className="drop-zone"
                onClick={() => additionalFileInputRef.current?.click()}
              >
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">📎</div>
                  <p className="drop-zone-text">
                    Cliquez pour sélectionner un PDF
                  </p>
                </div>
                <input
                  ref={additionalFileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    files.forEach(file => handleAdditionalBLUpload(file));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(AffaireImportModal);
