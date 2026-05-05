/**
 * ═══ Workflow Affaires — Machine à états, templates, validation ═══
 * Module partagé entre backend et frontend.
 */

// ═══ STATUTS D'AFFAIRE ═══
export const AFFAIRE_STATUSES = [
  { value: 'brouillon', label: 'Brouillon', color: '#94a3b8', emoji: '📝' },
  { value: 'planifiee', label: 'Planifiée', color: '#3b82f6', emoji: '📅' },
  { value: 'en_cours', label: 'En cours', color: '#f59e0b', emoji: '🔄' },
  { value: 'terminee', label: 'Terminée', color: '#22c55e', emoji: '✅' },
  { value: 'annulee', label: 'Annulée', color: '#ef4444', emoji: '❌' },
];

export const AFFAIRE_STATUS_MAP = Object.fromEntries(AFFAIRE_STATUSES.map((s) => [s.value, s]));

// ═══ TRANSITIONS VALIDES ═══
// Clé = statut actuel, valeur = tableau de statuts cibles autorisés
export const VALID_TRANSITIONS = {
  brouillon: ['planifiee', 'annulee'],
  planifiee: ['en_cours', 'brouillon', 'annulee'],
  en_cours: ['terminee', 'annulee'],
  terminee: ['en_cours'], // ré-ouvrir si besoin
  annulee: ['brouillon'], // recycler
};

/**
 * Vérifie si une transition est valide
 */
export function isValidTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

/**
 * Retourne les transitions possibles depuis un statut donné
 */
export function getAvailableTransitions(fromStatus) {
  const targets = VALID_TRANSITIONS[fromStatus] || [];
  return targets.map((value) => AFFAIRE_STATUS_MAP[value]).filter(Boolean);
}

// ═══ TEMPLATES D'ÉTAPES PAR TYPE D'AFFAIRE ═══
export const STEP_TEMPLATES = {
  Prestation: [
    'preparation',
    'chargement',
    'depart',
    'livraison',
    'montage',
    'demontage',
    'enlevement',
    'retour',
  ],
  Location: ['preparation', 'chargement', 'depart', 'livraison', 'recuperation', 'retour'],
  Installation: ['preparation', 'chargement', 'depart', 'livraison', 'installation', 'retour'],
  Vente: ['preparation', 'chargement', 'livraison'],
  Tournée: ['preparation', 'chargement', 'depart', 'retour'],
};

// ═══ RÈGLES DE VALIDATION CONDITIONNELLE ═══
// Définit les pré-requis pour chaque transition de statut
export const TRANSITION_RULES = {
  // Pour passer à "planifiée" : date_debut doit être définie
  planifiee: {
    check: 'has_dates',
    message: 'Dates de début et fin requises pour planifier',
  },
  // Pour passer à "en cours" : au moins 1 réservation
  en_cours: {
    check: 'has_reservation',
    message: 'Au moins une réservation véhicule requise',
  },
  // Pour passer à "terminée" : toutes les étapes done ou cancelled
  terminee: {
    check: 'steps_complete',
    message: 'Toutes les étapes doivent être terminées ou annulées',
  },
};

/**
 * Valide les pré-conditions pour une transition.
 * @param {string} toStatus - Statut cible
 * @param {object} context - { affaire, reservationCount, stepsComplete }
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateTransition(toStatus, context = {}) {
  const rule = TRANSITION_RULES[toStatus];
  if (!rule) return { valid: true };

  switch (rule.check) {
    case 'has_dates':
      if (!context.affaire?.date_debut || !context.affaire?.date_fin) {
        return { valid: false, message: rule.message };
      }
      break;
    case 'has_reservation':
      if (!context.reservationCount || context.reservationCount === 0) {
        return { valid: false, message: rule.message };
      }
      break;
    case 'steps_complete':
      if (!context.stepsComplete) {
        return { valid: false, message: rule.message };
      }
      break;
  }
  return { valid: true };
}
