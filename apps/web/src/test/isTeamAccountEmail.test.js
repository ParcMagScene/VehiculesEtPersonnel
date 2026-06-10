import { describe, expect, it } from 'vitest';

import { isTeamAccountEmail } from '../contexts/AuthContext.jsx';

describe('isTeamAccountEmail', () => {
  it('détecte commun@magsav.com (insensible à la casse / espaces)', () => {
    expect(isTeamAccountEmail('commun@magsav.com')).toBe(true);
    expect(isTeamAccountEmail('  Commun@MagSav.com  ')).toBe(true);
    expect(isTeamAccountEmail('COMMUN@MAGSAV.COM')).toBe(true);
  });

  it('rejette les autres comptes', () => {
    expect(isTeamAccountEmail('admin@magsav.com')).toBe(false);
    expect(isTeamAccountEmail('user@example.com')).toBe(false);
  });

  it('rejette les valeurs vides ou null', () => {
    expect(isTeamAccountEmail('')).toBe(false);
    expect(isTeamAccountEmail(null)).toBe(false);
    expect(isTeamAccountEmail(undefined)).toBe(false);
  });
});
