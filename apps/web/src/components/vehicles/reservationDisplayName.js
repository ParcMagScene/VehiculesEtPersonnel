const LOWERCASE_TITLE_WORDS = new Set([
  'à',
  'au',
  'aux',
  'avec',
  'chez',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'et',
  'la',
  'le',
  'les',
  'ou',
  'par',
  'pour',
  'sans',
  'sous',
  'sur',
]);

export function formatReservationDisplayName(value) {
  if (typeof value !== 'string') return '';

  const cleanedName = value
    .replace(/\bAF\s*\d{3,}\b/giu, ' ')
    .replace(/\s+/gu, ' ')
    .replace(/^[\s—–,:;|-]+|[\s—–,:;|-]+$/gu, '');

  if (!cleanedName) return '';

  return cleanedName
    .split(' ')
    .map((word, index) => {
      const lowercaseWord = word.toLocaleLowerCase('fr-FR');
      if (index > 0 && LOWERCASE_TITLE_WORDS.has(lowercaseWord)) return lowercaseWord;
      if (/\p{Ll}/u.test(word) && /\p{Lu}/u.test(word)) return word;
      return lowercaseWord.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('fr-FR'));
    })
    .join(' ');
}

export function getReservationDisplayName(prestationName, clientName) {
  const name =
    typeof prestationName === 'string' && prestationName.trim() ? prestationName : clientName;
  return formatReservationDisplayName(name);
}
