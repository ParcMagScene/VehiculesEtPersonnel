// ─── Constantes centralisées — eM@g ───

// Statuts communs (alignés avec la DB et l'API)
export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUSED: 'refused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  SCHEDULED: 'scheduled',
  MAINTENANCE: 'maintenance',
  VALIDATED: 'validated',
  CONFIRMED: 'confirmed',
  ACCEPTED: 'accepted',
  DONE: 'done',
  DISPONIBLE: 'disponible',
};

// Rôles utilisateur
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
};

// Timing UI (millisecondes)
export const TIMING = {
  PANEL_CLOSE: 350,
  DEBOUNCE_SEARCH: 300,
  DOUBLE_CLICK: 200,
  TOAST_DURATION: 2000,
  STATUS_CLEAR: 3000,
  PRINT_DELAY: 500,
};

// Validation
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 10,
  MAX_TEXT_LENGTH: 500,
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 254,
};

// Statuts équipement (couleurs et labels pour UI mobile)
export const EQUIPMENT_STATUS = {
  available: { label: 'Disponible', color: '#10b981', icon: '✅' },
  in_use: { label: 'En service', color: '#3b82f6', icon: '🔄' },
  maintenance: { label: 'En maintenance', color: '#f59e0b', icon: '🔧' },
  retired: { label: 'Réformé', color: 'var(--theme-text-gray)', icon: '⛔' },
};
