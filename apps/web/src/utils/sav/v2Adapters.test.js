// apps/web/src/utils/sav/v2Adapters.test.js
// Ticket : T-P1-07b.

import { describe, expect, it } from 'vitest';

import {
  adaptSavPartV2ToV1,
  adaptV2SavPartsList,
  adaptV2TicketTransitionResponse,
  readSavV2ClientFlag,
  SAV_PART_STATUSES,
  SAV_TICKET_STATUSES,
} from './v2Adapters.js';

describe('sav/v2Adapters — constantes', () => {
  it('SAV_PART_STATUSES contient les 5 statuts pieces', () => {
    expect(SAV_PART_STATUSES).toEqual([
      'requested',
      'ordered',
      'received',
      'installed',
      'cancelled',
    ]);
  });
  it('SAV_TICKET_STATUSES contient les 6 statuts tickets', () => {
    expect(SAV_TICKET_STATUSES).toEqual([
      'open',
      'in_progress',
      'waiting_parts',
      'resolved',
      'closed',
      'sortie_sav',
    ]);
  });
});

describe('sav/v2Adapters — adaptSavPartV2ToV1', () => {
  it('null pour non-objet', () => {
    expect(adaptSavPartV2ToV1(null)).toBeNull();
    expect(adaptSavPartV2ToV1('x')).toBeNull();
  });
  it('mappe tous les champs snake -> camel', () => {
    const input = {
      id: 10,
      ticket_id: 5,
      part_name: 'Fuse 5A',
      part_reference: 'F5A',
      quantity: 2,
      unit_price: 3.5,
      supplier: 'Sup Co',
      status: 'ordered',
      requested_at: '2026-07-01T10:00:00Z',
      ordered_at: '2026-07-02T10:00:00Z',
      received_at: null,
      installed_at: null,
      cancelled_at: null,
      notes: 'test',
      created_by: 5,
      created_at: '2026-07-01T10:00:00Z',
      modified_by: 6,
      modified_at: '2026-07-02T10:00:00Z',
    };
    expect(adaptSavPartV2ToV1(input)).toEqual({
      id: 10,
      ticketId: 5,
      partName: 'Fuse 5A',
      partReference: 'F5A',
      quantity: 2,
      unitPrice: 3.5,
      supplier: 'Sup Co',
      status: 'ordered',
      requestedAt: '2026-07-01T10:00:00Z',
      orderedAt: '2026-07-02T10:00:00Z',
      receivedAt: null,
      installedAt: null,
      cancelledAt: null,
      notes: 'test',
      createdBy: 5,
      createdAt: '2026-07-01T10:00:00Z',
      modifiedBy: 6,
      modifiedAt: '2026-07-02T10:00:00Z',
    });
  });
  it('quantity par defaut 1 si manquant', () => {
    expect(adaptSavPartV2ToV1({ id: 1 }).quantity).toBe(1);
  });
});

describe('sav/v2Adapters — adaptV2SavPartsList', () => {
  it('null si data manquant', () => {
    expect(adaptV2SavPartsList(null)).toBeNull();
    expect(adaptV2SavPartsList({})).toBeNull();
  });
  it('normalise parts + total', () => {
    const out = adaptV2SavPartsList({
      data: {
        parts: [
          { id: 1, part_name: 'A' },
          { id: 2, part_name: 'B' },
        ],
        total: 2,
      },
    });
    expect(out.total).toBe(2);
    expect(out.parts).toHaveLength(2);
    expect(out.parts[0].partName).toBe('A');
  });
  it('parts non-array -> []', () => {
    const out = adaptV2SavPartsList({ data: { parts: null } });
    expect(out.parts).toEqual([]);
    expect(out.total).toBe(0);
  });
});

describe('sav/v2Adapters — adaptV2TicketTransitionResponse', () => {
  it('null si data manquant', () => {
    expect(adaptV2TicketTransitionResponse(null)).toBeNull();
    expect(adaptV2TicketTransitionResponse({})).toBeNull();
  });
  it('passthrough data', () => {
    const data = { ticket: { id: 1 }, previous_status: 'open', new_status: 'in_progress' };
    expect(adaptV2TicketTransitionResponse({ data })).toBe(data);
  });
});

describe('sav/v2Adapters — readSavV2ClientFlag', () => {
  it('true / false selon convention', () => {
    expect(readSavV2ClientFlag({ VITE_FEATURE_V2_SAV: '1' })).toBe(true);
    expect(readSavV2ClientFlag({ VITE_FEATURE_V2_SAV: 'true' })).toBe(true);
    expect(readSavV2ClientFlag({ VITE_FEATURE_V2_SAV: '0' })).toBe(false);
    expect(readSavV2ClientFlag({})).toBe(false);
    expect(readSavV2ClientFlag()).toBe(false);
  });
});
