// apps/web/src/utils/equipmentAssignments/v2Adapters.test.js
// Ticket : T-P1-08b.

import { describe, expect, it } from 'vitest';

import {
  adaptAssignmentHistoryEntryV2ToV1,
  adaptAssignmentV2ToV1,
  adaptV2AssignmentMutationResponse,
  adaptV2AssignmentsHistoryList,
  ASSIGNMENT_EVENT_TYPES,
  ASSIGNMENT_STATUSES,
  isDoubleAssignConflict,
  readEquipmentAssignmentsV2ClientFlag,
} from './v2Adapters.js';

describe('equipmentAssignments/v2Adapters — constantes', () => {
  it('ASSIGNMENT_STATUSES', () => {
    expect(ASSIGNMENT_STATUSES).toEqual(['active', 'released', 'cancelled']);
  });
  it('ASSIGNMENT_EVENT_TYPES', () => {
    expect(ASSIGNMENT_EVENT_TYPES).toEqual(['assign', 'release', 'reassign', 'cancel']);
  });
});

describe('equipmentAssignments/v2Adapters — adaptAssignmentV2ToV1', () => {
  it('null pour non-objet', () => {
    expect(adaptAssignmentV2ToV1(null)).toBeNull();
    expect(adaptAssignmentV2ToV1('x')).toBeNull();
  });
  it('mappe tous les champs', () => {
    expect(
      adaptAssignmentV2ToV1({
        id: 1,
        equipment_id: 5,
        assigned_to: 7,
        assigned_by: 9,
        start_date: '2026-07-01',
        end_date: null,
        release_date: null,
        affaire_id: 'AF-1',
        status: 'active',
        notes: 'n',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }),
    ).toEqual({
      id: 1,
      equipmentId: 5,
      assignedTo: 7,
      assignedBy: 9,
      startDate: '2026-07-01',
      endDate: null,
      releaseDate: null,
      affaireId: 'AF-1',
      status: 'active',
      notes: 'n',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    });
  });
});

describe('equipmentAssignments/v2Adapters — adaptAssignmentHistoryEntryV2ToV1', () => {
  it('null pour non-objet', () => {
    expect(adaptAssignmentHistoryEntryV2ToV1(null)).toBeNull();
  });
  it('mappe snake -> camel', () => {
    expect(
      adaptAssignmentHistoryEntryV2ToV1({
        id: 100,
        assignment_id: 42,
        equipment_id: 5,
        event_type: 'reassign',
        source: 'v2_api',
        previous_assigned_to: 3,
        new_assigned_to: 7,
        changed_by: 9,
        changed_at: '2026-07-10T10:00:00Z',
        notes: null,
      }),
    ).toEqual({
      id: 100,
      assignmentId: 42,
      equipmentId: 5,
      eventType: 'reassign',
      source: 'v2_api',
      previousAssignedTo: 3,
      newAssignedTo: 7,
      changedBy: 9,
      changedAt: '2026-07-10T10:00:00Z',
      notes: null,
    });
  });
});

describe('equipmentAssignments/v2Adapters — adaptV2AssignmentsHistoryList', () => {
  it('null si data manquant', () => {
    expect(adaptV2AssignmentsHistoryList(null)).toBeNull();
    expect(adaptV2AssignmentsHistoryList({})).toBeNull();
  });
  it('normalise entries + total', () => {
    const out = adaptV2AssignmentsHistoryList({
      data: { entries: [{ id: 1, event_type: 'assign' }], total: 1 },
    });
    expect(out.entries[0].eventType).toBe('assign');
    expect(out.total).toBe(1);
  });
});

describe('equipmentAssignments/v2Adapters — adaptV2AssignmentMutationResponse', () => {
  it('null si data manquant', () => {
    expect(adaptV2AssignmentMutationResponse({})).toBeNull();
  });
  it('mappe assignment + history_id', () => {
    const out = adaptV2AssignmentMutationResponse({
      data: {
        assignment: { id: 42, equipment_id: 5, status: 'active' },
        history_id: 100,
      },
    });
    expect(out.assignment.equipmentId).toBe(5);
    expect(out.historyId).toBe(100);
  });
});

describe('equipmentAssignments/v2Adapters — isDoubleAssignConflict', () => {
  it('true si code=CONFLICT ou status=409', () => {
    expect(isDoubleAssignConflict({ code: 'CONFLICT' })).toBe(true);
    expect(isDoubleAssignConflict({ status: 409 })).toBe(true);
    expect(isDoubleAssignConflict({ details: { code: 'CONFLICT' } })).toBe(true);
  });
  it('false sinon', () => {
    expect(isDoubleAssignConflict(null)).toBe(false);
    expect(isDoubleAssignConflict({ code: 'VALIDATION_ERROR' })).toBe(false);
    expect(isDoubleAssignConflict({ status: 500 })).toBe(false);
  });
});

describe('equipmentAssignments/v2Adapters — readEquipmentAssignmentsV2ClientFlag', () => {
  it('true / false selon convention', () => {
    expect(
      readEquipmentAssignmentsV2ClientFlag({ VITE_FEATURE_V2_EQUIPMENT_ASSIGNMENTS: '1' }),
    ).toBe(true);
    expect(
      readEquipmentAssignmentsV2ClientFlag({ VITE_FEATURE_V2_EQUIPMENT_ASSIGNMENTS: 'true' }),
    ).toBe(true);
    expect(
      readEquipmentAssignmentsV2ClientFlag({ VITE_FEATURE_V2_EQUIPMENT_ASSIGNMENTS: '0' }),
    ).toBe(false);
    expect(readEquipmentAssignmentsV2ClientFlag({})).toBe(false);
    expect(readEquipmentAssignmentsV2ClientFlag()).toBe(false);
  });
});
