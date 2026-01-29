import { useState, useRef, useEffect } from 'react';
import './AffaireImportModal.css';
import { extractTextFromPDF, parseBonLivraison, parseDate } from '../utils/pdfParser';
import { addToIndexedDB, updateInIndexedDB, loadFromIndexedDB, STORES } from '../utils/indexedDB';

const AffaireImportModal = ({ 
  isOpen, 
  onClose, 
  event,
  onEventCreated,
  onEventUpdated,
  onRequestEditReservation
}) => {
  const [step, setStep] = useState('choice'); // 'choice', 'upload', 'form', 'edit-event', 'upload-additional'
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
  
  const fileInputRef = useRef(null);
  const additionalFileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

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
      console.log('🔄 Modal ouvert pour event:', event.id, event.summary);
      console.log('📅 Event complet:', event);
      
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
      
      console.log('📝 Formulaire initialisé avec:', initialFormData.titre, '- N° affaire:', initialFormData.numeroAffaire);
      
      setFormData(initialFormData);
      setInitialFormData(initialFormData); // Sauvegarder pour comparaison
      setHasChanges(false); // Reset des changements
      
      // Log immédiat après setFormData
      setTimeout(() => {
        console.log('🔍 State formData après setFormData:', formData.client, formData.titre);
      }, 100);
      
      setEventFormData({
        titre: event.summary || '',
        description: event.extendedProps?.description || event.description || '',
        dateDebut: getDateString(event.start),
        dateFin: getDateString(event.end)
      });
      setStep('choice');
      setPdfFile(null);
      
      // Charger les affaires de CET événement spécifique
      const loadAffaires = async () => {
        try {
          const allAffaires = await loadFromIndexedDB(STORES.affaires, []);
          console.log('📦 Toutes les affaires:', allAffaires.map(a => ({ id: a.eventId, client: a.client })));
          
          const affaires = allAffaires.filter(a => a.eventId === event.id);
          console.log('🎯 Affaires pour cet event:', affaires);
          
          setExistingAffaires(affaires);
          
          // Si une affaire existe, pré-remplir le formulaire
          if (affaires.length > 0) {
            const affaire = affaires[0];
            console.log('✏️ Pré-remplissage avec affaire:', affaire.client);
            
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
            console.log('ℹ️ Aucune affaire, utilisation des données Google Calendar');
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
      alert('Veuillez sélectionner un fichier PDF');
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
      alert('Erreur lors de l\'upload du BL');
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
      alert('Veuillez sélectionner un fichier PDF');
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

  const processPDF = async (file) => {
    setIsProcessing(true);
    setPdfFile(file);

    try {
      console.log('🚀 Démarrage du traitement PDF:', file.name);
      
      // Extraire le texte du PDF
      const text = await extractTextFromPDF(file);
      console.log('📝 Texte extrait:', text.substring(0, 200) + '...');
      
      // Parser les informations
      const info = parseBonLivraison(text);
      console.log('📊 Informations parsées:', info);
      
      // Préremplir le formulaire
      setFormData(prev => ({
        ...prev,
        numeroAffaire: info.numeroAffaire || prev.numeroAffaire,
        type: info.type || prev.type,
        client: info.client || prev.client,
        interlocuteur: info.interlocuteur || prev.interlocuteur,
        tel: info.tel || prev.tel,
        fax: info.fax || prev.fax,
        dateDebut: info.dateLocation || prev.dateDebut,
        devis: info.devis || prev.devis,
        adresseLivraison: info.adresseLivraison || prev.adresseLivraison,
        titre: prev.titre || info.nomAffaire || '',
        description: prev.description || `${info.client || ''} - ${info.nomAffaire || ''}`
      }));

      console.log('✅ Formulaire prérempli avec succès');
      setStep('form');
    } catch (error) {
      console.error('❌ Erreur traitement PDF:', error);
      alert(`Erreur lors de l'analyse du PDF: ${error.message}\n\nVeuillez remplir le formulaire manuellement.`);
      setStep('form');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReplace = async () => {
    if (replaceConfirm) {
      await processPDF(replaceConfirm.file);
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
      alert('Veuillez renseigner au moins le numéro d\'affaire et le client');
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

      // Créer ou mettre à jour l'affaire dans IndexedDB uniquement
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

      // Vérifier si l'affaire existe déjà
      const existing = existingAffaires.find(a => a.numeroAffaire === formData.numeroAffaire);
      
      if (existing) {
        affaire.id = existing.id;
        await updateInIndexedDB(STORES.affaires, affaire);
      } else {
        await addToIndexedDB(STORES.affaires, affaire);
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de l\'affaire');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateWithoutPDF = () => {
    setStep('form');
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
  };

  if (!isOpen) return null;

  return (
    <div className="affaire-modal-overlay" onClick={onClose}>
      <div className="affaire-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="affaire-modal-header">
          <h2>
            {workflow === 'new' && 'Nouvel événement'}
            {workflow === 'import-or-create' && `${event?.title || 'Événement'}`}
            {workflow === 'update' && `Mettre à jour l'affaire`}
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
                    📄 Créer un événement en important un BL
                  </button>
                  <button 
                    className="choice-button"
                    onClick={handleCreateWithoutPDF}
                  >
                    ➕ Créer un événement sans BL
                  </button>
                </>
              )}
              
              {workflow === 'import-or-create' && (
                <>
                  <button 
                    className="choice-button"
                    onClick={() => setStep('form')}
                  >
                    ✏️ Modifier
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
                    📎 Ajouter un BL
                  </button>
                  <button 
                    className="choice-button"
                    onClick={handleCreateWithoutPDF}
                  >
                    ➕ Créer des réservations{` pour "${existingAffaires.length > 0 ? (existingAffaires[0].client || event?.summary) : event?.summary}"`}
                  </button>
                </>
              )}
              
              {workflow === 'update' && (
                <button 
                  className="choice-button"
                  onClick={() => setStep('upload')}
                >
                  📄 Mettre à jour l'affaire en important un BL
                </button>
              )}
            </div>
          )}

          {/* Étape 2: Upload du PDF */}
          {step === 'upload' && !isProcessing && (
            <div 
              ref={dropZoneRef}
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="drop-zone-content">
                <div className="drop-zone-icon">📁</div>
                <p className="drop-zone-text">
                  Glissez-déposez un fichier PDF ici
                </p>
                <p className="drop-zone-or">ou</p>
                <button 
                  className="browse-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Parcourir les fichiers
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                />
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <p>Analyse du PDF en cours...</p>
            </div>
          )}

          {/* Confirmation de remplacement */}
          {replaceConfirm && (
            <div className="replace-confirm">
              <p className="warning-text">
                ⚠️ Un BL avec le même nom existe déjà pour cet événement.
              </p>
              <p>Voulez-vous le remplacer ?</p>
              <div className="button-group">
                <button className="btn-cancel" onClick={handleCancelReplace}>
                  Annuler
                </button>
                <button className="btn-confirm" onClick={handleConfirmReplace}>
                  Remplacer
                </button>
              </div>
            </div>
          )}

          {/* Étape 3: Formulaire */}
          {step === 'form' && !isProcessing && (
            <div className="form-step">
              {/* Informations de l'événement Google */}
              {event && (
                <div className="event-info" style={{
                  background: '#f0f9ff',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  fontSize: '14px',
                  border: '1px solid #bfdbfe'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e40af' }}>
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
              
              {pdfFile && (
                <div className="pdf-indicator" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✅ PDF analysé: {pdfFile.name}</span>
                  <button 
                    className="btn-view-pdf"
                    onClick={() => {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const blob = new Blob([e.target.result], { type: 'application/pdf' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      };
                      reader.readAsArrayBuffer(pdfFile);
                    }}
                  >
                    👁️ Voir le PDF
                  </button>
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
                  <input
                    type="tel"
                    value={formData.tel}
                    onChange={(e) => setFormData(prev => ({ ...prev, tel: e.target.value }))}
                    placeholder="01 23 45 67 89"
                  />
                </div>

                <div className="form-group">
                  <label>Fax</label>
                  <input
                    type="tel"
                    value={formData.fax}
                    onChange={(e) => setFormData(prev => ({ ...prev, fax: e.target.value }))}
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
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
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
                <textarea
                  value={formData.adresseLivraison}
                  onChange={(e) => setFormData(prev => ({ ...prev, adresseLivraison: e.target.value }))}
                  placeholder="Adresse complète de livraison"
                  rows="3"
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
                {hasChanges && (
                  <button className="btn-submit" onClick={handleSubmit}>
                    Valider les modifications
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Étape 4: Upload BL additionnel */}
          {step === 'upload-additional' && !isProcessing && (
            <div className="upload-additional-step">
              <p style={{ marginBottom: '20px', color: '#64748b' }}>
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

export default AffaireImportModal;
