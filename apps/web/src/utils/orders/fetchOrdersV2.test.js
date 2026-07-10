// apps/web/src/utils/orders/fetchOrdersV2.test.js
// Ticket : T-P1-09b/10b.

import { describe, expect, it, vi } from 'vitest';

import {
  convertQuoteToOrderUnified,
  fetchOrderReceptionsSummaryUnified,
  isFeatureDisabled,
  recordOrderReceptionUnified,
  transitionOrderOrQuoteUnified,
} from './fetchOrdersV2.js';

describe('orders/fetchOrdersV2 — isFeatureDisabled', () => {
  it('true / false', () => {
    expect(isFeatureDisabled({ code: 'FEATURE_DISABLED' })).toBe(true);
    expect(isFeatureDisabled(null)).toBe(false);
  });
});

describe('orders/fetchOrdersV2 — transitionOrderOrQuoteUnified', () => {
  it('null si useV2 off / id ou status invalide / methode absente', async () => {
    const api = { v2TransitionOrder: vi.fn() };
    expect(await transitionOrderOrQuoteUnified(api, 5, 'sent')).toBeNull();
    expect(await transitionOrderOrQuoteUnified(api, 0, 'sent', { useV2: true })).toBeNull();
    expect(await transitionOrderOrQuoteUnified(api, 5, '', { useV2: true })).toBeNull();
    expect(await transitionOrderOrQuoteUnified({}, 5, 'sent', { useV2: true })).toBeNull();
  });

  it('appelle v2TransitionOrder par defaut kind=order', async () => {
    const api = {
      v2TransitionOrder: vi.fn().mockResolvedValue({
        data: { order: { id: 5, status: 'sent' }, previous_status: 'draft' },
      }),
    };
    const out = await transitionOrderOrQuoteUnified(api, 5, 'sent', { useV2: true });
    expect(api.v2TransitionOrder).toHaveBeenCalledWith(5, 'sent');
    expect(out.ok).toBe(true);
    expect(out.data.previous_status).toBe('draft');
  });

  it('appelle v2TransitionQuote si kind=quote', async () => {
    const api = {
      v2TransitionQuote: vi
        .fn()
        .mockResolvedValue({ data: { quote: { id: 3, status: 'accepted' } } }),
    };
    const out = await transitionOrderOrQuoteUnified(api, 3, 'accepted', {
      useV2: true,
      kind: 'quote',
    });
    expect(api.v2TransitionQuote).toHaveBeenCalledWith(3, 'accepted');
    expect(out.ok).toBe(true);
  });

  it('conflict: true sur 409 CONFLICT', async () => {
    const err = new Error('nope');
    err.code = 'CONFLICT';
    const api = { v2TransitionOrder: vi.fn().mockRejectedValue(err) };
    const out = await transitionOrderOrQuoteUnified(api, 5, 'draft', { useV2: true });
    expect(out).toEqual({ ok: false, conflict: true, error: err });
  });

  it('null silencieux sur FEATURE_DISABLED', async () => {
    const err = new Error('off');
    err.code = 'FEATURE_DISABLED';
    const api = { v2TransitionOrder: vi.fn().mockRejectedValue(err) };
    expect(await transitionOrderOrQuoteUnified(api, 5, 'sent', { useV2: true })).toBeNull();
  });
});

describe('orders/fetchOrdersV2 — recordOrderReceptionUnified', () => {
  it('null si useV2 off / ids invalides / qty invalide', async () => {
    const api = { v2RecordOrderReception: vi.fn() };
    expect(
      await recordOrderReceptionUnified(api, 5, { orderItemId: 3, receivedQty: 2 }),
    ).toBeNull();
    expect(
      await recordOrderReceptionUnified(
        api,
        0,
        { orderItemId: 3, receivedQty: 2 },
        { useV2: true },
      ),
    ).toBeNull();
    expect(
      await recordOrderReceptionUnified(
        api,
        5,
        { orderItemId: 0, receivedQty: 2 },
        { useV2: true },
      ),
    ).toBeNull();
    expect(
      await recordOrderReceptionUnified(
        api,
        5,
        { orderItemId: 3, receivedQty: 0 },
        { useV2: true },
      ),
    ).toBeNull();
    expect(
      await recordOrderReceptionUnified(
        api,
        5,
        { orderItemId: 3, receivedQty: -1 },
        { useV2: true },
      ),
    ).toBeNull();
  });

  it('appelle v2 avec body snake + retourne reception/orderItems/order', async () => {
    const api = {
      v2RecordOrderReception: vi.fn().mockResolvedValue({
        data: {
          reception: { id: 10, order_id: 5, order_item_id: 3, received_qty: 2 },
          order_items: [{ id: 3, quantity: 5 }],
          order: { id: 5, status: 'partial' },
        },
      }),
    };
    const out = await recordOrderReceptionUnified(
      api,
      5,
      { orderItemId: 3, receivedQty: 2, notes: 'partiel' },
      { useV2: true },
    );
    expect(api.v2RecordOrderReception).toHaveBeenCalledWith(5, {
      order_item_id: 3,
      received_qty: 2,
      notes: 'partiel',
    });
    expect(out.ok).toBe(true);
    expect(out.reception.receivedQty).toBe(2);
    expect(out.order.status).toBe('partial');
  });

  it('conflict: true sur 409', async () => {
    const err = new Error('exceeded');
    err.status = 409;
    const api = { v2RecordOrderReception: vi.fn().mockRejectedValue(err) };
    const out = await recordOrderReceptionUnified(
      api,
      5,
      { orderItemId: 3, receivedQty: 100 },
      { useV2: true },
    );
    expect(out).toEqual({ ok: false, conflict: true, error: err });
  });
});

describe('orders/fetchOrdersV2 — fetchOrderReceptionsSummaryUnified', () => {
  it('null si useV2 off / id invalide / methode absente', async () => {
    const api = { v2GetOrderReceptionsSummary: vi.fn() };
    expect(await fetchOrderReceptionsSummaryUnified(api, 5)).toBeNull();
    expect(await fetchOrderReceptionsSummaryUnified(api, 0, { useV2: true })).toBeNull();
    expect(await fetchOrderReceptionsSummaryUnified({}, 5, { useV2: true })).toBeNull();
  });
  it('normalise summary + totaux', async () => {
    const api = {
      v2GetOrderReceptionsSummary: vi.fn().mockResolvedValue({
        data: {
          summary: [{ order_item_id: 3 }],
          all_received: false,
          total_ordered: 10,
          total_received: 4,
        },
      }),
    };
    const out = await fetchOrderReceptionsSummaryUnified(api, 5, { useV2: true });
    expect(out.allReceived).toBe(false);
    expect(out.totalOrdered).toBe(10);
    expect(out.totalReceived).toBe(4);
  });
});

describe('orders/fetchOrdersV2 — convertQuoteToOrderUnified', () => {
  it('null si useV2 off / id invalide / methode absente', async () => {
    const api = { v2ConvertQuoteToOrder: vi.fn() };
    expect(await convertQuoteToOrderUnified(api, 5)).toBeNull();
    expect(await convertQuoteToOrderUnified(api, 0, { useV2: true })).toBeNull();
    expect(await convertQuoteToOrderUnified({}, 5, { useV2: true })).toBeNull();
  });
  it('appelle v2 et retourne quote + order', async () => {
    const api = {
      v2ConvertQuoteToOrder: vi.fn().mockResolvedValue({
        data: {
          quote: { id: 5, status: 'accepted' },
          order: { id: 42, status: 'draft' },
        },
      }),
    };
    const out = await convertQuoteToOrderUnified(api, 5, { useV2: true });
    expect(api.v2ConvertQuoteToOrder).toHaveBeenCalledWith(5);
    expect(out.ok).toBe(true);
    expect(out.quote.id).toBe(5);
    expect(out.order.id).toBe(42);
  });
  it('conflict: true sur 409', async () => {
    const err = new Error('quote not accepted');
    err.code = 'CONFLICT';
    const api = { v2ConvertQuoteToOrder: vi.fn().mockRejectedValue(err) };
    const out = await convertQuoteToOrderUnified(api, 5, { useV2: true });
    expect(out).toEqual({ ok: false, conflict: true, error: err });
  });
});
