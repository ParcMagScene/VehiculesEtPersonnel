/**
 * Garde anti-regression du fix d'alignement banner Google Calendar
 * (commit 1283ca10 puis e6430a4f).
 *
 * Contexte : `.calendar-banner` est un flex container en direction row,
 * dont les enfants principaux sont `.banner-vehicle-column` (largeur fixe)
 * et `.banner-scroll-area` (doit prendre le reste). Une regle CSS qui
 * pose `flex: 0 0 auto` sur `.banner-scroll-area` (par exemple en mode
 * compact) annule le `flex: 1` de base et fait dimensionner le scroller
 * a la largeur intrinseque de son contenu (~1977px) au lieu de l'espace
 * restant (~1707px). Resultat : la bannere est plus large que la grille
 * du Planning et les colonnes de jours sont decalees.
 *
 * Ce test lit le CSS source et echoue si une regle de ce type reapparait.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const cssPath = resolve(__dirname, '../components/vehicles/GoogleCalendarBanner.css');
const css = readFileSync(cssPath, 'utf8');

/**
 * Extrait le bloc CSS ciblant un selecteur donne. Renvoie '' si absent.
 * Comparaison stricte sur la chaine du selecteur (espaces normalises).
 */
function extractBlock(source, selector) {
  // On purge les commentaires /* ... */ avant le scan : un commentaire
  // peut tres bien contenir des fragments comme `flex: 0 0 auto` (ex.
  // l'avertissement anti-regression dans GoogleCalendarBanner.css) qui
  // produiraient des faux positifs.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const normalized = selector.replace(/\s+/g, ' ').trim();
  // On scanne les declarations { ... } et on garde celle dont la liste
  // de selecteurs (avant le {) contient `normalized` parmi ses items.
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(stripped)) !== null) {
    const selectors = match[1].split(',').map((s) => s.replace(/\s+/g, ' ').trim());
    if (selectors.includes(normalized)) {
      return match[2];
    }
  }
  return '';
}

describe('GoogleCalendarBanner.css — garde anti-regression alignement', () => {
  it('le bloc compact .banner-scroll-area ne pose pas flex: 0 0 auto', () => {
    const block = extractBlock(css, '.google-calendar-banner-grid.compact .banner-scroll-area');
    expect(block).not.toBe('');
    // Toute declaration `flex` avec premier basis 0 et grow/shrink null
    // (ou la forme courte `flex: none`) reproduit le bug. On rejette
    // explicitement les variantes connues.
    expect(block).not.toMatch(/flex\s*:\s*0\s+0\s+auto/);
    expect(block).not.toMatch(/flex\s*:\s*none/);
    // Sanity : le bloc reste un bloc compact valide (overflow-y auto).
    expect(block).toMatch(/overflow-y\s*:\s*auto/);
  });

  it('aucune regle ne fixe flex-basis: auto en plus de flex-grow: 0 sur le scroller compact', () => {
    const block = extractBlock(css, '.google-calendar-banner-grid.compact .banner-scroll-area');
    // Combinaisons en proprietes longues qui reproduisent le bug.
    const hasGrowZero = /flex-grow\s*:\s*0\b/.test(block);
    const hasBasisAuto = /flex-basis\s*:\s*auto\b/.test(block);
    expect(hasGrowZero && hasBasisAuto).toBe(false);
  });
});
