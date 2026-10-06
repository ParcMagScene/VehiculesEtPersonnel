import { describe, expect, it } from 'vitest';

import { normalizeTaskTitle } from './normalizeTaskTitle';

describe('normalizeTaskTitle', () => {
  it('retire les préfixes opérationnels, le numéro d’affaire et capitalise', () => {
    expect(normalizeTaskTitle('Liv afterworks opéra af33891')).toBe('Afterworks Opéra');
    expect(normalizeTaskTitle('Récup eos Scenetech')).toBe('EOS Scenetech');
  });

  it('nettoie les actions répétées et développe les abréviations loc', () => {
    expect(normalizeTaskTitle('Retour porteur loc + récup tracteur loc')).toBe(
      'Porteur location + Tracteur location',
    );
  });

  it('retire les numéros d’affaire génériques avec espace et toute casse', () => {
    expect(normalizeTaskTitle('Festival AF 34078')).toBe('Festival');
    expect(normalizeTaskTitle('Festival af34078')).toBe('Festival');
    expect(normalizeTaskTitle('Festival AF34078')).toBe('Festival');
  });

  it('préserve la casse mixte et renvoie une chaîne vide sans nom utile', () => {
    expect(normalizeTaskTitle('festival eM@g live up')).toBe('Festival eM@g Live Up');
    expect(normalizeTaskTitle('Récup AF34078')).toBe('');
  });
});
