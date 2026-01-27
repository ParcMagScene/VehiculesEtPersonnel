import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPeriodTimestamp } from '../utils/dateUtils';
import './MaintenanceDialog.css';

function MaintenanceDialog({ vehicle, onClose, maintenances = [], onSave, garages = [], reservations = [], maintenanceToEdit = null }) {
  // Trouver la maintenance à éditer dès le départ
  const maintenanceToEditData = maintenanceToEdit ? maintenances.find(m => m.id === maintenanceToEdit) : null;
  
  const [activeTab, setActiveTab] = useState('new'); // 'new' ou 'history'
  const [isQuickReport, setIsQuickReport] = useState(maintenanceToEditData?.isQuickReport || false);
  const [editingId, setEditingId] = useState(maintenanceToEditData?.id || null);
  const [conflictWarning, setConflictWarning] = useState(null); // Avertissement de conflit
  const [formData, setFormData] = useState(
    maintenanceToEditData ? {
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
      isQuickReport: maintenanceToEditData.isQuickReport || false
    } : {
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
    }
  );

  // Filtrer les maintenances pour ce véhicule
  const vehicleMaintenances = maintenances.filter(m => m.vehicleId === vehicle.id);

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
      isQuickReport: maintenance.isQuickReport || false
    });
    setActiveTab('new');
  };

  const checkMaintenanceConflicts = () => {
    // Ne vérifier que pour les interventions programmées
    if (isQuickReport || !formData.startDate || !formData.endDate) {
      return [];
    }

    const newStart = getPeriodTimestamp(formData.startDate, 'AM');
    const newEnd = getPeriodTimestamp(formData.endDate, 'PM');
    
    const conflicts = [];
    
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
    
    return conflicts;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
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
      createdAt: editingId ? maintenances.find(m => m.id === editingId)?.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(maintenance);
    
    // Réinitialiser le formulaire et l'avertissement
    setEditingId(null);
    setIsQuickReport(false);
    setConflictWarning(null);
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
      completed: 'Effectuée',
      reported: 'Signalée'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: '#3b82f6',
      in_progress: '#f59e0b',
      completed: '#10b981',
      reported: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getTypeLabel = (type) => {
    const labels = {
      revision: 'Révision',
      technical_inspection: 'Contrôle technique',
      internal: 'Intervention interne',
      external: 'Intervention externe'
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
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet entretien ?')) {
      // L'ID négatif indique une suppression
      onSave({ id: maintenanceId, _deleted: true });
    }
  };

  const cancelEditing = () => {
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
  };

  return (
    <div className="maintenance-dialog-overlay" onClick={onClose}>
      <div className="maintenance-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="maintenance-dialog-header">
          <div className="maintenance-dialog-title">
            <h2>🔧 Entretien - {vehicle.name}</h2>
            <div className="vehicle-info">
              <span className="vehicle-type">{vehicle.type}</span>
              {vehicle.registration && <span className="vehicle-registration">{vehicle.registration}</span>}
            </div>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="maintenance-tabs">
          <button 
            className={`tab-button ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            {editingId ? '✏️ Modifier l\'intervention' : '➕ Nouvelle intervention'}
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📋 Historique ({vehicleMaintenances.length})
          </button>
        </div>

        <div className="maintenance-dialog-content">
          {activeTab === 'new' ? (
            <form onSubmit={handleSubmit} className="maintenance-form">
              {/* Mode de saisie */}
              <div className="form-mode-selector">
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
              </div>

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
                {formData.status === 'scheduled' && (
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
                  </>
                )}

                {(formData.status === 'pending' || isQuickReport) && (
                  <div className="form-group full-width">
                    <label>Type {isQuickReport ? 'de panne' : "d'intervention"}</label>
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

              {formData.status === 'scheduled' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Date de début *</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleChange('startDate', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Date de fin *</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleChange('endDate', e.target.value)}
                      min={formData.startDate}
                      required
                    />
                  </div>
                </div>
              )}

              {formData.status === 'scheduled' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Statut *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value)}
                      required
                    >
                      <option value="scheduled">Programmée</option>
                      <option value="in_progress">En cours</option>
                      <option value="completed">Effectuée</option>
                    </select>
                  </div>
                </div>
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

              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={editingId ? cancelEditing : onClose}>
                  Annuler
                </button>
                {editingId && (
                  <button 
                    type="button" 
                    className="delete-button"
                    onClick={() => deleteMaintenance(editingId)}
                  >
                    🗑️ Supprimer
                  </button>
                )}
                {editingId && (formData.status === 'pending' || formData.status === 'reported') && (
                  <button 
                    type="button" 
                    className="schedule-button"
                    onClick={() => {
                      handleChange('status', 'scheduled');
                      handleChange('isQuickReport', false);
                      setIsQuickReport(false);
                    }}
                  >
                    📅 Programmer maintenant
                  </button>
                )}
                <button type="submit" className="submit-button">
                  {editingId ? 'Mettre à jour' : (isQuickReport ? 'Signaler' : formData.status === 'pending' ? 'Enregistrer la demande' : 'Enregistrer')}
                </button>
              </div>
            </form>
          ) : (
            <div className="maintenance-history">
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
                      <div key={maintenance.id} className="maintenance-card">
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
                              {getStatusLabel(maintenance.status)}
                            </span>
                            <button
                              className="edit-maintenance-button"
                              onClick={() => startEditing(maintenance)}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button
                              className="delete-maintenance-button"
                              onClick={() => deleteMaintenance(maintenance.id)}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
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
    </div>
  );
}

export default MaintenanceDialog;
