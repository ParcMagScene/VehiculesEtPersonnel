// apps/web/src/utils/equipmentUid/v2Adapters.test.js
// Ticket : T-P1-06b.

import { describe, expect, it } from 'vitest';

import {
  adaptDuplicateEntryV2ToV1,
  adaptV2AuditResponse,
  adaptV2RegenerateResponse,
  readEquipmentUidV2ClientFlag,
} from './v2Adapters.js';

describe('equipmentUid/v2Adapters — adaptDuplicateEntryV2ToV1', () => {
  it('null pour non-objet', () => {
    expect(adaptDuplicateEntryV2ToV1(null)).toBeNull();
    expect(adaptDuplicateEntryV2ToV1('nope')).toBeNull();
  });
  it('mappe serial + ids', () => {
    expect(adaptDuplicateEntryV2ToV1({ serial_number: 'SN1', count: 2, ids: [1, 2] })).toEqual({
      serialNumber: 'SN1',
      uid: null,
      count: 2,
      ids: [1, 2],
    });
  });
  it('mappe uid + ids en filtrant les non-integers', () => {
    expect(adaptDuplicateEntryV2ToV1({ uid: 'EMAG-1', count: 2, ids: [1, 'x', 3] })).toEqual({
      serialNumber: null,
      uid: 'EMAG-1',
      count: 2,
      ids: [1, 3],
    });
  });
});

describe('equipmentUid/v2Adapters — adaptV2AuditResponse', () => {
  it('null si non-objet ou data manquant', () => {
    expect(adaptV2AuditResponse(null)).toBeNull();
    expect(adaptV2AuditResponse({})).toBeNull();
    expect(adaptV2AuditResponse({ data: null })).toBeNull();
  });
  it('normalise complet', () => {
    const out = adaptV2AuditResponse({
      data: {
        equipment_total: 100,
        equipment_with_uid: 98,
        equipment_without_uid: 2,
        equipment_with_serial: 95,
        duplicate_serials: [{ serial_number: 'SN', count: 2, ids: [1, 2] }],
        duplicate_uids: [{ uid: 'U', count: 3, ids: [5, 6, 7] }],
        verdict: 'OK',
      },
    });
    expect(out).toEqual({
      equipmentTotal: 100,
      equipmentWithUid: 98,
      equipmentWithoutUid: 2,
      equipmentWithSerial: 95,
      duplicateSerials: [{ serialNumber: 'SN', uid: null, count: 2, ids: [1, 2] }],
      duplicateUids: [{ serialNumber: null, uid: 'U', count: 3, ids: [5, 6, 7] }],
      verdict: 'OK',
    });
  });
  it('champs manquants -> valeurs neutres', () => {
    const out = adaptV2AuditResponse({ data: {} });
    expect(out).toEqual({
      equipmentTotal: 0,
      equipmentWithUid: 0,
      equipmentWithoutUid: 0,
      equipmentWithSerial: 0,
      duplicateSerials: [],
      duplicateUids: [],
      verdict: null,
    });
  });
});

describe('equipmentUid/v2Adapters — adaptV2RegenerateResponse', () => {
  it('null si data manquant', () => {
    expect(adaptV2RegenerateResponse(null)).toBeNull();
    expect(adaptV2RegenerateResponse({})).toBeNull();
  });
  it('mappe snake -> camel', () => {
    expect(
      adaptV2RegenerateResponse({
        data: {
          equipment_id: 42,
          previous_uid: 'OLD',
          new_uid: 'NEW',
          regenerated_by: 7,
          regenerated_at: '2026-07-10T10:00:00.000Z',
        },
      }),
    ).toEqual({
      equipmentId: 42,
      previousUid: 'OLD',
      newUid: 'NEW',
      regeneratedBy: 7,
      regeneratedAt: '2026-07-10T10:00:00.000Z',
    });
  });
});

describe('equipmentUid/v2Adapters — readEquipmentUidV2ClientFlag', () => {
  it('true / false selon convention', () => {
    expect(readEquipmentUidV2ClientFlag({ VITE_FEATURE_V2_EQUIPMENT_UID: '1' })).toBe(true);
    expect(readEquipmentUidV2ClientFlag({ VITE_FEATURE_V2_EQUIPMENT_UID: 'true' })).toBe(true);
    expect(readEquipmentUidV2ClientFlag({ VITE_FEATURE_V2_EQUIPMENT_UID: 'ON' })).toBe(true);
    expect(readEquipmentUidV2ClientFlag({ VITE_FEATURE_V2_EQUIPMENT_UID: '0' })).toBe(false);
    expect(readEquipmentUidV2ClientFlag({})).toBe(false);
    expect(readEquipmentUidV2ClientFlag()).toBe(false);
  });
});
