import { describe, expect, it } from 'vitest';

import { formatReservationDisplayName, getReservationDisplayName } from './reservationDisplayName';

describe('formatReservationDisplayName', () => {
  it('retire le numéro d’affaire et met le nom en casse titre française', () => {
    expect(formatReservationDisplayName('festival lumière 26 Live Up af33891')).toBe(
      'Festival Lumière 26 Live Up',
    );
  });

  it('retire les variantes d’espacement et de casse du numéro d’affaire', () => {
    expect(formatReservationDisplayName('festival AF 34078')).toBe('Festival');
    expect(formatReservationDisplayName('festival af34078')).toBe('Festival');
    expect(formatReservationDisplayName('festival AF34078')).toBe('Festival');
  });

  it('retire un séparateur final laissé par le numéro d’affaire', () => {
    expect(formatReservationDisplayName('festival lumière - AF 34078')).toBe('Festival Lumière');
  });

  it('renvoie une chaîne vide si le nom ne contient qu’un numéro d’affaire', () => {
    expect(formatReservationDisplayName('AF34078')).toBe('');
  });

  it('préfère le nom de prestation saisi et utilise le client seulement en fallback', () => {
    expect(getReservationDisplayName('festival lumière', 'Client exemple')).toBe(
      'Festival Lumière',
    );
    expect(getReservationDisplayName('', 'client exemple')).toBe('Client Exemple');
  });

  it('préserve la casse mixte intentionnelle des marques', () => {
    expect(formatReservationDisplayName('eM@g scène')).toBe('eM@g Scène');
  });
});
