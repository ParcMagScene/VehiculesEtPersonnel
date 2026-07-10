// apps/web/src/utils/conflicts/v2Adapters.test.js
// Ticket : T-P1-05b.

import { describe, expect, it } from 'vitest';

import {
  adaptConflictV2ToV1,
  adaptV2ConflictsResponse,
  readConflictsV2ClientFlag,
} from './v2Adapters.js';

describe('conflicts/v2Adapters — adaptConflictV2ToV1', () => {
  it('null pour non-objet', () => {
    expect(adaptConflictV2ToV1(null)).toBeNull();
    expect(adaptConflictV2ToV1(undefined)).toBeNull();
    expect(adaptConflictV2ToV1('x')).toBeNull();
  });

  it('mappe snake -> camel', () => {
    expect(
      adaptConflictV2ToV1({
        source: 'missions',
        entity_type: 'mission',
        entity_id: 42,
        date: '2026-08-01',
        period: 'AM',
        label: 'Concert X',
        start_date: '2026-08-01',
        end_date: '2026-08-03',
      }),
    ).toEqual({
      source: 'missions',
      entityType: 'mission',
      entityId: 42,
      date: '2026-08-01',
      period: 'AM',
      label: 'Concert X',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
    });
  });

  it('champs manquants -> null', () => {
    const out = adaptConflictV2ToV1({ source: 'availabilities' });
    expect(out.source).toBe('availabilities');
    expect(out.entityType).toBeNull();
    expect(out.startDate).toBeNull();
  });
});

describe('conflicts/v2Adapters — adaptV2ConflictsResponse', () => {
  it('null si non-objet ou data manquant', () => {
    expect(adaptV2ConflictsResponse(null)).toBeNull();
    expect(adaptV2ConflictsResponse({})).toBeNull();
    expect(adaptV2ConflictsResponse({ data: null })).toBeNull();
  });

  it('normalise conflits + hasConflict + count', () => {
    const out = adaptV2ConflictsResponse({
      data: {
        conflicts: [
          { source: 'missions', entity_type: 'mission', entity_id: 1 },
          { source: 'task_assignments', entity_type: 'task_assignment', entity_id: 2 },
        ],
        has_conflict: true,
        count: 2,
      },
    });
    expect(out).toEqual({
      conflicts: [
        {
          source: 'missions',
          entityType: 'mission',
          entityId: 1,
          date: null,
          period: null,
          label: null,
          startDate: null,
          endDate: null,
        },
        {
          source: 'task_assignments',
          entityType: 'task_assignment',
          entityId: 2,
          date: null,
          period: null,
          label: null,
          startDate: null,
          endDate: null,
        },
      ],
      hasConflict: true,
      count: 2,
    });
  });

  it('data.conflicts non-array -> conflicts=[], hasConflict false, count 0', () => {
    const out = adaptV2ConflictsResponse({ data: { conflicts: null } });
    expect(out).toEqual({ conflicts: [], hasConflict: false, count: 0 });
  });
});

describe('conflicts/v2Adapters — readConflictsV2ClientFlag', () => {
  it('true pour 1/true/on/yes', () => {
    expect(readConflictsV2ClientFlag({ VITE_FEATURE_V2_CONFLICTS: '1' })).toBe(true);
    expect(readConflictsV2ClientFlag({ VITE_FEATURE_V2_CONFLICTS: 'true' })).toBe(true);
    expect(readConflictsV2ClientFlag({ VITE_FEATURE_V2_CONFLICTS: 'ON' })).toBe(true);
    expect(readConflictsV2ClientFlag({ VITE_FEATURE_V2_CONFLICTS: 'Yes' })).toBe(true);
  });

  it('false sinon', () => {
    expect(readConflictsV2ClientFlag({ VITE_FEATURE_V2_CONFLICTS: '0' })).toBe(false);
    expect(readConflictsV2ClientFlag({})).toBe(false);
    expect(readConflictsV2ClientFlag()).toBe(false);
  });
});
