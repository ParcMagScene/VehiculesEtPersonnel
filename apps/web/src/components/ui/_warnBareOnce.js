/**
 * warnBareOnce — déduplication des warnings DS "mode bare".
 *
 * Les composants atomes (Input, Select, Textarea) avertissent quand ils sont
 * rendus sans `size` (= style minimal hérité, pas le vrai DS). Sans throttle,
 * ces warnings se déclenchent à chaque render → noient la console.
 *
 * Ce helper :
 *   - n'opère qu'en DEV (no-op en production, supprimé par Vite tree-shake)
 *   - dédoublonne par (component × site d'appel) via le stack trace
 *   - garde le warning informatif : affiche le fragment de stack du caller
 *
 * Effet : chaque endroit fautif du code est signalé exactement une fois par
 * session de dev, au lieu d'une fois par render (souvent plusieurs centaines).
 */

const _seen = new Set();

/**
 * @param {string} component  Nom du composant ('Input', 'Select', 'Textarea')
 */
export function warnBareOnce(component) {
  if (!import.meta.env?.DEV) return;
  // Extrait le caller user-land. Stack typique :
  //   Error
  //     at warnBareOnce (...)
  //     at _c (Input.jsx:20)         ← le forwardRef du composant atome
  //     at <appelant réel>           ← ce qu'on veut identifier
  const stack = new Error().stack || '';
  const lines = stack.split('\n');
  // Cherche la 1re ligne qui n'est ni warnBareOnce ni le fichier du composant atome.
  const callerLine =
    lines.find(
      (l, i) =>
        i > 0 && !l.includes('warnBareOnce') && !/\/ui\/(Input|Select|Textarea)\.jsx/.test(l),
    ) || '';

  const key = `${component}|${callerLine.trim()}`;
  if (_seen.has(key)) return;
  _seen.add(key);

  // eslint-disable-next-line no-console
  console.warn(
    `[DS][${component}] Composant rendu en mode bare (sans \`size\`). Ajoutez size="sm|md|lg" pour obtenir le style DS complet.\n  ↳ ${callerLine.trim()}`,
  );
}
