import { describe, it, expect } from 'vitest';
import {
  mapEventToSection,
  normalizeSection,
  extractAffaireNum,
  addDays,
  formatDateShort,
  getMonday,
  getWeekDays,
  SECTION_ALIASES,
  DAYS_FR,
} from '../components/planning/planningConstants';

describe('planningConstants', () => {
  // ═══ normalizeSection ═══
  describe('normalizeSection', () => {
    it('mappe enlevement → courses', () => {
      expect(normalizeSection('enlevement')).toBe('courses');
    });
    it('mappe retour → courses', () => {
      expect(normalizeSection('retour')).toBe('courses');
    });
    it('mappe recuperation → courses', () => {
      expect(normalizeSection('recuperation')).toBe('courses');
    });
    it('retourne la section inchangee si pas alias', () => {
      expect(normalizeSection('rdv')).toBe('rdv');
      expect(normalizeSection('depart')).toBe('depart');
      expect(normalizeSection('manual')).toBe('manual');
    });
  });

  // ═══ extractAffaireNum ═══
  describe('extractAffaireNum', () => {
    it('extrait AF suivi de chiffres', () => {
      expect(extractAffaireNum('Livraison AF1234 - bureau')).toBe('AF1234');
    });
    it('extrait avec espace entre AF et chiffres', () => {
      expect(extractAffaireNum('AF 567 retour')).toBe('AF567');
    });
    it('retourne en majuscules', () => {
      expect(extractAffaireNum('af1234')).toBe('AF1234');
    });
    it('retourne null si pas de match', () => {
      expect(extractAffaireNum('Livraison bureau')).toBeNull();
    });
    it('retourne null pour texte vide/null', () => {
      expect(extractAffaireNum('')).toBeNull();
      expect(extractAffaireNum(null)).toBeNull();
      expect(extractAffaireNum(undefined)).toBeNull();
    });
    it('extrait le premier match', () => {
      expect(extractAffaireNum('AF100 et AF200')).toBe('AF100');
    });
  });

  // ═══ mapEventToSection ═══
  describe('mapEventToSection', () => {
    it('mappe preparation/location → prep_locations', () => {
      expect(mapEventToSection({ type: 'preparation', category: 'location' })).toBe(
        'prep_locations',
      );
    });
    it('mappe preparation/prestation → prep_prestations', () => {
      expect(mapEventToSection({ type: 'preparation', category: 'prestation' })).toBe(
        'prep_prestations',
      );
    });
    it('mappe preparation/vente → prep_ventes', () => {
      expect(mapEventToSection({ type: 'preparation', category: 'vente' })).toBe('prep_ventes');
    });
    it('mappe preparation/installation → prep_installations', () => {
      expect(mapEventToSection({ type: 'preparation', category: 'installation' })).toBe(
        'prep_installations',
      );
    });
    it('mappe preparation sans catégorie → prep_locations (défaut)', () => {
      expect(mapEventToSection({ type: 'preparation', category: 'unknown' })).toBe(
        'prep_locations',
      );
    });
    it('mappe enlevement → courses', () => {
      expect(mapEventToSection({ type: 'enlevement' })).toBe('courses');
    });
    it('mappe depart → depart', () => {
      expect(mapEventToSection({ type: 'depart' })).toBe('depart');
    });
    it('mappe livraison → courses', () => {
      expect(mapEventToSection({ type: 'livraison' })).toBe('courses');
    });
    it('mappe retour → courses', () => {
      expect(mapEventToSection({ type: 'retour' })).toBe('courses');
    });
    it('mappe installation → installation', () => {
      expect(mapEventToSection({ type: 'installation' })).toBe('installation');
    });
    it('mappe type inconnu → evenements', () => {
      expect(mapEventToSection({ type: 'xyz' })).toBe('evenements');
    });
  });

  // ═══ addDays ═══
  describe('addDays', () => {
    it('ajoute des jours', () => {
      expect(addDays('2026-04-10', 3)).toBe('2026-04-13');
    });
    it('gère le passage de mois', () => {
      expect(addDays('2026-04-29', 5)).toBe('2026-05-04');
    });
    it('soustrait avec valeur négative', () => {
      expect(addDays('2026-04-10', -2)).toBe('2026-04-08');
    });
  });

  // ═══ formatDateShort ═══
  describe('formatDateShort', () => {
    it('retourne — pour valeur vide', () => {
      expect(formatDateShort('')).toBe('—');
      expect(formatDateShort(null)).toBe('—');
      expect(formatDateShort(undefined)).toBe('—');
    });
    it('formate une date en français', () => {
      const result = formatDateShort('2026-04-15');
      // Format: "mer. 15 avr."
      expect(result).toContain('15');
      expect(result).toContain('avr');
    });
  });

  // ═══ getMonday ═══
  describe('getMonday', () => {
    it('retourne le lundi de la semaine', () => {
      // 15 avril 2026 = mercredi
      expect(getMonday('2026-04-15')).toBe('2026-04-13');
    });
    it('retourne lui-même si déjà lundi', () => {
      expect(getMonday('2026-04-13')).toBe('2026-04-13');
    });
    it('gère le dimanche', () => {
      // 19 avril 2026 = dimanche → lundi 13 avril
      expect(getMonday('2026-04-19')).toBe('2026-04-13');
    });
  });

  // ═══ getWeekDays ═══
  describe('getWeekDays', () => {
    it('retourne 7 jours commençant par lundi', () => {
      const days = getWeekDays('2026-04-15');
      expect(days).toHaveLength(7);
      expect(days[0]).toBe('2026-04-13'); // lundi
      expect(days[6]).toBe('2026-04-19'); // dimanche
    });
  });

  // ═══ Constantes ═══
  describe('constantes', () => {
    it('SECTION_ALIASES contient les bons alias', () => {
      expect(SECTION_ALIASES).toEqual({
        enlevement: 'courses',
        retour: 'courses',
        recuperation: 'courses',
      });
    });
    it('DAYS_FR contient 7 jours', () => {
      expect(DAYS_FR).toHaveLength(7);
      expect(DAYS_FR[0]).toBe('Dimanche');
      expect(DAYS_FR[1]).toBe('Lundi');
    });
  });
});
