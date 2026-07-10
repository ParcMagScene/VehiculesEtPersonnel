// apps/web/src/utils/orders/v2Adapters.test.js
// Ticket : T-P1-09b/10b.

import { describe, expect, it } from 'vitest';

import {
  adaptV2ConvertResponse,
  adaptV2ReceptionResponse,
  adaptV2ReceptionsSummary,
  adaptV2TransitionResponse,
  getAllowedNext,
  isTransitionAllowed,
  isTransitionConflict,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  QUOTE_STATUSES,
  QUOTE_TRANSITIONS,
  readOrdersV2ClientFlag,
} from './v2Adapters.js';

describe('orders/v2Adapters — matrices', () => {
  it('ORDER_STATUSES = 6 valeurs', () => {
    expect(ORDER_STATUSES).toEqual([
      'draft',
      'sent',
      'confirmed',
      'partial',
      'received',
      'cancelled',
    ]);
  });
  it('QUOTE_STATUSES = 5 valeurs', () => {
    expect(QUOTE_STATUSES).toEqual(['draft', 'sent', 'accepted', 'refused', 'cancelled']);
  });
  it('ORDER_TRANSITIONS.received = terminal', () => {
    expect(ORDER_TRANSITIONS.received).toEqual([]);
  });
  it('QUOTE_TRANSITIONS.accepted = terminal', () => {
    expect(QUOTE_TRANSITIONS.accepted).toEqual([]);
  });
});

describe('orders/v2Adapters — getAllowedNext / isTransitionAllowed', () => {
  it('order: draft -> sent, cancelled', () => {
    expect(getAllowedNext('draft', 'order')).toEqual(['sent', 'cancelled']);
    expect(isTransitionAllowed('draft', 'sent', 'order')).toBe(true);
    expect(isTransitionAllowed('draft', 'received', 'order')).toBe(false);
  });
  it('quote: sent -> accepted / refused / cancelled', () => {
    expect(getAllowedNext('sent', 'quote').sort()).toEqual(['accepted', 'cancelled', 'refused']);
    expect(isTransitionAllowed('sent', 'accepted', 'quote')).toBe(true);
    expect(isTransitionAllowed('sent', 'draft', 'quote')).toBe(false);
  });
  it('auto-transition autorisee (from === to)', () => {
    expect(isTransitionAllowed('confirmed', 'confirmed', 'order')).toBe(true);
  });
  it('statut inconnu -> []', () => {
    expect(getAllowedNext('unknown', 'order')).toEqual([]);
    expect(isTransitionAllowed('unknown', 'sent', 'order')).toBe(false);
  });
});

describe('orders/v2Adapters — adaptV2TransitionResponse', () => {
  it('null si data manquant', () => {
    expect(adaptV2TransitionResponse(null)).toBeNull();
    expect(adaptV2TransitionResponse({})).toBeNull();
  });
  it('passthrough data', () => {
    const data = { order: { id: 1 }, previous_status: 'draft', new_status: 'sent' };
    expect(adaptV2TransitionResponse({ data })).toBe(data);
  });
});

describe('orders/v2Adapters — adaptV2ReceptionResponse', () => {
  it('null si data manquant', () => {
    expect(adaptV2ReceptionResponse(null)).toBeNull();
    expect(adaptV2ReceptionResponse({})).toBeNull();
  });
  it('adapte reception snake -> camel + expose order_items & order', () => {
    const out = adaptV2ReceptionResponse({
      data: {
        reception: {
          id: 10,
          order_id: 5,
          order_item_id: 3,
          received_qty: 2,
          notes: 'partiel',
          received_by: 7,
          received_at: '2026-07-10T10:00:00Z',
        },
        order_items: [{ id: 3, quantity: 5 }],
        order: { id: 5, status: 'partial' },
      },
    });
    expect(out.reception).toEqual({
      id: 10,
      orderId: 5,
      orderItemId: 3,
      receivedQty: 2,
      notes: 'partiel',
      receivedBy: 7,
      receivedAt: '2026-07-10T10:00:00Z',
    });
    expect(out.orderItems).toHaveLength(1);
    expect(out.order.status).toBe('partial');
  });
  it('reception non-objet -> null', () => {
    const out = adaptV2ReceptionResponse({ data: { reception: null } });
    expect(out.reception).toBeNull();
    expect(out.orderItems).toEqual([]);
  });
});

describe('orders/v2Adapters — adaptV2ReceptionsSummary', () => {
  it('null si data manquant', () => {
    expect(adaptV2ReceptionsSummary({})).toBeNull();
  });
  it('normalise summary + totaux + booleen', () => {
    const out = adaptV2ReceptionsSummary({
      data: {
        summary: [{ order_item_id: 1, remaining_qty: 0 }],
        all_received: true,
        total_ordered: 5,
        total_received: 5,
      },
    });
    expect(out).toEqual({
      summary: [{ order_item_id: 1, remaining_qty: 0 }],
      allReceived: true,
      totalOrdered: 5,
      totalReceived: 5,
    });
  });
  it('summary non-array + totaux manquants -> defaults', () => {
    const out = adaptV2ReceptionsSummary({ data: { summary: null } });
    expect(out).toEqual({
      summary: [],
      allReceived: false,
      totalOrdered: 0,
      totalReceived: 0,
    });
  });
});

describe('orders/v2Adapters — adaptV2ConvertResponse', () => {
  it('null si data manquant', () => {
    expect(adaptV2ConvertResponse({})).toBeNull();
  });
  it('renvoie quote + order', () => {
    const out = adaptV2ConvertResponse({
      data: { quote: { id: 5, status: 'accepted' }, order: { id: 42, status: 'draft' } },
    });
    expect(out.quote.id).toBe(5);
    expect(out.order.status).toBe('draft');
  });
});

describe('orders/v2Adapters — isTransitionConflict', () => {
  it('true si CONFLICT ou 409', () => {
    expect(isTransitionConflict({ code: 'CONFLICT' })).toBe(true);
    expect(isTransitionConflict({ status: 409 })).toBe(true);
    expect(isTransitionConflict({ details: { code: 'CONFLICT' } })).toBe(true);
  });
  it('false sinon', () => {
    expect(isTransitionConflict(null)).toBe(false);
    expect(isTransitionConflict({ code: 'NETWORK' })).toBe(false);
    expect(isTransitionConflict({ status: 500 })).toBe(false);
  });
});

describe('orders/v2Adapters — readOrdersV2ClientFlag', () => {
  it('true / false', () => {
    expect(readOrdersV2ClientFlag({ VITE_FEATURE_V2_ORDERS: '1' })).toBe(true);
    expect(readOrdersV2ClientFlag({ VITE_FEATURE_V2_ORDERS: 'true' })).toBe(true);
    expect(readOrdersV2ClientFlag({ VITE_FEATURE_V2_ORDERS: '0' })).toBe(false);
    expect(readOrdersV2ClientFlag({})).toBe(false);
    expect(readOrdersV2ClientFlag()).toBe(false);
  });
});
