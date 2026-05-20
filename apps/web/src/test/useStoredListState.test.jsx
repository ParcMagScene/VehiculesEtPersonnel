/**
 * Tests useStoredListState — N5 audit nav.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useStoredListState } from '../hooks/useStoredListState';

describe('useStoredListState', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('retourne defaultValue si rien en storage', () => {
    const { result } = renderHook(() => useStoredListState('test:empty', { search: '', page: 1 }));
    expect(result.current[0]).toEqual({ search: '', page: 1 });
  });

  it('persiste les changements dans sessionStorage par défaut', () => {
    const { result } = renderHook(() => useStoredListState('test:filters', { q: '' }));
    act(() => result.current[1]({ q: 'foo' }));
    expect(result.current[0]).toEqual({ q: 'foo' });
    expect(JSON.parse(sessionStorage.getItem('test:filters'))).toEqual({ q: 'foo' });
  });

  it('lit la valeur initiale depuis sessionStorage', () => {
    sessionStorage.setItem('test:restore', JSON.stringify({ page: 5 }));
    const { result } = renderHook(() => useStoredListState('test:restore', { page: 1 }));
    expect(result.current[0]).toEqual({ page: 5 });
  });

  it('supporte updater functionnel comme useState', () => {
    const { result } = renderHook(() => useStoredListState('test:fn', { n: 0 }));
    act(() => result.current[1]((prev) => ({ n: prev.n + 1 })));
    act(() => result.current[1]((prev) => ({ n: prev.n + 10 })));
    expect(result.current[0]).toEqual({ n: 11 });
  });

  it('reset() vide le storage et revient à defaultValue', () => {
    const { result } = renderHook(() => useStoredListState('test:reset', { q: '' }));
    act(() => result.current[1]({ q: 'bar' }));
    expect(sessionStorage.getItem('test:reset')).not.toBeNull();
    act(() => result.current[2]());
    expect(result.current[0]).toEqual({ q: '' });
    expect(sessionStorage.getItem('test:reset')).toBeNull();
  });

  it('JSON corrompu en storage → retombe sur defaultValue', () => {
    sessionStorage.setItem('test:bad', '{not-json');
    const { result } = renderHook(() => useStoredListState('test:bad', { ok: true }));
    expect(result.current[0]).toEqual({ ok: true });
  });

  it("backend 'local' utilise localStorage", () => {
    const { result } = renderHook(() =>
      useStoredListState('test:local', { q: '' }, { backend: 'local' }),
    );
    act(() => result.current[1]({ q: 'persist' }));
    expect(JSON.parse(localStorage.getItem('test:local'))).toEqual({ q: 'persist' });
    expect(sessionStorage.getItem('test:local')).toBeNull();
  });

  it('backend invalide → fallback session', () => {
    const { result } = renderHook(() =>
      useStoredListState('test:fallback', { q: '' }, { backend: 'cookie' }),
    );
    act(() => result.current[1]({ q: 'x' }));
    expect(sessionStorage.getItem('test:fallback')).not.toBeNull();
  });
});
