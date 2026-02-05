/**
 *Utilitaire pour les vérifications liées aux véhicules
 */

/**
 * Vérifie si un véhicule a un contrôle technique expiré
 * @param {Object} vehicle - Le véhicule à vérifier
 * @param {Array} maintenances - Liste des maintenances (optionnel)
 * @returns {boolean} true si au moins un contrôle technique est expiré ET non couvert par une intervention programmée
 */
export const hasExpiredTechnicalControl = (vehicle, maintenances = []) => {
  if (!vehicle) return false;

  // Vérifier si le véhicule a des contrôles techniques
  let controles = [];
  
  if (vehicle.controles_techniques) {
    try {
      controles = typeof vehicle.controles_techniques === 'string' 
        ? JSON.parse(vehicle.controles_techniques)
        : vehicle.controles_techniques;
    } catch (error) {
      console.error('Erreur parsing controles_techniques:', error);
      return false;
    }
  }

  // Si pas de contrôles ou tableau vide, pas expiré
  if (!Array.isArray(controles) || controles.length === 0) {
    return false;
  }

  // Récupérer les interventions CT programmées ou en cours pour ce véhicule
  const scheduledCTInterventions = maintenances.filter(m => 
    (m.vehicleId === vehicle.id || m.vehicle_id === vehicle.id) &&
    m.type === 'technical_inspection' &&
    (m.status === 'scheduled' || m.status === 'in_progress') &&
    m.technicalControlType
  );

  // Vérifier si au moins un contrôle est expiré et non couvert
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Réinitialiser l'heure pour comparer juste les dates

  return controles.some(controle => {
    if (!controle.deadline) return false;
    
    const deadline = new Date(controle.deadline);
    deadline.setHours(0, 0, 0, 0);
    
    // Si le contrôle n'est pas encore expiré, continuer
    if (deadline >= today) return false;
    
    // Vérifier s'il y a une intervention programmée pour ce type de contrôle
    // qui est prévue avant ou à la deadline
    const hasScheduledIntervention = scheduledCTInterventions.some(intervention => {
      if (intervention.technicalControlType !== controle.type) return false;
      
      // Vérifier si l'intervention est programmée avant ou à la deadline
      const interventionDate = new Date(intervention.startDate || intervention.date);
      interventionDate.setHours(0, 0, 0, 0);
      
      return interventionDate <= deadline;
    });
    
    // Afficher l'alerte seulement si pas d'intervention programmée avant la deadline
    return !hasScheduledIntervention;
  });
};

/**
 * Obtient les détails des contrôles techniques expirés d'un véhicule
 * @param {Object} vehicle - Le véhicule à vérifier
 * @param {Array} maintenances - Liste des maintenances (optionnel)
 * @returns {Array} Liste des contrôles expirés avec leurs détails (uniquement ceux non couverts par une intervention)
 */
export const getExpiredTechnicalControls = (vehicle, maintenances = []) => {
  if (!vehicle) return [];

  let controles = [];
  
  if (vehicle.controles_techniques) {
    try {
      controles = typeof vehicle.controles_techniques === 'string' 
        ? JSON.parse(vehicle.controles_techniques)
        : vehicle.controles_techniques;
    } catch (error) {
      console.error('Erreur parsing controles_techniques:', error);
      return [];
    }
  }

  if (!Array.isArray(controles) || controles.length === 0) {
    return [];
  }

  // Récupérer les interventions CT programmées ou en cours pour ce véhicule
  const scheduledCTInterventions = maintenances.filter(m => 
    (m.vehicleId === vehicle.id || m.vehicle_id === vehicle.id) &&
    m.type === 'technical_inspection' &&
    (m.status === 'scheduled' || m.status === 'in_progress') &&
    m.technicalControlType
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return controles.filter(controle => {
    if (!controle.deadline) return false;
    
    const deadline = new Date(controle.deadline);
    deadline.setHours(0, 0, 0, 0);
    
    // Si le contrôle n'est pas encore expiré, filtrer
    if (deadline >= today) return false;
    
    // Vérifier s'il y a une intervention programmée pour ce type de contrôle
    // qui est prévue avant ou à la deadline
    const hasScheduledIntervention = scheduledCTInterventions.some(intervention => {
      if (intervention.technicalControlType !== controle.type) return false;
      
      const interventionDate = new Date(intervention.startDate || intervention.date);
      interventionDate.setHours(0, 0, 0, 0);
      
      return interventionDate <= deadline;
    });
    
    // Retourner seulement les contrôles non couverts par une intervention
    return !hasScheduledIntervention;
  }).map(controle => {
    const deadline = new Date(controle.deadline);
    const diffDays = Math.floor((today - deadline) / (1000 * 60 * 60 * 24));
    
    return {
      type: controle.type,
      deadline: controle.deadline,
      daysExpired: diffDays
    };
  });
};
