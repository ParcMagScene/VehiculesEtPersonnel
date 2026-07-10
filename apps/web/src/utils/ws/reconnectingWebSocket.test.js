// apps/web/src/utils/ws/reconnectingWebSocket.test.js
//
// Tests unitaires — client ReconnectingWebSocket (T-P1-02).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyJitter, computeBackoffDelay, ReconnectingWebSocket } from './reconnectingWebSocket';

/**
 * Mock minimal du WebSocket global. Expose des methodes pour
 * simuler ouverture, message, erreur, fermeture.
 */
class MockWebSocket {
  static instances = [];
  static reset() {
    MockWebSocket.instances = [];
  }
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    this.closeCalls = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    MockWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = 3; // CLOSED
  }
  // Helpers de test :
  fireOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
  fireMessage(data) {
    this.onmessage?.({ data });
  }
  fireError(err) {
    this.onerror?.(err);
  }
  fireClose(code = 1006, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

describe('applyJitter', () => {
  it('renvoie 0 pour un base <= 0', () => {
    expect(applyJitter(0, 0.5)).toBe(0);
    expect(applyJitter(-100, 0.5)).toBe(0);
  });

  it('reste dans [base*(1-r), base*(1+r)]', () => {
    for (let i = 0; i < 50; i += 1) {
      const j = applyJitter(1000, 0.2);
      expect(j).toBeGreaterThanOrEqual(800);
      expect(j).toBeLessThanOrEqual(1200);
    }
  });

  it('ratio hors [0,1] est borne', () => {
    for (let i = 0; i < 20; i += 1) {
      const j = applyJitter(500, 5);
      // ratio ramene a 1 -> [0, 1000]
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThanOrEqual(1000);
    }
  });
});

describe('computeBackoffDelay', () => {
  it('croit exponentiellement puis capped', () => {
    const call = (attempt) =>
      computeBackoffDelay({
        attempt,
        initialRetryMs: 100,
        maxRetryMs: 1000,
        backoffFactor: 2,
        jitterRatio: 0,
      });
    expect(call(1)).toBe(100);
    expect(call(2)).toBe(200);
    expect(call(3)).toBe(400);
    expect(call(4)).toBe(800);
    expect(call(5)).toBe(1000); // capped
    expect(call(10)).toBe(1000); // capped
  });
});

describe('ReconnectingWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    MockWebSocket.reset();
  });

  it('validation url', () => {
    expect(() => new ReconnectingWebSocket('', { webSocketFactory: () => MockWebSocket })).toThrow(
      TypeError,
    );
  });

  it('ouvre immediatement + emit open', () => {
    const opened = vi.fn();
    const rws = new ReconnectingWebSocket('ws://x', {
      webSocketFactory: () => MockWebSocket,
    });
    rws.on('open', opened);
    expect(MockWebSocket.instances.length).toBe(1);
    MockWebSocket.instances[0].fireOpen();
    expect(opened).toHaveBeenCalledTimes(1);
    rws.close();
  });

  it("queue les messages quand fermé, flush a l'ouverture", () => {
    const rws = new ReconnectingWebSocket('ws://x', {
      webSocketFactory: () => MockWebSocket,
    });
    rws.send('m1');
    rws.send('m2');
    // Pas envoye tant que non ouvert.
    expect(MockWebSocket.instances[0].sent).toEqual([]);
    MockWebSocket.instances[0].fireOpen();
    expect(MockWebSocket.instances[0].sent).toEqual(['m1', 'm2']);
    rws.close();
  });

  it('bornage de la queue via maxQueueSize (drop les plus anciens)', () => {
    const rws = new ReconnectingWebSocket('ws://x', {
      webSocketFactory: () => MockWebSocket,
      maxQueueSize: 2,
    });
    rws.send('a');
    rws.send('b');
    rws.send('c'); // drop 'a'
    MockWebSocket.instances[0].fireOpen();
    expect(MockWebSocket.instances[0].sent).toEqual(['b', 'c']);
    rws.close();
  });

  it('reconnexion apres close serveur non voulue', () => {
    const reconnectSpy = vi.fn();
    const rws = new ReconnectingWebSocket('ws://x', {
      webSocketFactory: () => MockWebSocket,
      initialRetryMs: 100,
      backoffFactor: 2,
      jitterRatio: 0,
      maxRetryMs: 10_000,
    });
    rws.on('reconnect', reconnectSpy);
    // Simule perte du serveur
    MockWebSocket.instances[0].fireClose(1006, 'lost');
    expect(reconnectSpy).toHaveBeenCalledTimes(1);
    expect(reconnectSpy.mock.calls[0][0]).toEqual({ attempt: 1, delay: 100 });
    // Avance dans le temps -> nouvelle instance creee
    vi.advanceTimersByTime(100);
    expect(MockWebSocket.instances.length).toBe(2);
    rws.close();
  });

  it("close() volontaire n'entraine PAS de reconnexion", () => {
    const reconnectSpy = vi.fn();
    const rws = new ReconnectingWebSocket('ws://x', {
      webSocketFactory: () => MockWebSocket,
    });
    rws.on('reconnect', reconnectSpy);
    rws.close();
    MockWebSocket.instances[0].fireClose(1000, 'ok');
    vi.advanceTimersByTime(10_000);
    expect(reconnectSpy).not.toHaveBeenCalled();
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it('emet message avec le detail event brut', () => {
    const messageSpy = vi.fn();
    const rws = new ReconnectingWebSocket('ws://x', {
      webSocketFactory: () => MockWebSocket,
    });
    rws.on('message', messageSpy);
    MockWebSocket.instances[0].fireOpen();
    MockWebSocket.instances[0].fireMessage('hello');
    expect(messageSpy).toHaveBeenCalledTimes(1);
    expect(messageSpy.mock.calls[0][0]).toEqual({ data: 'hello' });
    rws.close();
  });

  it('off() retire un listener', () => {
    const cb = vi.fn();
    const rws = new ReconnectingWebSocket('ws://x', {
      webSocketFactory: () => MockWebSocket,
    });
    rws.on('open', cb);
    rws.off('open', cb);
    MockWebSocket.instances[0].fireOpen();
    expect(cb).not.toHaveBeenCalled();
    rws.close();
  });
});
