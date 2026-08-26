// apps/web/src/utils/sav/fetchSavParts.test.js
// Ticket : T-P1-07b.

import { describe, expect, it, vi } from 'vitest';

import {
  addSavPartUnified,
  fetchSavPartsUnified,
  isFeatureDisabled,
  transitionSavTicketUnified,
  updateSavPartStatusUnified,
} from './fetchSavParts.js';

describe('sav/fetchSavParts — isFeatureDisabled', () => {
  it('true si FEATURE_DISABLED', () => {
    expect(isFeatureDisabled({ code: 'FEATURE_DISABLED' })).toBe(true);
  });
  it('false sinon', () => {
    expect(isFeatureDisabled(null)).toBe(false);
    expect(isFeatureDisabled({})).toBe(false);
  });
});

describe('sav/fetchSavParts — fetchSavPartsUnified', () => {
  it('null si useV2 off ou id invalide ou methode absente', async () => {
    const api = { v2ListSavParts: vi.fn() };
    expect(await fetchSavPartsUnified(api, 5)).toBeNull();
    expect(await fetchSavPartsUnified(api, 0, { useV2: true })).toBeNull();
    expect(await fetchSavPartsUnified({}, 5, { useV2: true })).toBeNull();
    expect(api.v2ListSavParts).not.toHaveBeenCalled();
  });
  it('normalise la reponse v2', async () => {
    const api = {
      v2ListSavParts: vi.fn().mockResolvedValue({
        data: { parts: [{ id: 1, part_name: 'A' }], total: 1 },
      }),
    };
    const out = await fetchSavPartsUnified(api, 5, { useV2: true });
    expect(api.v2ListSavParts).toHaveBeenCalledWith(5);
    expect(out.parts[0].partName).toBe('A');
  });
  it('null silencieux FEATURE_DISABLED', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2ListSavParts: vi.fn().mockRejectedValue(err) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await fetchSavPartsUnified(api, 5, { useV2: true })).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('sav/fetchSavParts — addSavPartUnified', () => {
  it('null si useV2 off ou id invalide', async () => {
    const api = { v2AddSavPart: vi.fn() };
    expect(await addSavPartUnified(api, 5, { partName: 'A' })).toBeNull();
    expect(await addSavPartUnified(api, 0, { partName: 'A' }, { useV2: true })).toBeNull();
  });
  it('serialise body camelCase -> snake_case + retourne piece', async () => {
    const api = {
      v2AddSavPart: vi.fn().mockResolvedValue({
        data: { part: { id: 10, ticket_id: 5, part_name: 'A', status: 'requested' } },
      }),
    };
    const out = await addSavPartUnified(
      api,
      5,
      { partName: 'A', unitPrice: 3.5, quantity: 2 },
      { useV2: true },
    );
    expect(api.v2AddSavPart).toHaveBeenCalledWith(5, {
      part_name: 'A',
      part_reference: null,
      quantity: 2,
      unit_price: 3.5,
      supplier: null,
      notes: null,
    });
    expect(out.id).toBe(10);
    expect(out.partName).toBe('A');
  });
  it('accepte body snake_case directement', async () => {
    const api = {
      v2AddSavPart: vi.fn().mockResolvedValue({ data: { part: { id: 1, part_name: 'B' } } }),
    };
    await addSavPartUnified(api, 5, { part_name: 'B' }, { useV2: true });
    expect(api.v2AddSavPart).toHaveBeenCalledWith(5, expect.objectContaining({ part_name: 'B' }));
  });
});

describe('sav/fetchSavParts — updateSavPartStatusUnified', () => {
  it('null si useV2 off ou id/status invalides', async () => {
    const api = { v2UpdateSavPartStatus: vi.fn() };
    expect(await updateSavPartStatusUnified(api, 5, 'ordered')).toBeNull();
    expect(await updateSavPartStatusUnified(api, 0, 'ordered', { useV2: true })).toBeNull();
    expect(await updateSavPartStatusUnified(api, 5, '', { useV2: true })).toBeNull();
    expect(api.v2UpdateSavPartStatus).not.toHaveBeenCalled();
  });
  it('appelle v2 et retourne piece', async () => {
    const api = {
      v2UpdateSavPartStatus: vi
        .fn()
        .mockResolvedValue({ data: { part: { id: 5, status: 'ordered' } } }),
    };
    const out = await updateSavPartStatusUnified(api, 5, 'ordered', { useV2: true });
    expect(api.v2UpdateSavPartStatus).toHaveBeenCalledWith(5, 'ordered');
    expect(out.status).toBe('ordered');
  });
});

describe('sav/fetchSavParts — transitionSavTicketUnified', () => {
  it('null si useV2 off ou id/status invalides', async () => {
    const api = { v2TransitionSavTicket: vi.fn() };
    expect(await transitionSavTicketUnified(api, 5, 'closed')).toBeNull();
    expect(await transitionSavTicketUnified(api, 0, 'closed', { useV2: true })).toBeNull();
    expect(await transitionSavTicketUnified(api, 5, '', { useV2: true })).toBeNull();
  });
  it('appelle v2 et passthrough data', async () => {
    const api = {
      v2TransitionSavTicket: vi.fn().mockResolvedValue({
        data: { ticket: { id: 5 }, previous_status: 'open', new_status: 'in_progress' },
      }),
    };
    const out = await transitionSavTicketUnified(api, 5, 'in_progress', { useV2: true });
    expect(api.v2TransitionSavTicket).toHaveBeenCalledWith(5, 'in_progress');
    expect(out.new_status).toBe('in_progress');
  });
  it('null silencieux FEATURE_DISABLED', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2TransitionSavTicket: vi.fn().mockRejectedValue(err) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await transitionSavTicketUnified(api, 5, 'in_progress', { useV2: true })).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
