import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Calendar, Gauge, Plus, Trash2 } from 'lucide-react';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import './VehicleMaintenanceModal.css';
import { useToast } from '../hooks/useToast';

const VehicleMaintenanceModal = ({ vehicle, onClose, onSave }) => {
  const toast = useToast();
  const [kilometrage, setKilometrage] = useState(vehicle?.kilometrage || 0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Charger les contrôles existants ou initialiser un tableau vide
  const initialControles = vehicle?.controlesTechniques 
    ? (typeof vehicle.controlesTechniques === 'string' 
        ? JSON.parse(vehicle.controlesTechniques) 
        : vehicle.controlesTechniques)
    : [];
  
  const [controles, setControles] = useState(initialControles);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const initialKmRef = useRef(vehicle?.kilometrage || 0);
  const initialControlesRef = useRef(JSON.stringify(initialControles));

  const hasChanges = () => {
    return String(kilometrage) !== String(initialKmRef.current) ||
           JSON.stringify(controles) !== initialControlesRef.current;
  };

  const handleSafeClose = () => {
    if (hasChanges()) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };
  const [newControle, setNewControle] = useState({
    type: '',
    date: '',
    deadline: ''
  });

  // Synchroniser les états quand le véhicule change
  useEffect(() => {
    
    if (vehicle) {
      setKilometrage(vehicle.kilometrage || 0);
      
      const updatedControles = vehicle.controlesTechniques 
        ? (typeof vehicle.controlesTechniques === 'string' 
            ? JSON.parse(vehicle.controlesTechniques) 
            : vehicle.controlesTechniques)
        : [];
      
      setControles(updatedControles);
    }
  }, [vehicle?.id, vehicle?.controlesTechniques]);

  // Tous les types de contrôles disponibles
  const allControleTechniqueTypes = [
    { value: 'VL', label: 'VL (Véhicule Léger)', firstDelay: 48, periodicDelay: 24, note: 'CV 24h/2mois', vehicleTypes: ['VL', 'VOITURE', 'CAMIONNETTE'] },
    { value: 'PL', label: 'PL (Poids Lourd)', firstDelay: 12, periodicDelay: 12, note: 'Contrôle annuel', vehicleTypes: ['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR', 'SEMI', 'SEMI-REMORQUE'] },
    { value: 'SEMI', label: 'Semi-remorque', firstDelay: 12, periodicDelay: 12, note: 'Comme PL', vehicleTypes: ['SEMI', 'SEMI-REMORQUE'] },
    { value: 'SCENE', label: 'Scène mobile', firstDelay: 12, periodicDelay: 12, note: 'Véhicule spécial remorqué', vehicleTypes: ['SCENE', 'SCÈNE', 'REMORQUE'] },
    { value: 'POLLUTION', label: 'Pollution', firstDelay: 12, periodicDelay: 12, note: 'Contrôle des émissions', vehicleTypes: ['ALL_MOTORIZED'] },
    { value: 'HAYON', label: 'Hayon', firstDelay: 0, periodicDelay: 6, note: 'VGP obligatoire', vehicleTypes: ['ALL'] },
    { value: 'TACHYGRAPHE', label: '📡 Tachygraphe', firstDelay: 24, periodicDelay: 24, note: 'Vérification, étalonnage, scellés (~1h30, ~200 €)', vehicleTypes: ['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR', 'SEMI', 'SEMI-REMORQUE'] },
    { value: 'LIMITEUR', label: '🚧 Limiteur de vitesse', firstDelay: 12, periodicDelay: 12, note: 'Contrôle en centre agréé (~15 min, ~70 €)', vehicleTypes: ['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR', 'SEMI', 'SEMI-REMORQUE'] }
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
    const isScene = ['SCENE', 'SCÈNE', 'REMORQUE'].some(t => vehicleType.includes(t));
    
    return allControleTechniqueTypes.filter(ct => {
      // Hayon disponible pour TOUS les véhicules
      if (ct.value === 'HAYON') {
        return true;
      }
      
      // Pollution disponible pour tous les véhicules motorisés
      if (ct.value === 'POLLUTION') {
        return isMotorized;
      }
      
      // Tachygraphe et Limiteur de vitesse pour PL et semi-remorques
      if (ct.value === 'TACHYGRAPHE' || ct.value === 'LIMITEUR') {
        return isPL || isSemi;
      }
      
      // VL pour les véhicules légers
      if (ct.value === 'VL') {
        return isVL;
      }
      
      // PL pour poids lourds et semi-remorques
      if (ct.value === 'PL') {
        return isPL || isSemi;
      }
      
      // SEMI pour semi-remorques
      if (ct.value === 'SEMI') {
        return isSemi;
      }
      
      // SCENE pour scènes mobiles et remorques
      if (ct.value === 'SCENE') {
        return isScene;
      }
      
      return false;
    });
  };

  const availableControlTypes = getAvailableControlTypes();

  // Calculer automatiquement la deadline quand la date du contrôle change
  useEffect(() => {
    if (newControle.date && newControle.type) {
      const typeConfig = allControleTechniqueTypes.find(t => t.value === newControle.type);
      if (typeConfig) {
        const date = new Date(newControle.date);
        date.setMonth(date.getMonth() + typeConfig.periodicDelay);
        setNewControle(prev => ({
          ...prev,
          deadline: date.toISOString().split('T')[0]
        }));
      }
    }
  }, [newControle.date, newControle.type]);

  const handleAddControle = () => {
    if (newControle.type && newControle.date && newControle.deadline) {
      // Vérifier si ce type existe déjà
      const exists = controles.some(c => c.type === newControle.type);
      if (exists) {
        toast.warning('Un contrôle de ce type existe déjà. Supprimez-le d\'abord si vous voulez le remplacer.');
        return;
      }
      
      setControles([...controles, { ...newControle }]);
      setNewControle({ type: '', date: '', deadline: '' });
    }
  };

  const handleRemoveControle = (index) => {
    setControles(controles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const updatedVehicle = {
      ...vehicle,
      kilometrage: parseInt(kilometrage) || 0,
      controlesTechniques: JSON.stringify(controles)
    };
    
    
    try {
      await onSave(updatedVehicle);
      // Afficher le message de succès
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde des données');
    }
  };

  const selectedType = allControleTechniqueTypes.find(t => t.value === newControle.type);

  // Vérifier si le contrôle technique est expiré ou proche
  const getDeadlineStatus = (deadline) => {
    if (!deadline) return null;
    
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: 'expired', message: `Expiré depuis ${Math.abs(diffDays)} jours`, color: '#ef4444' };
    } else if (diffDays <= 30) {
      return { status: 'warning', message: `Expire dans ${diffDays} jours`, color: '#f59e0b' };
    } else {
      return { status: 'ok', message: `Valide encore ${diffDays} jours`, color: '#10b981' };
    }
  };

  return (
    <div className="vm-overlay" onClick={handleSafeClose}>
      <div className="vehicle-maintenance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <h2>🔧 Maintenance - {vehicle?.name}</h2>
            {(vehicle?.type || vehicle?.registration) && (
              <div className="vehicle-info">
                {vehicle.type && <span className="vehicle-type">{vehicle.type}</span>}
                {vehicle.registration && <span className="vehicle-registration">{vehicle.registration}</span>}
              </div>
            )}
          </div>
          <button className="close-button" onClick={handleSafeClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="maintenance-form">
          {/* Kilométrage */}
          <div className="form-section">
            <h3><Gauge size={18} /> Kilométrage</h3>
            <div className="form-group">
              <label htmlFor="kilometrage">Kilométrage actuel (km)</label>
              <input
                id="kilometrage"
                type="number"
                value={kilometrage}
                onChange={(e) => setKilometrage(e.target.value)}
                min="0"
                step="1"
              />
            </div>
          </div>

          {/* Contrôles techniques existants */}
          {controles.length > 0 && (
            <div className="form-section">
              <h3><Calendar size={18} /> Contrôles techniques enregistrés</h3>
              <div className="controles-list">
                {controles.map((controle, index) => {
                  const typeConfig = allControleTechniqueTypes.find(t => t.value === controle.type);
                  const status = getDeadlineStatus(controle.deadline);
                  return (
                    <div key={index} className="controle-item">
                      <div className="controle-header">
                        <strong>{typeConfig?.label || controle.type}</strong>
                        <button 
                          type="button" 
                          className="btn-remove"
                          onClick={() => handleRemoveControle(index)}
                          title="Supprimer ce contrôle"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="controle-details">
                        <div>
                          <span className="label">Dernier contrôle :</span>
                          <span>{new Date(controle.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div>
                          <span className="label">Prochaine échéance :</span>
                          <span>{new Date(controle.deadline).toLocaleDateString('fr-FR')}</span>
                        </div>
                        {status && (
                          <div className="controle-status" style={{ color: status.color }}>
                            {status.status === 'expired' && '⚠️ '}
                            {status.status === 'warning' && '⏰ '}
                            {status.status === 'ok' && '✅ '}
                            {status.message}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ajouter un nouveau contrôle technique */}
          <div className="form-section">
            <h3><Plus size={18} /> Ajouter un contrôle technique</h3>
            
            {availableControlTypes.length === 0 ? (
              <p className="info-message">
                ℹ️ Définissez d'abord le type du véhicule pour voir les contrôles disponibles
              </p>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="ct-type">Type de contrôle</label>
                  <select
                    id="ct-type"
                    value={newControle.type}
                    onChange={(e) => setNewControle({ ...newControle, type: e.target.value })}
                  >
                    <option value="">-- Sélectionner --</option>
                    {availableControlTypes.map(type => (
                      <option 
                        key={type.value} 
                        value={type.value}
                        disabled={controles.some(c => c.type === type.value)}
                      >
                        {type.label} {controles.some(c => c.type === type.value) ? '(déjà ajouté)' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedType && (
                    <p className="form-note">
                      📋 Périodicité : {selectedType.periodicDelay} mois - {selectedType.note}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="ct-date">Date du dernier contrôle</label>
                  <input
                    id="ct-date"
                    type="date"
                    value={newControle.date}
                    onChange={(e) => setNewControle({ ...newControle, date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ct-deadline">Prochaine échéance</label>
                  <input
                    id="ct-deadline"
                    type="date"
                    value={newControle.deadline}
                    onChange={(e) => setNewControle({ ...newControle, deadline: e.target.value })}
                  />
                </div>

                <button 
                  type="button" 
                  className="btn-add-controle"
                  onClick={handleAddControle}
                  disabled={!newControle.type || !newControle.date || !newControle.deadline}
                >
                  <Plus size={18} />
                  Ajouter ce contrôle
                </button>
              </>
            )}
          </div>

          <div className="modal-actions">
            {saveSuccess && (
              <div className="save-success-message">
                ✅ Sauvegardé avec succès !
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={handleSafeClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              <Save size={18} />
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      {showUnsavedWarning && (
        <UnsavedChangesDialog
          onCancel={() => setShowUnsavedWarning(false)}
          onDiscard={onClose}
        />
      )}
    </div>
  );
};

export default VehicleMaintenanceModal;
