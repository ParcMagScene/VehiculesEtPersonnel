/**
 * Tests useMobileRouter — extension query params (Lot L0, audit 2026-05-20).
 * Complète useMobileRouter.test.jsx (couverture historique conservée).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import useMobileRouter from '../hooks/useMobileRouter';

describe('useMobileRouter — query params', () => {
  let originalHash;

  beforeEach(() => {
    originalHash = window.location.hash;
    window.location.hash = '#/mobile';
  });

  afterEach(() => {
    window.location.hash = originalHash || '';
  });

  it('params est {} par défaut', () => {
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.params).toEqual({});
  });

  it('parse les params depuis le hash au boot', () => {
    window.location.hash = '#/mobile/affaires?sel=AF-2026-001&q=foo';
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('affaires');
    expect(result.current.params).toEqual({ sel: 'AF-2026-001', q: 'foo' });
  });

  it('navigate(screen) sans params → hash propre', () => {
    const { result } = renderHook(() => useMobileRouter());
    act(() => result.current.navigate('affaires'));
    expect(window.location.hash).toBe('#/mobile/affaires');
  });

  it('navigate(screen, params) → hash avec query string', () => {
    const { result } = renderHook(() => useMobileRouter());
    act(() => result.current.navigate('affaires', { sel: 'AF-1', q: 'truc' }));
    expect(window.location.hash).toBe('#/mobile/affaires?sel=AF-1&q=truc');
  });

  it('navigate ignore les params vides / null', () => {
    const { result } = renderHook(() => useMobileRouter());
    act(() =>
      result.current.navigate('affaires', { sel: 'AF-1', q: '', x: null, y: undefined }),
    );
    expect(window.location.hash).toBe('#/mobile/affaires?sel=AF-1');
  });

  it('setParams merge partiel + replaceState (pas de pushState)', () => {
    window.location.hash = '#/mobile/affaires?sel=AF-1';
    const { result } = renderHook(() => useMobileRouter());
    const before = window.history.length;
    act(() => result.current.setParams({ q: 'foo' }));
    expect(window.location.hash).toBe('#/mobile/affaires?sel=AF-1&q=foo');
    expect(result.current.params).toEqual({ sel: 'AF-1', q: 'foo' });
    expect(window.history.length).toBe(before); // replaceState
  });

  it('setParams({ key: null }) supprime la clé', () => {
    window.location.hash = '#/mobile/affaires?sel=AF-1&q=foo';
    const { result } = renderHook(() => useMobileRouter());
    act(() => result.current.setParams({ q: null }));
    expect(window.location.hash).toBe('#/mobile/affaires?sel=AF-1');
    expect(result.current.params).toEqual({ sel: 'AF-1' });
  });

  it('setParams supporte un updater fonctionnel', () => {
    window.location.hash = '#/mobile/affaires?sel=AF-1';
    const { result } = renderHook(() => useMobileRouter());
    act(() => result.current.setParams((p) => ({ ...p, count: '1' })));
    act(() =>
      result.current.setParams((p) => ({ ...p, count: String(Number(p.count) + 1) })),
    );
    expect(result.current.params).toEqual({ sel: 'AF-1', count: '2' });
  });

  it('goBack() reset les params à {}', () => {
    window.location.hash = '#/mobile/affaires?sel=AF-1&q=foo';
    const { result } = renderHook(() => useMobileRouter());
    act(() => result.current.goBack());
    expect(result.current.currentScreen).toBe('home');
    expect(result.current.params).toEqual({});
    expect(window.location.hash).toBe('#/mobile');
  });

  it('hashchange (back navigateur) met à jour les params', () => {
    const { result } = renderHook(() => useMobileRouter());
    act(() => {
      window.location.hash = '#/mobile/leaves?view=admin&filter=pending';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.currentScreen).toBe('leaves');
    expect(result.current.params).toEqual({ view: 'admin', filter: 'pending' });
  });

  it('QR deep link conserve les params', () => {
    window.location.hash = '#/mobile/equipment/EMAG-42?step=defaut';
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('qr-landing');
    expect(result.current.qrUid).toBe('EMAG-42');
    expect(result.current.params).toEqual({ step: 'defaut' });
  });

  it('valeurs non-string sérialisées proprement', () => {
    const { result } = renderHook(() => useMobileRouter());
    act(() => result.current.navigate('affaires', { sel: 42, ok: true }));
    expect(window.location.hash).toBe('#/mobile/affaires?sel=42&ok=true');
  });
});
