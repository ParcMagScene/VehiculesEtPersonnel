import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, CheckCircle, AlertTriangle, FileText, Loader, X, User, Calendar, Gauge } from 'lucide-react';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { getPeriodTimestamp } from '../utils/dateUtils';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import './MaintenanceDialog.css';

function MaintenanceDialog({ vehicle, onClose, maintenances = [], onSave, garages = [], reservations = [], maintenanceToEdit = null, actionType = null, currentUser = null }) {
  // Trouver la maintenance à éditer dès le départ
  const maintenanceToEditData = maintenanceToEdit ? maintenances.find(m => m.id === maintenanceToEdit) : null;
  
  // Vérifier les droits - admin ou utilisateur avec permission maintenance
  const isAdmin = currentUser?.isAdmin === true;
  const canManageMaintenance = isAdmin || currentUser?.permissions?.can_manage_maintenance === true;
  // Mode consultation : utilisateur sans droit maintenance qui ouvre une intervention existante
  const isViewMode = !canManageMaintenance && !!maintenanceToEditData;
  const canSchedule = canManageMaintenance;
  const canOnlyReport = !canManageMaintenance && !isViewMode;
  
  // Déterminer le statut et le mode initial en fonction de actionType ET des droits
  const getInitialStatus = () => {
    // En mode consultation, garder le statut d'origine
    if (isViewMode) return maintenanceToEditData.status;
    // Si l'utilisateur n'est pas admin, forcer le statut 'reported'
    if (canOnlyReport) return 'reported';
    
    if (maintenanceToEditData) return maintenanceToEditData.status;
    if (actionType === 'schedule') return 'scheduled';
    if (actionType === 'request') return 'pending';
    if (actionType === 'breakdown') return 'reported';
    return '';
  };
  
  const getInitialQuickReport = () => {
    // En mode consultation, garder la valeur d'origine
    if (isViewMode) return maintenanceToEditData.isQuickReport || false;
    // Si l'utilisateur n'est pas admin, toujours en mode signalement rapide
    if (canOnlyReport) return true;
    
    if (maintenanceToEditData) return maintenanceToEditData.isQuickReport || false;
    return actionType === 'breakdown' || actionType === 'request';
  };
  
  const [activeTab, setActiveTab] = useState('new'); // 'new' ou 'history'
  const [mileageHistory, setMileageHistory] = useState([]);

  // Charger l'historique des relevés kilométriques
  useEffect(() => {
    if (vehicle?.id) {
      api.getHistory('vehicle', vehicle.id).then(history => {
        const kmEntries = (history || []).filter(h => h.action === 'mileage_update').map(h => {
          let parsed = {};
          try { parsed = typeof h.changes === 'string' ? JSON.parse(h.changes) : (h.changes || {}); } catch(e) {}
          return { ...h, parsed };
        });
        setMileageHistory(kmEntries);
      }).catch(() => {});
    }
  }, [vehicle?.id]);
  const [isQuickReport, setIsQuickReport] = useState(getInitialQuickReport());
  const [editingId, setEditingId] = useState(maintenanceToEditData?.id || null);
  const [conflictWarning, setConflictWarning] = useState(null); // Avertissement de conflit
  const [initialFormData, setInitialFormData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Fermeture sécurisée avec avertissement si modifications
  const handleSafeClose = () => {
    if (isViewMode) { onClose(); return; }
    if (hasChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    // En création, vérifier si des champs ont été remplis
    if (!editingId && (formData.description || formData.garage || formData.cost)) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };
  const [statusReason, setStatusReason] = useState(''); // Motif pour pending/cancelled/rescheduled
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const [showCancelForm, setShowCancelForm] = useState(false);
  const startDateInputRef = useRef(null);
  const [formData, setFormData] = useState(
    maintenanceToEditData ? {
      type: maintenanceToEditData.type,
      startDate: maintenanceToEditData.startDate || maintenanceToEditData.date || '',
      startDatePeriod: maintenanceToEditData.startDatePeriod || 'AM',
      endDate: maintenanceToEditData.endDate || maintenanceToEditData.date || '',
      endDatePeriod: maintenanceToEditData.endDatePeriod || 'PM',
      description: maintenanceToEditData.description,
      garageId: maintenanceToEditData.garageId || '',
      cost: maintenanceToEditData.cost || '',
      mileage: maintenanceToEditData.mileage || '',
      status: maintenanceToEditData.status,
      notes: maintenanceToEditData.notes || '',
      isImmobilized: maintenanceToEditData.isImmobilized || false,
      isQuickReport: maintenanceToEditData.isQuickReport || false,
      technicalControlType: maintenanceToEditData.technicalControlType || ''
    } : {
      type: actionType === 'breakdown' ? 'breakdown' : 'revision',
      startDate: '',
      startDatePeriod: 'AM',
      endDate: '',
      endDatePeriod: 'PM',
      description: '',
      garageId: '',
      cost: '',
      mileage: '',
      status: getInitialStatus(),
      notes: '',
      isImmobilized: actionType === 'breakdown',
      isQuickReport: getInitialQuickReport(),
      technicalControlType: ''
    }
  );

  // Filtrer les maintenances pour ce véhicule
  const vehicleMaintenances = maintenances.filter(m => m.vehicleId === vehicle.id);

  // Types de contrôles techniques disponibles
  const allControleTechniqueTypes = [
    { value: 'VL', label: 'VL (Véhicule Léger)', vehicleTypes: ['VL', 'VOITURE', 'CAMIONNETTE'], periodicity: '4 ans après 1ère mise en circulation, puis tous les 2 ans' },
    { value: 'PL', label: 'PL (Poids Lourd)', vehicleTypes: ['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR', 'SEMI', 'SEMI-REMORQUE'], periodicity: 'Tous les ans (1ère visite dans les 6 mois suivant la mise en circulation)' },
    { value: 'SEMI', label: 'Semi-remorque', vehicleTypes: ['SEMI', 'SEMI-REMORQUE'], periodicity: 'Tous les ans' },
    { value: 'SCENE', label: 'Scène mobile', vehicleTypes: ['SCENE', 'SCÈNE', 'REMORQUE'], periodicity: 'Tous les ans (remorque > 500 kg PTAC)' },
    { value: 'POLLUTION', label: 'Pollution', vehicleTypes: ['ALL_MOTORIZED'], periodicity: 'Tous les ans (inclus dans le CT pour les VL, séparé pour les PL)' },
    { value: 'HAYON', label: 'Hayon (contrôle VGP)', vehicleTypes: ['ALL'], periodicity: 'Tous les 6 mois (Vérification Générale Périodique)' },
    { value: 'TACHYGRAPHE', label: '📡 Tachygraphe', vehicleTypes: ['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR', 'SEMI', 'SEMI-REMORQUE'], periodicity: 'Tous les 2 ans — vérification complète, étalonnage, scellés (~1h30, ~200 €)' },
    { value: 'LIMITEUR', label: '🚧 Limiteur de vitesse', vehicleTypes: ['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR', 'SEMI', 'SEMI-REMORQUE'], periodicity: 'Tous les ans — contrôle en centre agréé (~15 min, ~70 €)' }
  ];

  // Filtrer les types de contrôles selon le type de véhicule
  const getAvailableControlTypes = () => {
    if (!vehicle?.type) return allControleTechniqueTypes;
    
    const vehicleType = vehicle.type.toUpperCase();
    
    // Déterminer si c'est un véhicule motorisé
    const isMotorized = !['SCENE', 'SCÈNE', 'REMORQUE'].some(t => vehicleType.includes(t));
    
    // Déterminer le type principal du véhicule
    const isVL = ['VL', 'VOITURE', 'CAMIONNETTE'].some(t => vehicleType.includes(t));
    const isPL = ['PL', 'CAMION', 'PORTEUR', 'TRACTEUR'].some(t => vehicleType.includes(t));
    const isSemi = ['SEMI'].some(t => vehicleType.includes(t));
    
    return allControleTechniqueTypes.filter(ct => {
      // Hayon disponible pour TOUS les véhicules
      if (ct.value === 'HAYON') return true;
      
      // Pollution disponible pour tous les véhicules motorisés
      if (ct.value === 'POLLUTION') return isMotorized;
      
      // Tachygraphe et Limiteur de vitesse pour PL et semi-remorques
      if (ct.value === 'TACHYGRAPHE' || ct.value === 'LIMITEUR') return isPL || isSemi;
      
      // VL pour les véhicules légers
      if (ct.value === 'VL') return isVL;
      
      // PL pour poids lourds et semi-remorques
      if (ct.value === 'PL') return isPL || isSemi;
      
      // SEMI pour semi-remorques
      if (ct.value === 'SEMI') return isSemi;
      
      // SCENE pour remorques non motorisées
      if (ct.value === 'SCENE') {
        return ['SCENE', 'SCÈNE', 'REMORQUE'].some(t => vehicleType.includes(t));
      }
      
      return false;
    });
  };

  // Sauvegarder les données initiales lors de l'édition
  useEffect(() => {
    if (maintenanceToEditData) {
      const initial = {
        type: maintenanceToEditData.type,
        startDate: maintenanceToEditData.startDate || maintenanceToEditData.date || '',
        endDate: maintenanceToEditData.endDate || maintenanceToEditData.date || '',
        description: maintenanceToEditData.description,
        garageId: maintenanceToEditData.garageId || '',
        cost: maintenanceToEditData.cost || '',
        mileage: maintenanceToEditData.mileage || '',
        status: maintenanceToEditData.status,
        notes: maintenanceToEditData.notes || '',
        isImmobilized: maintenanceToEditData.isImmobilized || false,
        isQuickReport: maintenanceToEditData.isQuickReport || false,
        technicalControlType: maintenanceToEditData.technicalControlType || ''
      };
      setInitialFormData(initial);
      setFormData(initial); // Mettre à jour formData
      setEditingId(maintenanceToEditData.id);
      setIsQuickReport(maintenanceToEditData.isQuickReport || false);
    }
  }, [maintenanceToEditData?.id]); // Se déclenche seulement quand l'ID change

  // Détecter les changements
  useEffect(() => {
    if (!initialFormData || !editingId) {
      setHasChanges(false);
      return;
    }
    
    const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    setHasChanges(hasChanged);
  }, [formData, initialFormData, editingId]);

  const startEditing = (maintenance) => {
    setEditingId(maintenance.id);
    setIsQuickReport(maintenance.isQuickReport || false);
    setFormData({
      type: maintenance.type,
      startDate: maintenance.startDate || maintenance.date || '',
      endDate: maintenance.endDate || maintenance.date || '',
      description: maintenance.description,
      garageId: maintenance.garageId || '',
      cost: maintenance.cost || '',
      mileage: maintenance.mileage || '',
      status: maintenance.status,
      notes: maintenance.notes || '',
      isImmobilized: maintenance.isImmobilized || false,
      isQuickReport: maintenance.isQuickReport || false,
      technicalControlType: maintenance.technicalControlType || ''
    });
    setActiveTab('new');
  };

  const checkMaintenanceConflicts = () => {
    // Ne vérifier que pour les interventions programmées
    if (isQuickReport || !formData.startDate || !formData.endDate) {
      return [];
    }

    const newStart = getPeriodTimestamp(formData.startDate, formData.startDatePeriod || 'AM');
    const newEnd = getPeriodTimestamp(formData.endDate, formData.endDatePeriod || 'PM');
    
    const conflicts = [];
    
    // Vérifier les conflits avec les réservations
    for (const r of reservations) {
      // Vérifier uniquement les réservations du même véhicule
      if (String(r.vehicleId) !== String(vehicle.id)) continue;
      
      // Calculer les timestamps de la réservation existante
      const existingStart = getPeriodTimestamp(r.date, r.period);
      const existingEnd = getPeriodTimestamp(
        r.endDate || r.date,
        r.endPeriod || r.period
      );
      
      // Vérifier si les intervalles se chevauchent
      if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
        conflicts.push(r);
      }
    }
    
    // Vérifier les conflits avec les autres maintenances programmées
    for (const m of vehicleMaintenances) {
      // Ignorer la maintenance en cours d'édition
      if (editingId && m.id === editingId) continue;
      
      // Vérifier uniquement les maintenances programmées avec des dates
      if (m.status !== 'scheduled' || !m.startDate || !m.endDate) continue;
      
      const existingStart = getPeriodTimestamp(m.startDate, m.startDatePeriod || 'AM');
      const existingEnd = getPeriodTimestamp(m.endDate, m.endDatePeriod || 'PM');
      
      // Vérifier si les intervalles se chevauchent
      if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
        conflicts.push({
          ...m,
          isMaintenance: true
        });
      }
    }
    
    return conflicts;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // RESTRICTION : Les non-admins ne peuvent créer que des signalements
    if (canOnlyReport && formData.status !== 'reported') {
      alert('❌ Accès refusé\n\nVous ne pouvez que signaler des pannes.\nPour programmer une intervention, contactez un administrateur.');
      return;
    }
    
    // Vérifier les conflits pour les interventions programmées
    if (!isQuickReport && !conflictWarning) {
      const conflicts = checkMaintenanceConflicts();
      if (conflicts.length > 0) {
        setConflictWarning(conflicts);
        return;
      }
    }
    
    const maintenance = {
      id: editingId || Date.now(),
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      ...formData,
      // Ajouter le motif de changement de statut aux notes si renseigné
      notes: statusReason 
        ? (formData.notes ? formData.notes + '\n\n' : '') + 
          `[${getStatusLabel(formData.status)}] ${statusReason}`
        : formData.notes,
      createdAt: editingId ? maintenances.find(m => m.id === editingId)?.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(maintenance);
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusLabel = (status) => {
    const labels = {
      scheduled: 'Programmée',
      in_progress: 'En cours',
      IN_PROGRESS: 'En cours',
      completed: 'Effectuée',
      COMPLETED: 'Effectuée',
      reported: 'Signalée',
      pending: 'En attente',
      PENDING: 'En attente',
      cancelled: 'Annulée',
      rescheduled: 'Reportée'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status) => {
    const icons = {
      scheduled: <Clock size={14} />,
      in_progress: <Loader size={14} />,
      IN_PROGRESS: <Loader size={14} />,
      completed: <CheckCircle size={14} />,
      COMPLETED: <CheckCircle size={14} />,
      reported: <AlertTriangle size={14} />,
      pending: <FileText size={14} />,
      PENDING: <FileText size={14} />,
      cancelled: <X size={14} />,
      rescheduled: <Calendar size={14} />
    };
    return icons[status] || null;
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: '#3b82f6',
      in_progress: '#f59e0b',
      IN_PROGRESS: '#f59e0b',
      completed: '#10b981',
      COMPLETED: '#10b981',
      reported: '#ef4444',
      pending: '#8b5cf6',
      PENDING: '#8b5cf6',
      rescheduled: '#f97316',
      cancelled: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getTypeLabel = (type) => {
    const labels = {
      revision: 'Révision',
      technical_inspection: 'Contrôle technique',
      internal: 'Intervention interne',
      external: 'Intervention externe',
      breakdown: 'Panne',
      other: 'Panne',
      maintenance: 'Maintenance',
      repair: 'Réparation'
    };
    return labels[type] || type;
  };

  const updateMaintenanceStatus = (maintenanceId, newStatus) => {
    const maintenance = maintenances.find(m => m.id === maintenanceId);
    if (maintenance) {
      const updated = { ...maintenance, status: newStatus };
      onSave(updated);
    }
  };

  const deleteMaintenance = (maintenanceId) => {
    setConfirmDialog({
      message: 'Attention, si vous supprimez cette intervention, elle n\'apparaîtra plus dans l\'historique du véhicule. Cette action est irréversible.\n\nSupprimer quand même ?',
      onConfirm: () => {
        setConfirmDialog(null);
        onSave({ id: maintenanceId, _deleted: true });
      }
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setIsQuickReport(getInitialQuickReport());
    setFormData({
      type: actionType === 'breakdown' ? 'breakdown' : 'revision',
      startDate: '',
      endDate: '',
      description: '',
      garageId: '',
      cost: '',
      mileage: '',
      status: getInitialStatus(),
      notes: '',
      isImmobilized: actionType === 'breakdown',
      isQuickReport: getInitialQuickReport()
    });
  };

  const getDialogTitle = () => {
    if (isViewMode) return '📋 Détails de l\'intervention';
    if (editingId) return '🔧 Modifier l\'intervention';
    if (actionType === 'schedule') return '📅 Programmer une intervention';
    if (actionType === 'request') return '📝 Demander une intervention';
    if (actionType === 'breakdown') return '⚠️ Signaler une panne';
    return '🔧 Entretien';
  };

  return (
    <div className="maintenance-dialog-overlay" onClick={handleSafeClose}>
      <div className="maintenance-dialog" onClick={(e) => e.stopPropagation()}>
        <div 
          className="maintenance-dialog-header"
          style={editingId ? {
            borderBottom: `3px solid ${getStatusColor(formData.status)}`,
            background: `linear-gradient(135deg, ${getStatusColor(formData.status)}08 0%, ${getStatusColor(formData.status)}15 100%)`
          } : {}}
        >
          <div className="maintenance-dialog-title">
            <h2>{getDialogTitle()} - {vehicle.name}</h2>
            <div className="vehicle-info">
              <span className="vehicle-type">{vehicle.type}</span>
              {vehicle.registration && <span className="vehicle-registration">{vehicle.registration}</span>}
            </div>
          </div>
          <button className="close-button" onClick={handleSafeClose}>✕</button>
        </div>

        <div className="maintenance-tabs">
          <button 
            className={`tab-button ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            {editingId ? (
              isViewMode ? '📋 Détails' :
              maintenanceToEditData?.status === 'pending' ? '📝 Demande d\'intervention' :
              maintenanceToEditData?.status === 'reported' ? '⚠️ Panne signalée' :
              maintenanceToEditData?.status === 'scheduled' ? '📅 Intervention programmée' :
              '✏️ Modifier l\'intervention'
            ) : '➕ Nouvelle intervention'}
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📋 Historique véhicule ({vehicleMaintenances.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'km-history' ? 'active' : ''}`}
            onClick={() => setActiveTab('km-history')}
          >
            🔢 Relevés km ({mileageHistory.length})
          </button>
        </div>

        <div className="maintenance-dialog-content">
          {activeTab === 'new' ? (
            <form id="maintenance-form" onSubmit={handleSubmit} className="maintenance-form">
            <fieldset disabled={isViewMode} style={{ border: 'none', margin: 0, padding: 0 }}>
              {/* Détails de l'intervention en mode édition */}
              {editingId && maintenanceToEditData && (
                <div className="intervention-details-card">
                  <div className="intervention-details-header">
                    <span 
                      className="intervention-status-badge"
                      style={{ 
                        backgroundColor: getStatusColor(formData.status) + '15',
                        color: getStatusColor(formData.status),
                        borderColor: getStatusColor(formData.status)
                      }}
                    >
                      {getStatusIcon(formData.status)}
                      {getStatusLabel(formData.status)}
                    </span>
                    {formData.status !== maintenanceToEditData.status && (
                      <span className="status-changed-indicator">
                        ← {getStatusLabel(maintenanceToEditData.status)}
                      </span>
                    )}
                    <span className="intervention-type-label">
                      {getTypeLabel(formData.type || maintenanceToEditData.type)}
                      {(formData.technicalControlType || maintenanceToEditData.technicalControlType) && (
                        <span className="ct-type"> — {formData.technicalControlType || maintenanceToEditData.technicalControlType}</span>
                      )}
                    </span>
                  </div>
                  {maintenanceToEditData.description && (
                    <div className="intervention-details-title">
                      {maintenanceToEditData.description}
                    </div>
                  )}
                  <div className="intervention-details-grid">
                    <div className="intervention-detail-item">
                      <User size={14} />
                      <span className="detail-key">Créée par</span>
                      <span className="detail-val">{maintenanceToEditData.creatorName || 'Inconnu'}</span>
                    </div>
                    <div className="intervention-detail-item">
                      <Calendar size={14} />
                      <span className="detail-key">Créée le</span>
                      <span className="detail-val">
                        {maintenanceToEditData.createdAt 
                          ? format(parseISO(maintenanceToEditData.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })
                          : '—'}
                      </span>
                    </div>
                    {maintenanceToEditData.startDate && (
                      <div className="intervention-detail-item">
                        <Clock size={14} />
                        <span className="detail-key">Début</span>
                        <span className="detail-val">
                          {format(parseISO(maintenanceToEditData.startDate), 'dd MMMM yyyy', { locale: fr })}
                          {' '}<span className="period-tag">{maintenanceToEditData.startDatePeriod === 'PM' ? 'Après-midi' : 'Matin'}</span>
                        </span>
                      </div>
                    )}
                    {maintenanceToEditData.endDate && (
                      <div className="intervention-detail-item">
                        <Clock size={14} />
                        <span className="detail-key">Fin</span>
                        <span className="detail-val">
                          {format(parseISO(maintenanceToEditData.endDate), 'dd MMMM yyyy', { locale: fr })}
                          {' '}<span className="period-tag">{maintenanceToEditData.endDatePeriod === 'PM' ? 'Après-midi' : 'Matin'}</span>
                        </span>
                      </div>
                    )}
                    {maintenanceToEditData.isImmobilized && (
                      <div className="intervention-detail-item immobilized-alert">
                        <AlertTriangle size={14} />
                        <span className="detail-val">🚫 Véhicule immobilisé</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Mode de saisie - masquer si actionType est défini ou si on édite une intervention */}
              {!actionType && !(editingId && (maintenanceToEditData?.status === 'pending' || maintenanceToEditData?.status === 'reported' || maintenanceToEditData?.status === 'scheduled')) && 
               !formData.status && (
                <div className="form-mode-selector">
                  {/* Pour nouvelle intervention : afficher les choix selon les droits */}
                  {!editingId && (
                    <>
                      {canSchedule && (
                        <>
                          <label className="mode-option">
                            <input
                              type="radio"
                              checked={!isQuickReport && formData.status === 'scheduled'}
                              onChange={() => {
                                setIsQuickReport(false);
                                handleChange('isQuickReport', false);
                                handleChange('status', 'scheduled');
                              }}
                            />
                            <span>📅 Programmer une intervention</span>
                          </label>
                          <label className="mode-option">
                            <input
                              type="radio"
                              checked={!isQuickReport && formData.status === 'pending'}
                              onChange={() => {
                                setIsQuickReport(false);
                                handleChange('isQuickReport', false);
                                handleChange('status', 'pending');
                                handleChange('startDate', '');
                                handleChange('endDate', '');
                              }}
                            />
                            <span>📝 Demander une intervention</span>
                          </label>
                        </>
                      )}
                      <label className="mode-option">
                        <input
                          type="radio"
                          checked={isQuickReport}
                          onChange={() => {
                            setIsQuickReport(true);
                            handleChange('isQuickReport', true);
                            handleChange('status', 'reported');
                            handleChange('startDate', '');
                            handleChange('endDate', '');
                          }}
                        />
                        <span>⚠️ Signaler une panne</span>
                      </label>
                      {canOnlyReport && (
                        <p className="info-message">
                          ℹ️ Vous ne pouvez que signaler des pannes. Pour programmer une intervention, contactez un administrateur.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Case véhicule immobilisé (visible uniquement en mode signalement de panne) */}
              {isQuickReport && (
                <div className="immobilized-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isImmobilized}
                      onChange={(e) => handleChange('isImmobilized', e.target.checked)}
                    />
                    <span className="immobilized-label">
                      🚫 Véhicule immobilisé (ne peut plus rouler)
                    </span>
                  </label>
                </div>
              )}

              <div className="form-row">
                {(formData.status === 'scheduled' || formData.status === 'in_progress' || formData.status === 'completed' || formData.status === 'rescheduled') && (
                  <>
                    <div className="form-group">
                      <label>Type d'intervention *</label>
                      <select
                        value={formData.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                        required
                      >
                        <option value="revision">Révision</option>
                        <option value="technical_inspection">Contrôle technique</option>
                        <option value="internal">Intervention interne</option>
                        <option value="external">Intervention externe</option>
                      </select>
                    </div>

                    {/* Sélecteur de type de contrôle technique */}
                    {formData.type === 'technical_inspection' && (
                      <div className="form-group">
                        <label>Type de contrôle technique *</label>
                        <select
                          value={formData.technicalControlType}
                          onChange={(e) => handleChange('technicalControlType', e.target.value)}
                          required
                        >
                          <option value="">Sélectionner...</option>
                          {getAvailableControlTypes().map(ct => (
                            <option key={ct.value} value={ct.value}>
                              {ct.label}
                            </option>
                          ))}
                        </select>
                        {formData.technicalControlType && (() => {
                          const selectedCT = allControleTechniqueTypes.find(ct => ct.value === formData.technicalControlType);
                          return selectedCT?.periodicity ? (
                            <div className="ct-periodicity-info">
                              <span className="ct-periodicity-icon">🔄</span>
                              <span className="ct-periodicity-text">
                                <strong>Périodicité :</strong> {selectedCT.periodicity}
                              </span>
                            </div>
                          ) : null;
                        })()}
                        {!formData.technicalControlType && (
                          <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            ℹ️ Sélectionnez un type pour voir sa périodicité
                          </small>
                        )}
                      </div>
                    )}
                  </>
                )}

                {formData.status === 'pending' && !isQuickReport && (
                  <div className="form-group full-width">
                    <label>Type d'intervention</label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleChange('type', e.target.value)}
                    >
                      <option value="">Non déterminé</option>
                      <option value="revision">Révision</option>
                      <option value="technical_inspection">Contrôle technique</option>
                      <option value="internal">Intervention interne</option>
                      <option value="external">Intervention externe</option>
                    </select>
                  </div>
                )}
              </div>

              {(formData.status === 'scheduled' || formData.status === 'in_progress' || formData.status === 'completed' || formData.status === 'rescheduled') && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date de début *</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          ref={startDateInputRef}
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => handleChange('startDate', e.target.value)}
                          required
                          style={{ flex: 1 }}
                        />
                        <select
                          value={formData.startDatePeriod}
                          onChange={(e) => handleChange('startDatePeriod', e.target.value)}
                          style={{ width: '80px' }}
                        >
                          <option value="AM">🌅 AM</option>
                          <option value="PM">🌆 PM</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Date de fin *</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => handleChange('endDate', e.target.value)}
                          min={formData.startDate}
                          required
                          style={{ flex: 1 }}
                        />
                        <select
                          value={formData.endDatePeriod}
                          onChange={(e) => handleChange('endDatePeriod', e.target.value)}
                          style={{ width: '80px' }}
                        >
                          <option value="AM">🌅 AM</option>
                          <option value="PM">🌆 PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Description *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Ex: Vidange + filtres"
                    required
                  />
                </div>
              </div>

              {formData.type === 'external' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Garage</label>
                    <select
                      value={formData.garageId}
                      onChange={(e) => handleChange('garageId', e.target.value)}
                    >
                      <option value="">Sélectionner un garage</option>
                      {garages.map(garage => (
                        <option key={garage.id} value={garage.id}>
                          {garage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Kilométrage</label>
                  <input
                    type="number"
                    value={formData.mileage}
                    onChange={(e) => handleChange('mileage', e.target.value)}
                    placeholder="Ex: 125000"
                  />
                </div>

                <div className="form-group">
                  <label>Coût (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => handleChange('cost', e.target.value)}
                    placeholder="Ex: 350.00"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={4}
                    placeholder="Remarques, pièces changées, prochaines échéances..."
                  />
                </div>
              </div>

              {/* Formulaire motif d'annulation (affiché au-dessus des boutons) */}
              {editingId && canManageMaintenance && showCancelForm && formData.status !== 'cancelled' && (
                <div className="status-reason-field" style={{ marginBottom: '12px' }}>
                  <label>❌ Motif d'annulation :</label>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    rows={2}
                    placeholder="Pourquoi annuler cette intervention ?"
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => {
                        setShowCancelForm(false);
                        setStatusReason('');
                      }}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => {
                        handleChange('status', 'cancelled');
                        setShowCancelForm(false);
                      }}
                    >
                      ❌ Confirmer l'annulation
                    </button>
                  </div>
                </div>
              )}

            </fieldset>
            </form>
          ) : activeTab === 'km-history' ? (
            <div className="maintenance-history">
              {/* En-tête avec immatriculation */}
              <div className="km-history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '10px 14px', background: '#f0f4f8', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gauge size={18} />
                  <strong>Historique des relevés kilométriques</strong>
                </div>
                {vehicle.registration && (
                  <span style={{ fontSize: '0.9em', color: '#475569', fontWeight: 600, background: '#e2e8f0', padding: '3px 10px', borderRadius: '6px' }}>
                    🚛 {vehicle.registration}
                  </span>
                )}
              </div>
              {mileageHistory.length === 0 ? (
                <div className="empty-state">
                  <p>Aucun relevé kilométrique enregistré</p>
                </div>
              ) : (
                <div className="maintenance-list">
                  {mileageHistory.map((entry, idx) => (
                    <div key={entry.id || idx} className="maintenance-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                      <div className="maintenance-card-header">
                        <div className="maintenance-card-title">
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Gauge size={16} />
                            {entry.parsed.newKilometrage ? parseInt(entry.parsed.newKilometrage).toLocaleString('fr-FR') + ' km' : 'Relevé'}
                          </h3>
                          <span className="maintenance-date">
                            {entry.timestamp ? format(parseISO(entry.timestamp), 'dd MMMM yyyy à HH:mm', { locale: fr }) : ''}
                          </span>
                        </div>
                      </div>
                      <div className="maintenance-card-body">
                        <div className="maintenance-details">
                          {entry.parsed.oldKilometrage !== undefined && (
                            <div className="detail-item">
                              <span className="detail-label">Ancien km :</span>
                              <span className="detail-value">{parseInt(entry.parsed.oldKilometrage).toLocaleString('fr-FR')} km</span>
                            </div>
                          )}
                          {entry.parsed.newKilometrage !== undefined && (
                            <div className="detail-item">
                              <span className="detail-label">Nouveau km :</span>
                              <span className="detail-value" style={{ fontWeight: 600 }}>{parseInt(entry.parsed.newKilometrage).toLocaleString('fr-FR')} km</span>
                            </div>
                          )}
                          {entry.parsed.oldKilometrage !== undefined && entry.parsed.newKilometrage !== undefined && (
                            <div className="detail-item">
                              <span className="detail-label">Différence :</span>
                              <span className="detail-value" style={{ color: '#059669' }}>
                                +{(parseInt(entry.parsed.newKilometrage) - parseInt(entry.parsed.oldKilometrage)).toLocaleString('fr-FR')} km
                              </span>
                            </div>
                          )}
                          {(entry.userName || entry.user_name) && (
                            <div className="detail-item">
                              <span className="detail-label"><User size={14} /> Relevé par :</span>
                              <span className="detail-value">{entry.userName || entry.user_name}</span>
                            </div>
                          )}
                          {entry.parsed.description && (
                            <div className="detail-item">
                              <span className="detail-label">Source :</span>
                              <span className="detail-value" style={{ fontStyle: 'italic' }}>{entry.parsed.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="maintenance-history">
              {/* En-tête avec immatriculation */}
              {vehicle.registration && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '6px 12px', background: '#f0f4f8', borderRadius: '6px', width: 'fit-content' }}>
                  <span style={{ fontSize: '0.9em', color: '#475569', fontWeight: 600 }}>🚛 {vehicle.registration}</span>
                </div>
              )}
              {vehicleMaintenances.length === 0 ? (
                <div className="empty-state">
                  <p>Aucun entretien enregistré pour ce véhicule</p>
                  <button 
                    className="add-first-button"
                    onClick={() => setActiveTab('new')}
                  >
                    ➕ Ajouter le premier entretien
                  </button>
                </div>
              ) : (
                <div className="maintenance-list">
                  {vehicleMaintenances
                    .sort((a, b) => {
                      // Utiliser startDate si disponible, sinon createdAt
                      const dateA = a.startDate || a.date || a.createdAt;
                      const dateB = b.startDate || b.date || b.createdAt;
                      return new Date(dateB) - new Date(dateA);
                    })
                    .map(maintenance => (
                      <div key={maintenance.id} className={`maintenance-card status-${maintenance.status}`}>
                        <div className="maintenance-card-header">
                          <div className="maintenance-card-title">
                            <h3>
                              {maintenance.isImmobilized && '🚫 '}
                              {getTypeLabel(maintenance.type)}
                            </h3>
                            <span className="maintenance-date">
                              {maintenance.isQuickReport || maintenance.status === 'reported'
                                ? `Signalée le ${format(parseISO(maintenance.createdAt), 'dd MMMM yyyy', { locale: fr })}`
                                : maintenance.status === 'pending'
                                ? `Demandée le ${format(parseISO(maintenance.createdAt), 'dd MMMM yyyy', { locale: fr })}`
                                : maintenance.startDate && maintenance.endDate
                                ? (maintenance.startDate === maintenance.endDate
                                  ? format(parseISO(maintenance.startDate), 'dd MMMM yyyy', { locale: fr })
                                  : `${format(parseISO(maintenance.startDate), 'dd MMM', { locale: fr })} - ${format(parseISO(maintenance.endDate), 'dd MMM yyyy', { locale: fr })}`)
                                : `Créée le ${format(parseISO(maintenance.createdAt), 'dd MMMM yyyy', { locale: fr })}`
                              }
                            </span>
                          </div>
                          <div className="maintenance-card-actions">
                            <span 
                              className="status-badge"
                              style={{ 
                                backgroundColor: getStatusColor(maintenance.status) + '20',
                                color: getStatusColor(maintenance.status),
                                borderColor: getStatusColor(maintenance.status)
                              }}
                            >
                              {getStatusIcon(maintenance.status)}
                              {getStatusLabel(maintenance.status)}
                            </span>
                            <button
                              className="edit-maintenance-button"
                              onClick={() => startEditing(maintenance)}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            {canManageMaintenance && (
                              <button
                                className="delete-maintenance-button"
                                onClick={() => deleteMaintenance(maintenance.id)}
                                title="Supprimer"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="maintenance-card-body">
                          <p className="maintenance-description">{maintenance.description}</p>
                          
                          <div className="maintenance-details">
                            {maintenance.mileage && (
                              <div className="detail-item">
                                <span className="detail-label">Kilométrage:</span>
                                <span className="detail-value">{parseInt(maintenance.mileage).toLocaleString()} km</span>
                              </div>
                            )}
                            {maintenance.cost && (
                              <div className="detail-item">
                                <span className="detail-label">Coût:</span>
                                <span className="detail-value">{parseFloat(maintenance.cost).toFixed(2)} €</span>
                              </div>
                            )}
                            {maintenance.type === 'external' && maintenance.garageId && (
                              <div className="detail-item">
                                <span className="detail-label">Garage:</span>
                                <span className="detail-value">
                                  {garages.find(g => g.id === parseInt(maintenance.garageId))?.name || 'N/A'}
                                </span>
                              </div>
                            )}
                          </div>

                          {maintenance.notes && (
                            <div className="maintenance-notes">
                              <strong>Notes:</strong>
                              <p>{maintenance.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer boutons - fixé en bas */}
        {activeTab === 'new' && (
          <div className="form-actions">
            {isViewMode ? (
              <div className="form-actions-right" style={{ marginLeft: 'auto' }}>
                <button type="button" className="submit-button" onClick={onClose}>Fermer</button>
              </div>
            ) : editingId ? (
              <>
                <div className="form-actions-left">
                  {canManageMaintenance && (
                    <button 
                      type="button" 
                      className="delete-button"
                      onClick={() => deleteMaintenance(editingId)}
                    >
                      🗑️ Supprimer
                    </button>
                  )}
                  {canManageMaintenance && formData.status !== 'cancelled' && !showCancelForm && (
                    <button
                      type="button"
                      className="cancel-intervention-button"
                      onClick={() => setShowCancelForm(true)}
                    >
                      ❌ Annuler l'intervention
                    </button>
                  )}
                  {canManageMaintenance && formData.status === 'cancelled' && (
                    <button
                      type="button"
                      className="reschedule-button"
                      onClick={() => {
                        handleChange('status', 'scheduled');
                        setStatusReason('');
                      }}
                    >
                      📅 Reprogrammer
                    </button>
                  )}
                </div>
                <div className="form-actions-right">
                  {canManageMaintenance && formData.status !== 'cancelled' && (
                    <button 
                      type="button" 
                      className="reschedule-button"
                      onClick={() => {
                        handleChange('status', 'rescheduled');
                      }}
                    >
                      <Clock size={16} />
                      Reporter
                    </button>
                  )}
                  {hasChanges && (
                    <button type="submit" form="maintenance-form" className="submit-button">
                      ✓ Valider les modifications
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <button type="submit" form="maintenance-form" className="submit-button">
                  {isQuickReport ? '⚠️ Signaler' : formData.status === 'pending' ? '📝 Enregistrer la demande' : '📅 Enregistrer'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Dialogue d'avertissement de conflit */}
        {conflictWarning && conflictWarning.length > 0 && (
          <div className="conflict-warning-overlay" onClick={() => setConflictWarning(null)}>
            <div className="conflict-warning-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="conflict-warning-header">
                <h3>⚠️ Conflit détecté</h3>
              </div>
              <div className="conflict-warning-content">
                <p className="conflict-message">
                  {conflictWarning.length === 1 
                    ? 'Une réservation existe déjà pendant cette période :'
                    : `${conflictWarning.length} réservations existent déjà pendant cette période :`}
                </p>
                <div className="conflict-list">
                  {conflictWarning.map((conflict, index) => (
                    <div key={index} className="conflict-item">
                      <div className="conflict-dates">
                        📅 {format(parseISO(conflict.date), 'dd/MM/yyyy')} 
                        {conflict.period === 'AM' ? ' (Matin)' : ' (Après-midi)'}
                        {conflict.endDate && conflict.endDate !== conflict.date && (
                          <> → {format(parseISO(conflict.endDate), 'dd/MM/yyyy')}
                          {conflict.endPeriod === 'PM' ? ' (Après-midi)' : ' (Matin)'}</>
                        )}
                      </div>
                      <div className="conflict-prestation">{conflict.prestationName}</div>
                    </div>
                  ))}
                </div>
                <p className="conflict-question">
                  Que souhaitez-vous faire ?
                </p>
              </div>
              <div className="conflict-warning-actions">
                <button 
                  className="conflict-button conflict-cancel"
                  onClick={() => setConflictWarning(null)}
                >
                  Annuler
                </button>
                <button 
                  className="conflict-button conflict-change"
                  onClick={() => setConflictWarning(null)}
                >
                  Changer les dates
                </button>
                <button 
                  className="conflict-button conflict-proceed"
                  onClick={(e) => {
                    // Forcer l'enregistrement malgré le conflit
                    setConflictWarning(null);
                    const fakeEvent = { preventDefault: () => {} };
                    // Appeler handleSubmit avec le flag de conflit déjà passé
                    const maintenance = {
                      id: editingId || Date.now(),
                      vehicleId: vehicle.id,
                      vehicleName: vehicle.name,
                      ...formData,
                      createdAt: editingId ? maintenances.find(m => m.id === editingId)?.createdAt : new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    onSave(maintenance);
                    
                    // Réinitialiser le formulaire
                    setEditingId(null);
                    setIsQuickReport(false);
                    setFormData({
                      type: 'revision',
                      startDate: '',
                      endDate: '',
                      description: '',
                      garageId: '',
                      cost: '',
                      mileage: '',
                      status: 'scheduled',
                      notes: '',
                      isImmobilized: false,
                      isQuickReport: false
                    });
                  }}
                >
                  Programmer quand même
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {showUnsavedWarning && (
        <UnsavedChangesDialog
          onCancel={() => setShowUnsavedWarning(false)}
          onDiscard={onClose}
        />
      )}
    </div>
  );
}

export default React.memo(MaintenanceDialog);
