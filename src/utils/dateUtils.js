/**
 * Convertit une date et une période (AM/PM) en timestamp comparable
 * @param {Date} date - La date
 * @param {string} period - 'AM' ou 'PM'
 * @returns {number} Timestamp permettant la comparaison
 */
export const getPeriodTimestamp = (date, period) => {
  if (!date) return 0;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() * 2 + (period === 'PM' ? 1 : 0);
};

/**
 * Formate une date en YYYY-MM-DD
 * @param {Date} date - La date à formater
 * @returns {string} Date au format YYYY-MM-DD
 */
export const formatLocalDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
