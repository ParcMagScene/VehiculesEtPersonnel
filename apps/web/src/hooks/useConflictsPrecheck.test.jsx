// apps/web/src/hooks/useConflictsPrecheck.test.js
// Ticket : T-P1-05b.

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/conflicts/checkPersonConflicts.js', () => ({
  checkPersonConflictsUnified: vi.fn(),
}));

vi.mock('../utils/conflicts/v2Adapters.js', async () => {
  const actual = await vi.importActual('../utils/conflicts/v2Adapters.js');
  return {
    ...actual,
    readConflictsV2ClientFlag: vi.fn(() => false),
  };
});

import { checkPersonConflictsUnified } from '../utils/conflicts/checkPersonConflicts.js';
import { readConflictsV2ClientFlag } from '../utils/conflicts/v2Adapters.js';
import { useConflictsPrecheck } from './useConflictsPrecheck.js';

const api = {};
const baseParams = {
  personId: 5,
  startDate: '2026-08-01',
  endDate: '2026-08-03',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useConflictsPrecheck', () => {
  it('enabled=false : state neutre, aucun appel', async () => {
    const { result } = renderHook(() =>
      useConflictsPrecheck(api, baseParams, { enabled: false, debounceMs: 0 }),
    );
    expect(result.current.available).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(checkPersonConflictsUnified).not.toHaveBeenCalled();
  });

  it('available=false quand flag off (helper renvoie null)', async () => {
    readConflictsV2ClientFlag.mockReturnValue(false);
    checkPersonConflictsUnified.mockResolvedValue(null);
    const { result } = renderHook(() => useConflictsPrecheck(api, baseParams, { debounceMs: 0 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(false);
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.hasConflict).toBe(false);
  });

  it('available=true + conflits quand v2 repond', async () => {
    readConflictsV2ClientFlag.mockReturnValue(true);
    checkPersonConflictsUnified.mockResolvedValue({
      conflicts: [{ source: 'missions', entityId: 12 }],
      hasConflict: true,
      count: 1,
    });
    const { result } = renderHook(() => useConflictsPrecheck(api, baseParams, { debounceMs: 0 }));
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.hasConflict).toBe(true);
    expect(result.current.count).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it('useV2Override force le mode', async () => {
    readConflictsV2ClientFlag.mockReturnValue(false); // flag off
    checkPersonConflictsUnified.mockResolvedValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
    });
    renderHook(() => useConflictsPrecheck(api, baseParams, { debounceMs: 0, useV2Override: true }));
    await waitFor(() =>
      expect(checkPersonConflictsUnified).toHaveBeenCalledWith(api, baseParams, { useV2: true }),
    );
  });

  it('cleanup annule les updates apres unmount', async () => {
    readConflictsV2ClientFlag.mockReturnValue(true);
    let resolveFn;
    checkPersonConflictsUnified.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useConflictsPrecheck(api, baseParams, { debounceMs: 0 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(true));
    unmount();
    // Resoudre APRES unmount ne doit pas provoquer d'erreur
    await act(async () => {
      resolveFn({ conflicts: [], hasConflict: false, count: 0 });
    });
  });
});
