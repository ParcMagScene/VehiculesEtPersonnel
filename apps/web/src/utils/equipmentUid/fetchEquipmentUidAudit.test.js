// apps/web/src/utils/equipmentUid/fetchEquipmentUidAudit.test.js
// Ticket : T-P1-06b.

import { describe, expect, it, vi } from 'vitest';

import {
  fetchEquipmentUidAuditUnified,
  isFeatureDisabled,
  regenerateEquipmentUidUnified,
} from './fetchEquipmentUidAudit.js';

describe('equipmentUid/fetchEquipmentUidAudit — isFeatureDisabled', () => {
  it('true si FEATURE_DISABLED', () => {
    expect(isFeatureDisabled({ code: 'FEATURE_DISABLED' })).toBe(true);
    expect(isFeatureDisabled({ details: { code: 'FEATURE_DISABLED' } })).toBe(true);
  });
  it('false sinon', () => {
    expect(isFeatureDisabled(null)).toBe(false);
    expect(isFeatureDisabled({})).toBe(false);
  });
});

describe('equipmentUid/fetchEquipmentUidAudit — fetchEquipmentUidAuditUnified', () => {
  it('null si useV2 off', async () => {
    const api = { v2EquipmentUidAudit: vi.fn() };
    expect(await fetchEquipmentUidAuditUnified(api)).toBeNull();
    expect(api.v2EquipmentUidAudit).not.toHaveBeenCalled();
  });
  it('null si methode absente', async () => {
    expect(await fetchEquipmentUidAuditUnified({}, { useV2: true })).toBeNull();
  });
  it('normalise la reponse v2', async () => {
    const api = {
      v2EquipmentUidAudit: vi.fn().mockResolvedValue({
        data: {
          equipment_total: 10,
          equipment_with_uid: 10,
          equipment_without_uid: 0,
          equipment_with_serial: 8,
          duplicate_serials: [],
          duplicate_uids: [],
          verdict: 'OK',
        },
      }),
    };
    const out = await fetchEquipmentUidAuditUnified(api, { useV2: true });
    expect(out).toMatchObject({ equipmentTotal: 10, verdict: 'OK' });
  });
  it('null silencieux FEATURE_DISABLED', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2EquipmentUidAudit: vi.fn().mockRejectedValue(err) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await fetchEquipmentUidAuditUnified(api, { useV2: true });
    expect(out).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
  it('null + warn sur erreur reseau', async () => {
    const api = { v2EquipmentUidAudit: vi.fn().mockRejectedValue(new Error('boom')) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await fetchEquipmentUidAuditUnified(api, { useV2: true });
    expect(out).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[equipment-uid v2]'),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});

describe('equipmentUid/fetchEquipmentUidAudit — regenerateEquipmentUidUnified', () => {
  it('null si useV2 off', async () => {
    const api = { v2RegenerateEquipmentUid: vi.fn() };
    expect(await regenerateEquipmentUidUnified(api, 5)).toBeNull();
    expect(api.v2RegenerateEquipmentUid).not.toHaveBeenCalled();
  });
  it('null si id invalide', async () => {
    const api = { v2RegenerateEquipmentUid: vi.fn() };
    expect(await regenerateEquipmentUidUnified(api, 0, { useV2: true })).toBeNull();
    expect(await regenerateEquipmentUidUnified(api, 'abc', { useV2: true })).toBeNull();
    expect(api.v2RegenerateEquipmentUid).not.toHaveBeenCalled();
  });
  it('appelle v2 avec reason', async () => {
    const api = {
      v2RegenerateEquipmentUid: vi.fn().mockResolvedValue({
        data: {
          equipment_id: 12,
          previous_uid: 'OLD',
          new_uid: 'NEW',
          regenerated_by: 5,
          regenerated_at: '2026-07-10T10:00:00.000Z',
        },
      }),
    };
    const out = await regenerateEquipmentUidUnified(api, 12, {
      reason: 'audit',
      useV2: true,
    });
    expect(api.v2RegenerateEquipmentUid).toHaveBeenCalledWith(12, { reason: 'audit' });
    expect(out).toMatchObject({ equipmentId: 12, newUid: 'NEW' });
  });
  it('appelle v2 sans body si pas de reason', async () => {
    const api = {
      v2RegenerateEquipmentUid: vi
        .fn()
        .mockResolvedValue({ data: { equipment_id: 1, previous_uid: null, new_uid: 'X' } }),
    };
    await regenerateEquipmentUidUnified(api, 1, { useV2: true });
    expect(api.v2RegenerateEquipmentUid).toHaveBeenCalledWith(1, {});
  });
  it('null silencieux FEATURE_DISABLED', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2RegenerateEquipmentUid: vi.fn().mockRejectedValue(err) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await regenerateEquipmentUidUnified(api, 5, { useV2: true });
    expect(out).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
