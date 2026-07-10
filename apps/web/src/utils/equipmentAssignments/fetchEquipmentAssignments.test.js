// apps/web/src/utils/equipmentAssignments/fetchEquipmentAssignments.test.js
// Ticket : T-P1-08b.

import { describe, expect, it, vi } from 'vitest';

import {
  createEquipmentAssignmentUnified,
  fetchAssignmentsHistoryUnified,
  isFeatureDisabled,
  releaseEquipmentAssignmentUnified,
} from './fetchEquipmentAssignments.js';

describe('equipmentAssignments/fetchEquipmentAssignments — isFeatureDisabled', () => {
  it('true / false', () => {
    expect(isFeatureDisabled({ code: 'FEATURE_DISABLED' })).toBe(true);
    expect(isFeatureDisabled(null)).toBe(false);
  });
});

describe('equipmentAssignments/fetchEquipmentAssignments — createEquipmentAssignmentUnified', () => {
  const baseData = { startDate: '2026-07-01', assignedTo: 5 };

  it('null si useV2 off / id invalide / data invalide / methode absente', async () => {
    const api = { v2CreateEquipmentAssignment: vi.fn() };
    expect(await createEquipmentAssignmentUnified(api, 5, baseData)).toBeNull();
    expect(await createEquipmentAssignmentUnified(api, 0, baseData, { useV2: true })).toBeNull();
    expect(await createEquipmentAssignmentUnified(api, 5, {}, { useV2: true })).toBeNull();
    expect(await createEquipmentAssignmentUnified({}, 5, baseData, { useV2: true })).toBeNull();
    expect(api.v2CreateEquipmentAssignment).not.toHaveBeenCalled();
  });

  it('ok: true avec assignment + historyId', async () => {
    const api = {
      v2CreateEquipmentAssignment: vi.fn().mockResolvedValue({
        data: {
          assignment: { id: 42, equipment_id: 5, assigned_to: 5, status: 'active' },
          history_id: 100,
        },
      }),
    };
    const out = await createEquipmentAssignmentUnified(api, 5, baseData, { useV2: true });
    expect(api.v2CreateEquipmentAssignment).toHaveBeenCalledWith(5, {
      assigned_to: 5,
      start_date: '2026-07-01',
      end_date: null,
      affaire_id: null,
      notes: null,
    });
    expect(out).toEqual({
      ok: true,
      assignment: expect.objectContaining({ id: 42, equipmentId: 5 }),
      historyId: 100,
    });
  });

  it('ok: false, conflict: true sur 409 CONFLICT', async () => {
    const err = new Error('conflict');
    err.code = 'CONFLICT';
    err.status = 409;
    const api = { v2CreateEquipmentAssignment: vi.fn().mockRejectedValue(err) };
    const out = await createEquipmentAssignmentUnified(api, 5, baseData, { useV2: true });
    expect(out).toEqual({ ok: false, conflict: true, error: err });
  });

  it('ok: false, conflict: false sur autre erreur', async () => {
    const err = new Error('boom');
    const api = { v2CreateEquipmentAssignment: vi.fn().mockRejectedValue(err) };
    const out = await createEquipmentAssignmentUnified(api, 5, baseData, { useV2: true });
    expect(out).toEqual({ ok: false, conflict: false, error: err });
  });

  it('null silencieux sur FEATURE_DISABLED', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2CreateEquipmentAssignment: vi.fn().mockRejectedValue(err) };
    expect(await createEquipmentAssignmentUnified(api, 5, baseData, { useV2: true })).toBeNull();
  });
});

describe('equipmentAssignments/fetchEquipmentAssignments — releaseEquipmentAssignmentUnified', () => {
  it('null si useV2 off ou id invalide', async () => {
    const api = { v2ReleaseEquipmentAssignment: vi.fn() };
    expect(await releaseEquipmentAssignmentUnified(api, 5)).toBeNull();
    expect(await releaseEquipmentAssignmentUnified(api, 0, {}, { useV2: true })).toBeNull();
  });
  it('appelle v2 avec body optionnel + retourne mutation adaptee', async () => {
    const api = {
      v2ReleaseEquipmentAssignment: vi.fn().mockResolvedValue({
        data: {
          assignment: { id: 42, equipment_id: 5, status: 'released' },
          history_id: 101,
        },
      }),
    };
    const out = await releaseEquipmentAssignmentUnified(
      api,
      42,
      { releaseDate: '2026-07-15', notes: 'done' },
      { useV2: true },
    );
    expect(api.v2ReleaseEquipmentAssignment).toHaveBeenCalledWith(42, {
      release_date: '2026-07-15',
      notes: 'done',
    });
    expect(out.assignment.status).toBe('released');
    expect(out.historyId).toBe(101);
  });
});

describe('equipmentAssignments/fetchEquipmentAssignments — fetchAssignmentsHistoryUnified', () => {
  it('null si useV2 off / id invalide / methode absente', async () => {
    const api = { v2GetEquipmentAssignmentsHistory: vi.fn() };
    expect(await fetchAssignmentsHistoryUnified(api, 5)).toBeNull();
    expect(await fetchAssignmentsHistoryUnified(api, 0, { useV2: true })).toBeNull();
    expect(await fetchAssignmentsHistoryUnified({}, 5, { useV2: true })).toBeNull();
  });
  it('appelle v2 avec limit optionnel + normalise entries', async () => {
    const api = {
      v2GetEquipmentAssignmentsHistory: vi.fn().mockResolvedValue({
        data: {
          entries: [
            { id: 1, event_type: 'assign' },
            { id: 2, event_type: 'release' },
          ],
          total: 2,
        },
      }),
    };
    const out = await fetchAssignmentsHistoryUnified(api, 5, { useV2: true, limit: 10 });
    expect(api.v2GetEquipmentAssignmentsHistory).toHaveBeenCalledWith(5, { limit: 10 });
    expect(out.entries).toHaveLength(2);
    expect(out.entries[0].eventType).toBe('assign');
  });
  it('null silencieux FEATURE_DISABLED', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2GetEquipmentAssignmentsHistory: vi.fn().mockRejectedValue(err) };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await fetchAssignmentsHistoryUnified(api, 5, { useV2: true })).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
