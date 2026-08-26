// components/planning-v2/planningV2Constants.js
//
// Ticket : T-P0-05b (UI mutations Planning v2).
//
// Constantes côté client miroir des constantes serveur
// (services/planning/tasks.js). Utilisées par les dialogs de mutation.
// Doivent rester alignées avec le backend Zod (schemas/planningV2.js).

export const TASK_SECTIONS = Object.freeze([
  'rdv',
  'prep_locations',
  'prep_prestations',
  'prep_ventes',
  'prep_installations',
  'prep_tournees',
  'chargement',
  'depart',
  'enlevement',
  'retour',
  'recuperation',
  'installation',
  'montage',
  'demontage',
  'intervention',
  'evenements',
  'taches_prioritaires',
  'taches_secondaires',
  'courses',
  'manual',
]);

export const TASK_SECTION_LABELS = Object.freeze({
  rdv: 'RDV',
  prep_locations: 'Préparation locations',
  prep_prestations: 'Préparation prestations',
  prep_ventes: 'Préparation ventes',
  prep_installations: 'Préparation installations',
  prep_tournees: 'Préparation tournées',
  chargement: 'Chargement',
  depart: 'Départ',
  enlevement: 'Enlèvement',
  retour: 'Retour',
  recuperation: 'Récupération',
  installation: 'Installation',
  montage: 'Montage',
  demontage: 'Démontage',
  intervention: 'Intervention',
  evenements: 'Événements',
  taches_prioritaires: 'Tâches prioritaires',
  taches_secondaires: 'Tâches secondaires',
  courses: 'Courses',
  manual: 'Manuelle',
});

export const TASK_STATUSES = Object.freeze(['pending', 'in_progress', 'done', 'cancelled']);

export const TASK_STATUS_LABELS = Object.freeze({
  pending: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
  cancelled: 'Annulée',
});

export const TASK_PERIODS = Object.freeze(['AM', 'PM']);
