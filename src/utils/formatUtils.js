/**
 * Fonctions utilitaires de formatage centralisées
 * Élimine les duplications entre composants
 */

// ═══ MONNAIE ═══

/**
 * Formate un montant en euros (format français)
 * @param {number} amount - Montant à formater
 * @returns {string} Montant formaté ou '—'
 */
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

// ═══ DATES ═══

/**
 * Parse sûr d'une date string (gère les formats ISO sans timezone)
 * @param {string} dateStr - Date string
 * @returns {Date|null}
 */
const safeParse = (dateStr) => {
  if (!dateStr) return null;
  try {
    const s = String(dateStr).trim();
    // Ajouter T00:00:00 si c'est une date sans heure (évite décalage timezone)
    const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

/**
 * Formate une date en format court français (dd/MM/yyyy)
 * @param {string} dateStr - Date ISO
 * @param {string} fallback - Valeur par défaut si invalide
 * @returns {string}
 */
export const formatDateSimple = (dateStr, fallback = '—') => {
  const d = safeParse(dateStr);
  if (!d) return fallback;
  return d.toLocaleDateString('fr-FR');
};

/**
 * Formate une date en format complet français (lundi 1 janvier 2024)
 * @param {string} dateStr - Date ISO
 * @param {string} fallback - Valeur par défaut si invalide
 * @returns {string}
 */
export const formatDateFr = (dateStr, fallback = '—') => {
  const d = safeParse(dateStr);
  if (!d) return fallback;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
};

/**
 * Formate une date en dd/MM/yyyy HH:mm
 * @param {string} dateStr - Date ISO
 * @param {string} fallback - Valeur par défaut si invalide
 * @returns {string}
 */
export const formatDateTime = (dateStr, fallback = '—') => {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return fallback;
  }
};

/**
 * Formate une date en format court (dd/MM/yyyy) avec gestion robuste des formats
 * Gère YYYY-MM-DD, dd/MM/yyyy, et tout ce que Date() comprend
 * @param {string} d - Date string
 * @param {string} fallback - Valeur par défaut
 * @returns {string} Date en dd/MM/yyyy
 */
export const safeDate = (d, fallback = '—') => {
  if (!d) return fallback;
  try {
    const s = String(d).trim();
    // Format YYYY-MM-DD
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    // Format dd/MM/yyyy déjà correct
    const m2 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
    // Fallback Date()
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleDateString('fr-FR');
  } catch {
    return fallback;
  }
};
