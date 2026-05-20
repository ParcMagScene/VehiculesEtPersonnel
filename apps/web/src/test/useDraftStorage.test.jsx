/**
 * Tests useDraftStorage — Lot L1 (audit persistance mobile 2026-05-20).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDraftStorage } from '../hooks/useDraftStorage';

describe('useDraftStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('retourne la valeur initiale si rien en storage', () => {
    const { result } = renderHook(() =>
      useDraftStorage('mobile:test:draft', { vehicleId: null, notes: '' }),
    );
    expect(result.current[0]).toEqual({ vehicleId: null, notes: '' });
    expect(result.current[2].isDirty).toBe(false);
  });

  it('persiste la valeur dans sessionStorage avec wrapper { value, savedAt }', () => {
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0 }));
    act(() => result.current[1]({ n: 5 }));
    const raw = JSON.parse(sessionStorage.getItem('mobile:test:draft'));
    expect(raw.value).toEqual({ n: 5 });
    expect(typeof raw.savedAt).toBe('number');
    expect(result.current[2].isDirty).toBe(true);
  });

  it('restaure la valeur depuis sessionStorage au mount', () => {
    sessionStorage.setItem(
      'mobile:test:draft',
      JSON.stringify({ value: { n: 42 }, savedAt: Date.now() }),
    );
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0 }));
    expect(result.current[0]).toEqual({ n: 42 });
    expect(result.current[2].isDirty).toBe(true);
  });

  it('updater fonctionnel comme useState', () => {
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0 }));
    act(() => result.current[1]((prev) => ({ n: prev.n + 1 })));
    act(() => result.current[1]((prev) => ({ n: prev.n + 10 })));
    expect(result.current[0]).toEqual({ n: 11 });
  });

  it('clear() vide storage et reset à initial', () => {
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0 }));
    act(() => result.current[1]({ n: 7 }));
    expect(sessionStorage.getItem('mobile:test:draft')).not.toBeNull();
    act(() => result.current[2].clear());
    expect(sessionStorage.getItem('mobile:test:draft')).toBeNull();
    expect(result.current[0]).toEqual({ n: 0 });
    expect(result.current[2].isDirty).toBe(false);
  });

  it('commit() est un alias de clear()', () => {
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0 }));
    act(() => result.current[1]({ n: 7 }));
    act(() => result.current[2].commit());
    expect(sessionStorage.getItem('mobile:test:draft')).toBeNull();
    expect(result.current[0]).toEqual({ n: 0 });
  });

  it('TTL expiré → retour à initial + nettoyage', () => {
    const expiredSavedAt = Date.now() - 25 * 60 * 60 * 1000; // 25 h
    sessionStorage.setItem(
      'mobile:test:draft',
      JSON.stringify({ value: { n: 99 }, savedAt: expiredSavedAt }),
    );
    const { result } = renderHook(() =>
      useDraftStorage('mobile:test:draft', { n: 0 }, { ttlMs: 24 * 60 * 60 * 1000 }),
    );
    expect(result.current[0]).toEqual({ n: 0 });
    expect(sessionStorage.getItem('mobile:test:draft')).toBeNull();
  });

  it('TTL non expiré → restauration normale', () => {
    sessionStorage.setItem(
      'mobile:test:draft',
      JSON.stringify({ value: { n: 99 }, savedAt: Date.now() - 1000 }),
    );
    const { result } = renderHook(() =>
      useDraftStorage('mobile:test:draft', { n: 0 }, { ttlMs: 24 * 60 * 60 * 1000 }),
    );
    expect(result.current[0]).toEqual({ n: 99 });
  });

  it('key null → pas de persistance (fallback useState pur)', () => {
    const { result } = renderHook(() => useDraftStorage(null, { n: 0 }));
    act(() => result.current[1]({ n: 5 }));
    expect(result.current[0]).toEqual({ n: 5 });
    expect(sessionStorage.length).toBe(0);
  });

  it('storage corrompu (JSON invalide) → fallback initial', () => {
    sessionStorage.setItem('mobile:test:draft', 'not-json-{{');
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0 }));
    expect(result.current[0]).toEqual({ n: 0 });
  });

  it('ancien format sans wrapper → ignoré, retour initial', () => {
    sessionStorage.setItem('mobile:test:draft', JSON.stringify({ n: 99 }));
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0 }));
    expect(result.current[0]).toEqual({ n: 0 });
  });

  it('isDirty reflète la divergence vs initial', () => {
    const { result } = renderHook(() => useDraftStorage('mobile:test:draft', { n: 0, q: '' }));
    expect(result.current[2].isDirty).toBe(false);
    act(() => result.current[1]({ n: 0, q: 'x' }));
    expect(result.current[2].isDirty).toBe(true);
    act(() => result.current[1]({ n: 0, q: '' }));
    expect(result.current[2].isDirty).toBe(false);
  });
});
