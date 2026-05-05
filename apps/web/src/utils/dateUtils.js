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

/**
 * Capitalise intelligemment un texte en détectant les noms propres
 * @param {string} text - Le texte à capitaliser
 * @returns {string} Texte avec première lettre en majuscule et noms propres capitalisés
 */
export const capitalizeText = (text) => {
  if (!text) return '';

  // Mots qui indiquent qu'un nom propre suit
  const properNounIndicators = ['à', 'de', 'pour', 'avec', 'chez', 'par', 'vers', 'sur'];

  // Mots à ne pas capitaliser (articles, prépositions courtes)
  const lowercaseWords = [
    'le',
    'la',
    'les',
    'un',
    'une',
    'des',
    'du',
    'de',
    'et',
    'ou',
    'en',
    'au',
    'aux',
  ];

  const words = text.split(/\s+/);

  return words
    .map((word, index) => {
      if (!word) return word;

      // Première lettre toujours en majuscule
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      const lowerWord = word.toLowerCase();

      // Si c'est un mot à ne pas capitaliser et pas après un indicateur
      if (
        lowercaseWords.includes(lowerWord) &&
        index > 0 &&
        !properNounIndicators.includes(words[index - 1]?.toLowerCase())
      ) {
        return lowerWord;
      }

      // Si le mot précédent indique un nom propre, capitaliser
      if (index > 0 && properNounIndicators.includes(words[index - 1]?.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // Si le mot contient des majuscules (acronyme), le garder tel quel
      if (word.match(/[A-Z]{2,}/)) {
        return word;
      }

      // Sinon, capitaliser la première lettre
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Parse une date ISO en toute sécurité.
 * @param {string} str - La chaîne ISO à parser
 * @returns {Date|null} L'objet Date, ou null si invalide
 */
export const safeParseDate = (str) => {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};
