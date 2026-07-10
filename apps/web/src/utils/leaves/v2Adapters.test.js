// apps/web/src/utils/leaves/v2Adapters.test.js
//
// Ticket : T-P1-04b (Leaves v2 — dogfooding UI calcul).

import { describe, expect, it } from 'vitest';

import { adaptV2CalculationToV1, readLeavesV2ClientFlag } from './v2Adapters.js';

describe('leaves/v2Adapters — adaptV2CalculationToV1', () => {
  it('renvoie null pour non-objet ou payload sans data', () => {
    expect(adaptV2CalculationToV1(null)).toBeNull();
    expect(adaptV2CalculationToV1(undefined)).toBeNull();
    expect(adaptV2CalculationToV1('nope')).toBeNull();
    expect(adaptV2CalculationToV1({})).toBeNull();
    expect(adaptV2CalculationToV1({ data: null })).toBeNull();
    expect(adaptV2CalculationToV1({ data: 42 })).toBeNull();
  });

  it('passe l objet data tel quel (camelCase deja)', () => {
    const input = {
      success: true,
      data: {
        workingDays: 5,
        holidaysInPeriod: [],
        warnings: [],
        referencePeriod: { start: '2026-06-01', end: '2027-05-31', label: '2026/2027' },
      },
      meta: { generated_at: '2026-07-10T10:00:00.000Z' },
    };
    const out = adaptV2CalculationToV1(input);
    expect(out).toBe(input.data);
    expect(out.workingDays).toBe(5);
  });
});

describe('leaves/v2Adapters — readLeavesV2ClientFlag', () => {
  it('true pour 1 / true / on / yes (case-insensitive)', () => {
    expect(readLeavesV2ClientFlag({ VITE_FEATURE_V2_LEAVES: '1' })).toBe(true);
    expect(readLeavesV2ClientFlag({ VITE_FEATURE_V2_LEAVES: 'true' })).toBe(true);
    expect(readLeavesV2ClientFlag({ VITE_FEATURE_V2_LEAVES: 'ON' })).toBe(true);
    expect(readLeavesV2ClientFlag({ VITE_FEATURE_V2_LEAVES: 'Yes' })).toBe(true);
  });

  it('false pour 0 / off / no / undefined / autre', () => {
    expect(readLeavesV2ClientFlag({ VITE_FEATURE_V2_LEAVES: '0' })).toBe(false);
    expect(readLeavesV2ClientFlag({ VITE_FEATURE_V2_LEAVES: 'off' })).toBe(false);
    expect(readLeavesV2ClientFlag({ VITE_FEATURE_V2_LEAVES: 'no' })).toBe(false);
    expect(readLeavesV2ClientFlag({})).toBe(false);
    expect(readLeavesV2ClientFlag()).toBe(false);
  });
});
