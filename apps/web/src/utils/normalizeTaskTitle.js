/* eslint-disable no-misleading-character-class */

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

const OPERATION_PREFIX =
  '(?:liv(?:raison)?|r(?:e|é)cup(?:e|é)?(?:ration)?|recup(?:eration)?|enl(?:e|è)vement|enlev(?:ement)?|retour|chargement|pr(?:e|é)pa(?:ration)?|prep(?:aration)?|d(?:e|é)part|installation|montage|d(?:e|é)montage|demontage|prioritaires?|secondaires?|intervention|autre\\s+tâche|courses?)';

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
  'location',
  'ou',
  'par',
  'pour',
  'sans',
  'sous',
  'sur',
]);

const TITLE_ACRONYMS = new Map([['eos', 'EOS']]);

function capitalizeWord(word, index) {
  const lowercaseWord = word.toLocaleLowerCase('fr-FR');
  if (index > 0 && LOWERCASE_TITLE_WORDS.has(lowercaseWord)) return lowercaseWord;
  if (/\p{Ll}/u.test(word) && /\p{Lu}/u.test(word)) return word;
  return (
    TITLE_ACRONYMS.get(lowercaseWord) ||
    lowercaseWord.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('fr-FR'))
  );
}

export function normalizeTaskTitle(value) {
  if (typeof value !== 'string') return '';

  const operationPrefix = new RegExp(`^\\s*${OPERATION_PREFIX}\\b\\.?\\s*[—–:-]?\\s*`, 'iu');
  const repeatedOperationPrefix = new RegExp(`([+])\\s*${OPERATION_PREFIX}\\b\\.?\\s+`, 'giu');

  let title = value
    .replace(EMOJI_RE, '')
    .replace(/\bAF\s*\d{3,}\b/giu, ' ')
    .replace(/\bloc\b\.?/giu, 'location')
    .replace(operationPrefix, '')
    .replace(repeatedOperationPrefix, '$1 ')
    .replace(/\s*[—–-]\s*(?=[—–-]|$)/gu, ' ')
    .replace(/\s*\+\s*/gu, ' + ')
    .replace(/\s+/gu, ' ')
    .replace(/^[\s—–,:;+|-]+|[\s—–,:;+|-]+$/gu, '')
    .trim();

  if (!title) return '';

  title = title
    .split(' ')
    .map((word, index) =>
      word
        .split(/([-’'])/u)
        .map((part, partIndex) =>
          /^[-’']$/u.test(part) ? part : capitalizeWord(part, index + partIndex),
        )
        .join(''),
    )
    .join(' ');

  return title;
}
