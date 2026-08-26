// apps/web/src/utils/leaves/fetchLeaveCalculation.test.js
//
// Ticket : T-P1-04b (Leaves v2 — dogfooding UI calcul).

import { describe, expect, it, vi } from 'vitest';

import { fetchLeaveCalculationUnified, isFeatureDisabled } from './fetchLeaveCalculation.js';

describe('leaves/fetchLeaveCalculation — isFeatureDisabled', () => {
  it('true si code FEATURE_DISABLED niveau 1 ou nested', () => {
    expect(isFeatureDisabled({ code: 'FEATURE_DISABLED' })).toBe(true);
    expect(isFeatureDisabled({ details: { code: 'FEATURE_DISABLED' } })).toBe(true);
  });

  it('false sinon', () => {
    expect(isFeatureDisabled(null)).toBe(false);
    expect(isFeatureDisabled({})).toBe(false);
    expect(isFeatureDisabled({ code: 'NETWORK' })).toBe(false);
    expect(isFeatureDisabled('boom')).toBe(false);
  });
});

describe('leaves/fetchLeaveCalculation — fetchLeaveCalculationUnified', () => {
  const payload = {
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    startPeriod: 'AM',
    endPeriod: 'PM',
    leaveType: 'conge_paye',
  };

  it('appelle v1 quand useV2 off', async () => {
    const api = {
      calculateLeaveWorkingDays: vi.fn().mockResolvedValue({ workingDays: 3 }),
      v2CalculateLeaves: vi.fn(),
    };
    const out = await fetchLeaveCalculationUnified(api, payload);
    expect(out).toEqual({ workingDays: 3 });
    expect(api.calculateLeaveWorkingDays).toHaveBeenCalledWith(payload);
    expect(api.v2CalculateLeaves).not.toHaveBeenCalled();
  });

  it('appelle v2 quand useV2 on et retourne data', async () => {
    const api = {
      calculateLeaveWorkingDays: vi.fn(),
      v2CalculateLeaves: vi.fn().mockResolvedValue({
        success: true,
        data: { workingDays: 5, warnings: [] },
        meta: {},
      }),
    };
    const out = await fetchLeaveCalculationUnified(api, payload, { useV2: true });
    expect(out).toEqual({ workingDays: 5, warnings: [] });
    expect(api.v2CalculateLeaves).toHaveBeenCalledWith(payload);
    expect(api.calculateLeaveWorkingDays).not.toHaveBeenCalled();
  });

  it('fallback v1 silencieux si v2 renvoie FEATURE_DISABLED', async () => {
    const err = new Error('feature off');
    err.code = 'FEATURE_DISABLED';
    const api = {
      calculateLeaveWorkingDays: vi.fn().mockResolvedValue({ workingDays: 3 }),
      v2CalculateLeaves: vi.fn().mockRejectedValue(err),
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await fetchLeaveCalculationUnified(api, payload, { useV2: true });
    expect(out).toEqual({ workingDays: 3 });
    expect(api.calculateLeaveWorkingDays).toHaveBeenCalledTimes(1);
    // FEATURE_DISABLED : silencieux (aucun warn)
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('fallback v1 avec warn si erreur reseau v2', async () => {
    const api = {
      calculateLeaveWorkingDays: vi.fn().mockResolvedValue({ workingDays: 3 }),
      v2CalculateLeaves: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await fetchLeaveCalculationUnified(api, payload, { useV2: true });
    expect(out).toEqual({ workingDays: 3 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[leaves v2]'), expect.any(Error));
    warnSpy.mockRestore();
  });

  it('fallback v1 si v2 renvoie payload invalide (data null)', async () => {
    const api = {
      calculateLeaveWorkingDays: vi.fn().mockResolvedValue({ workingDays: 3 }),
      v2CalculateLeaves: vi.fn().mockResolvedValue({ success: true, data: null }),
    };
    const out = await fetchLeaveCalculationUnified(api, payload, { useV2: true });
    expect(out).toEqual({ workingDays: 3 });
    expect(api.calculateLeaveWorkingDays).toHaveBeenCalledTimes(1);
  });

  it('fallback v1 si v2 method absent (client non enregistre)', async () => {
    const api = {
      calculateLeaveWorkingDays: vi.fn().mockResolvedValue({ workingDays: 3 }),
    };
    const out = await fetchLeaveCalculationUnified(api, payload, { useV2: true });
    expect(out).toEqual({ workingDays: 3 });
  });
});
