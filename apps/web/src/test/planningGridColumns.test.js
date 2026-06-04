import { describe, expect, it } from 'vitest';

import { computeGridColumnsCss } from '../utils/planningGridColumns';

const days7 = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, i + 1));
const days31 = Array.from({ length: 31 }, (_, i) => new Date(2026, 5, i + 1));
const months12 = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1));

describe('computeGridColumnsCss', () => {
  describe('contrat de coherence banner ↔ grille principale', () => {
    // Contrainte critique : pour les memes inputs, le banner et la grille
    // principale DOIVENT obtenir EXACTEMENT la meme chaine CSS afin que les
    // colonnes soient alignees pixel-perfect. Tout changement qui casse cette
    // egalite recreerait le decalage / vide a droite que ce module corrige.
    it('produit la meme chaine pour Parc et son banner (week, large screen)', () => {
      const inputs = { view: 'week', days: days7, module: 'vehicles', windowWidth: 1920 };
      // Le banner est appele avec activeModule='vehicles' (Parc) → meme module
      expect(computeGridColumnsCss(inputs)).toBe(computeGridColumnsCss(inputs));
    });

    it('produit la meme chaine pour Planning et son banner (week)', () => {
      const inputs = { view: 'week', days: days7, module: 'planning', windowWidth: 1920 };
      expect(computeGridColumnsCss(inputs)).toBe(computeGridColumnsCss(inputs));
    });
  });

  describe('nombre de colonnes', () => {
    it('week Planning : 7 colonnes', () => {
      const css = computeGridColumnsCss({
        view: 'week',
        days: days7,
        module: 'planning',
        windowWidth: 1920,
      });
      expect(css).toMatch(/^repeat\(7,/);
    });

    it('week Parc : 14 colonnes (AM/PM)', () => {
      const css = computeGridColumnsCss({
        view: 'week',
        days: days7,
        module: 'vehicles',
        windowWidth: 1920,
      });
      expect(css).toMatch(/^repeat\(14,/);
    });

    it('month Planning : days.length colonnes', () => {
      const css = computeGridColumnsCss({
        view: 'month',
        days: days31,
        module: 'planning',
        windowWidth: 1920,
      });
      expect(css).toMatch(/^repeat\(31,/);
    });

    it('month Parc : days.length × 2 colonnes', () => {
      const css = computeGridColumnsCss({
        view: 'month',
        days: days31,
        module: 'vehicles',
        windowWidth: 1920,
      });
      expect(css).toMatch(/^repeat\(62,/);
    });

    it('year : 12 colonnes (Parc et Planning)', () => {
      const cssParc = computeGridColumnsCss({
        view: 'year',
        days: months12,
        module: 'vehicles',
        windowWidth: 1920,
      });
      const cssPlanning = computeGridColumnsCss({
        view: 'year',
        days: months12,
        module: 'planning',
        windowWidth: 1920,
      });
      expect(cssParc).toMatch(/^repeat\(12,/);
      expect(cssPlanning).toMatch(/^repeat\(12,/);
    });

    it('day : toujours 2 colonnes', () => {
      expect(
        computeGridColumnsCss({ view: 'day', days: [], module: 'vehicles', windowWidth: 1920 }),
      ).toBe('repeat(2, 1fr)');
    });
  });

  describe('minmax responsive', () => {
    it('minWidth diminue sur petit ecran (mobile)', () => {
      const wide = computeGridColumnsCss({
        view: 'month',
        days: days31,
        module: 'vehicles',
        windowWidth: 1920,
      });
      const mobile = computeGridColumnsCss({
        view: 'month',
        days: days31,
        module: 'vehicles',
        windowWidth: 400,
      });
      const wideMin = parseInt(wide.match(/minmax\((\d+)px/)[1], 10);
      const mobileMin = parseInt(mobile.match(/minmax\((\d+)px/)[1], 10);
      expect(mobileMin).toBeLessThan(wideMin);
    });

    it('inclut toujours minmax avec 1fr (permet scroll quand necessaire)', () => {
      const css = computeGridColumnsCss({
        view: 'week',
        days: days7,
        module: 'planning',
        windowWidth: 1920,
      });
      expect(css).toMatch(/minmax\(\d+px, 1fr\)/);
    });
  });
});
