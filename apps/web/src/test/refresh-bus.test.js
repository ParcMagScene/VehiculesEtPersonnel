import { describe, expect, it } from 'vitest';

import { refreshBus } from '../utils/refresh-bus';

describe('refreshBus', () => {
  it('notifie tous les souscripteurs de la clé sur publish', () => {
    let countA = 0;
    let countB = 0;
    const unsubA = refreshBus.subscribe('vehicles', () => {
      countA += 1;
    });
    const unsubB = refreshBus.subscribe('vehicles', () => {
      countB += 1;
    });

    refreshBus.publish('vehicles');
    expect(countA).toBe(1);
    expect(countB).toBe(1);

    refreshBus.publish('vehicles');
    expect(countA).toBe(2);
    expect(countB).toBe(2);

    unsubA();
    unsubB();
  });

  it("n'invoque pas les handlers d'autres clés", () => {
    let triggered = 0;
    const unsub = refreshBus.subscribe('reservations', () => {
      triggered += 1;
    });

    refreshBus.publish('vehicles');
    refreshBus.publish('maintenances');
    expect(triggered).toBe(0);

    refreshBus.publish('reservations');
    expect(triggered).toBe(1);

    unsub();
  });

  it('subscribe renvoie une fonction de désabonnement', () => {
    let count = 0;
    const unsub = refreshBus.subscribe('equipment', () => {
      count += 1;
    });
    refreshBus.publish('equipment');
    expect(count).toBe(1);

    unsub();
    refreshBus.publish('equipment');
    expect(count).toBe(1);
  });

  it('tolère des entrées invalides sans lever', () => {
    expect(() => refreshBus.publish('')).not.toThrow();
    expect(() => refreshBus.publish(undefined)).not.toThrow();
    expect(() => refreshBus.publish(null)).not.toThrow();

    const unsub1 = refreshBus.subscribe('', () => {});
    const unsub2 = refreshBus.subscribe('vehicles', null);
    expect(typeof unsub1).toBe('function');
    expect(typeof unsub2).toBe('function');
    expect(() => unsub1()).not.toThrow();
    expect(() => unsub2()).not.toThrow();
  });
});
