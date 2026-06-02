/**
 * planningGridColumns — Source de verite UNIQUE pour le CSS
 * `grid-template-columns` des grilles de planning + banner Google Calendar.
 *
 * POURQUOI :
 * Banner et grilles principales (Parc, Planning, etc.) DOIVENT partager
 * exactement la meme logique de largeur de colonnes pour rester alignees
 * pixel-perfect. Avant, chaque module calculait de son cote, avec des
 * `minmax(...)` differents entre banner et grille, ce qui creait :
 *  - un decalage cumule vers la droite (largeurs de colonnes legerement
 *    differentes a cause d'arrondis distincts)
 *  - un espace blanc a droite du banner quand la grille principale scrollait
 *    horizontalement (le banner s'ecrasait a 100% sans scroller)
 *  - un comportement different entre Parc et Planning car le minmax du Parc
 *    etait responsive (windowWidth) et celui du Planning fixe a 56/120px
 *
 * USAGE :
 * Tout module de planning DOIT utiliser cette fonction pour calculer son
 * `gridTemplateColumns`. Le banner Google Calendar DOIT lui aussi l'utiliser
 * avec les memes inputs (view, days, module, windowWidth) pour garantir
 * l'alignement parfait.
 *
 * SORTIE :
 * Une chaine CSS valide a passer a `style.gridTemplateColumns` :
 *   repeat(N, minmax(Wpx, 1fr))
 *
 * Le `minmax(Wpx, 1fr)` garantit que :
 *  - Si la scroll-area est assez large : chaque colonne fait 1fr (etale)
 *  - Sinon : chaque colonne fait au moins Wpx, la grille deborde, scroll
 *    horizontal apparait. Banner et grille debordent identiquement, scroll
 *    synchronise via scrollLeft.
 */

/**
 * @param {object}  opts
 * @param {'day'|'week'|'month'|'year'} opts.view  - vue active
 * @param {Array<Date>} opts.days                  - jours/mois affiches
 *                                                   (week: 7, month: 28-31,
 *                                                    year: 12)
 * @param {'planning'|'vehicles'|'affaires'|string} opts.module
 *                                                 - module actif. Le Parc et
 *                                                   les Affaires subdivisent
 *                                                   chaque jour en AM/PM
 *                                                   (×2 colonnes), le
 *                                                   Planning personnel non.
 * @param {number} [opts.windowWidth=1920]          - largeur de fenetre pour
 *                                                   responsive minmax.
 * @returns {string}  CSS valide pour gridTemplateColumns
 */
export function computeGridColumnsCss({ view, days, module, windowWidth = 1920 }) {
  // Modules qui subdivisent chaque jour en AM/PM (2 cellules par jour)
  // → Parc (vehicles), Affaires. Le Planning personnel a 1 cellule par jour.
  const splitsAmPm = module !== 'planning';

  if (view === 'year') {
    // 12 mois. minWidth responsive cote Parc, fixe 120 cote Planning.
    // On harmonise sur la valeur Parc responsive (plus petite ecran etroit).
    const minWidth =
      windowWidth <= 480 ? 80 : windowWidth <= 768 ? 100 : windowWidth <= 1024 ? 120 : 150;
    return `repeat(12, minmax(${minWidth}px, 1fr))`;
  }

  if (view === 'day') {
    // Toujours 2 colonnes (AM / PM)
    return 'repeat(2, 1fr)';
  }

  if (view === 'week') {
    // Parc/Affaires: 14 col (7 jours × 2). Planning: 7 col.
    const factor = splitsAmPm ? 2 : 1;
    const minWidthPerDay =
      windowWidth <= 480 ? 55 : windowWidth <= 768 ? 65 : windowWidth <= 1024 ? 80 : 100;
    // En mode planning (1 col/jour), on double le minWidth pour conserver
    // une lisibilite equivalente a la version splittee.
    const minWidth = splitsAmPm ? Math.round(minWidthPerDay / 2) : minWidthPerDay;
    return `repeat(${7 * factor}, minmax(${minWidth}px, 1fr))`;
  }

  if (view === 'month') {
    // Parc/Affaires: days.length * 2 col. Planning: days.length col.
    const factor = splitsAmPm ? 2 : 1;
    const minWidthPerDay =
      windowWidth <= 480 ? 26 : windowWidth <= 768 ? 32 : windowWidth <= 1024 ? 42 : 55;
    const minWidth = splitsAmPm ? Math.round(minWidthPerDay / 2) : minWidthPerDay;
    return `repeat(${days.length * factor}, minmax(${minWidth}px, 1fr))`;
  }

  // Fallback defensif
  return `repeat(${days.length || 1}, 1fr)`;
}
