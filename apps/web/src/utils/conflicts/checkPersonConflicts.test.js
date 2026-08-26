// apps/web/src/utils/conflicts/checkPersonConflicts.test.js
// Ticket : T-P1-05b.

import { describe, expect, it, vi } from 'vitest';

import { checkPersonConflictsUnified, isFeatureDisabled } from './checkPersonConflicts.js';

describe('conflicts/checkPersonConflicts — isFeatureDisabled', () => {
  it('true si code FEATURE_DISABLED', () => {
    expect(isFeatureDisabled({ code: 'FEATURE_DISABLED' })).toBe(true);
    expect(isFeatureDisabled({ details: { code: 'FEATURE_DISABLED' } })).toBe(true);
  });
  it('false sinon', () => {
    expect(isFeatureDisabled(null)).toBe(false);
    expect(isFeatureDisabled({ code: 'NETWORK' })).toBe(false);
  });
});

describe('conflicts/checkPersonConflicts — checkPersonConflictsUnified', () => {
  const baseParams = {
    personId: 5,
    startDate: '2026-08-01',
    endDate: '2026-08-03',
  };

  it('null si useV2 off', async () => {
    const api = { v2CheckConflicts: vi.fn() };
    const out = await checkPersonConflictsUnified(api, baseParams);
    expect(out).toBeNull();
    expect(api.v2CheckConflicts).not.toHaveBeenCalled();
  });

  it('null si methode client absente', async () => {
    const out = await checkPersonConflictsUnified({}, baseParams, { useV2: true });
    expect(out).toBeNull();
  });

  it('null si params obligatoires manquants', async () => {
    const api = { v2CheckConflicts: vi.fn() };
    expect(await checkPersonConflictsUnified(api, {}, { useV2: true })).toBeNull();
    expect(await checkPersonConflictsUnified(api, { personId: 5 }, { useV2: true })).toBeNull();
    expect(api.v2CheckConflicts).not.toHaveBeenCalled();
  });

  it('appelle v2 avec body snake_case et retourne shape camelCase', async () => {
    const api = {
      v2CheckConflicts: vi.fn().mockResolvedValue({
        data: {
          conflicts: [{ source: 'missions', entity_type: 'mission', entity_id: 42 }],
          has_conflict: true,
          count: 1,
        },
      }),
    };
    const out = await checkPersonConflictsUnified(
      api,
      { ...baseParams, startPeriod: 'AM', endPeriod: 'PM' },
      { useV2: true },
    );
    expect(api.v2CheckConflicts).toHaveBeenCalledWith({
      person_id: 5,
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      start_period: 'AM',
      end_period: 'PM',
    });
    expect(out).toEqual({
      conflicts: [
        {
          source: 'missions',
          entityType: 'mission',
          entityId: 42,
          date: null,
          period: null,
          label: null,
          startDate: null,
          endDate: null,
        },
      ],
      hasConflict: true,
      count: 1,
    });
  });

  it('serialise exclude camelCase -> snake_case', async () => {
    const api = {
      v2CheckConflicts: vi
        .fn()
        .mockResolvedValue({ data: { conflicts: [], has_conflict: false, count: 0 } }),
    };
    await checkPersonConflictsUnified(
      api,
      {
        ...baseParams,
        exclude: [{ entityType: 'mission', entityId: 12 }],
      },
      { useV2: true },
    );
    expect(api.v2CheckConflicts).toHaveBeenCalledWith(
      expect.objectContaining({
        exclude: [{ entity_type: 'mission', entity_id: 12 }],
      }),
    );
  });

  it('null silencieux sur FEATURE_DISABLED (pas de warn)', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2CheckConflicts: vi.fn().mockRejectedValue(err) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await checkPersonConflictsUnified(api, baseParams, { useV2: true });
    expect(out).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('null + warn sur erreur reseau', async () => {
    const api = { v2CheckConflicts: vi.fn().mockRejectedValue(new Error('boom')) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await checkPersonConflictsUnified(api, baseParams, { useV2: true });
    expect(out).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[conflicts v2]'),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
