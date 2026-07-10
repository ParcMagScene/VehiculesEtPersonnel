// apps/web/src/utils/affaires/fetchAffairesV2.test.js
//
// Ticket : T-P0-09b (Affaires v2 — dogfooding UI lecture).
// Tests unitaires du fetcher paginant v2.

import { describe, expect, it, vi } from 'vitest';

import { fetchAffairesListV2, isFeatureDisabled } from './fetchAffairesV2.js';

describe('affaires/fetchAffairesV2 — isFeatureDisabled', () => {
  it('true si code FEATURE_DISABLED au premier niveau', () => {
    expect(isFeatureDisabled({ code: 'FEATURE_DISABLED' })).toBe(true);
  });

  it('true si code FEATURE_DISABLED dans details', () => {
    expect(isFeatureDisabled({ details: { code: 'FEATURE_DISABLED' } })).toBe(true);
  });

  it('false sinon', () => {
    expect(isFeatureDisabled(null)).toBe(false);
    expect(isFeatureDisabled({})).toBe(false);
    expect(isFeatureDisabled({ code: 'NETWORK' })).toBe(false);
    expect(isFeatureDisabled('boom')).toBe(false);
  });
});

describe('affaires/fetchAffairesV2 — fetchAffairesListV2', () => {
  it('throw si api.v2ListAffaires manquant', async () => {
    await expect(fetchAffairesListV2({})).rejects.toThrow(/v2ListAffaires/);
    await expect(fetchAffairesListV2(null)).rejects.toThrow(/v2ListAffaires/);
  });

  it('page unique : renvoie la liste adaptee shape v1', async () => {
    const api = {
      v2ListAffaires: vi.fn().mockResolvedValue({
        data: {
          items: [
            { id: 1, numero_affaire: 'A-1', date_debut: '2026-01-01' },
            { id: 2, numero_affaire: 'A-2', date_debut: '2026-01-02' },
          ],
          has_more: false,
          next_cursor: null,
          total_returned: 2,
        },
      }),
    };
    const out = await fetchAffairesListV2(api);
    expect(api.v2ListAffaires).toHaveBeenCalledTimes(1);
    expect(api.v2ListAffaires).toHaveBeenCalledWith({ cursor: null, limit: 200 });
    expect(out).toHaveLength(2);
    expect(out[0].numeroAffaire).toBe('A-1');
    expect(out[0].dateDebut).toBe('2026-01-01');
    expect(out[1].numeroAffaire).toBe('A-2');
  });

  it('pages multiples : concatene tous les items et suit next_cursor', async () => {
    const api = {
      v2ListAffaires: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 1, numero_affaire: 'A-1' }],
            has_more: true,
            next_cursor: 'cur-1',
            total_returned: 1,
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 2, numero_affaire: 'A-2' }],
            has_more: true,
            next_cursor: 'cur-2',
            total_returned: 1,
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 3, numero_affaire: 'A-3' }],
            has_more: false,
            next_cursor: null,
            total_returned: 1,
          },
        }),
    };
    const out = await fetchAffairesListV2(api, { limit: 1 });
    expect(api.v2ListAffaires).toHaveBeenCalledTimes(3);
    expect(api.v2ListAffaires).toHaveBeenNthCalledWith(1, { cursor: null, limit: 1 });
    expect(api.v2ListAffaires).toHaveBeenNthCalledWith(2, { cursor: 'cur-1', limit: 1 });
    expect(api.v2ListAffaires).toHaveBeenNthCalledWith(3, { cursor: 'cur-2', limit: 1 });
    expect(out.map((a) => a.numeroAffaire)).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('arrete si next_cursor manquant meme si has_more=true (defensif)', async () => {
    const api = {
      v2ListAffaires: vi.fn().mockResolvedValue({
        data: { items: [{ id: 1, numero_affaire: 'A-1' }], has_more: true, next_cursor: null },
      }),
    };
    const out = await fetchAffairesListV2(api);
    expect(api.v2ListAffaires).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
  });

  it('respecte maxPages : cap et log warn', async () => {
    const api = {
      v2ListAffaires: vi.fn().mockImplementation(async ({ cursor }) => ({
        data: {
          items: [{ id: cursor ? Number(cursor) + 1 : 1, numero_affaire: `A-${cursor ?? '1'}` }],
          has_more: true,
          next_cursor: String((Number(cursor) || 0) + 1),
        },
      })),
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await fetchAffairesListV2(api, { maxPages: 3, limit: 1 });
    expect(api.v2ListAffaires).toHaveBeenCalledTimes(3);
    expect(out).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('propage l erreur reseau pour permettre le fallback amont', async () => {
    const err = new Error('boom');
    const api = { v2ListAffaires: vi.fn().mockRejectedValue(err) };
    await expect(fetchAffairesListV2(api)).rejects.toThrow('boom');
  });
});
