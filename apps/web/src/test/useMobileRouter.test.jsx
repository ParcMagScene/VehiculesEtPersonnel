import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useMobileRouter, { BACK_TARGET, ROUTES } from '../hooks/useMobileRouter';

describe('useMobileRouter', () => {
  let originalHash;

  beforeEach(() => {
    originalHash = window.location.hash;
    window.location.hash = '#/mobile';
  });

  afterEach(() => {
    window.location.hash = originalHash || '';
  });

  /* ─── Initialisation ─── */
  it('initialise sur home si hash = #/mobile', () => {
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('home');
    expect(result.current.qrUid).toBeNull();
  });

  it('initialise sur le bon écran si hash existe', () => {
    window.location.hash = '#/mobile/planning';
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('planning');
  });

  it('met le hash par défaut si absent', () => {
    window.location.hash = '';
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('home');
    expect(window.location.hash).toBe('#/mobile');
  });

  /* ─── Navigation ─── */
  it("navigate() change le hash et l'écran", async () => {
    const { result } = renderHook(() => useMobileRouter());

    act(() => {
      result.current.navigate('messaging');
    });

    // hashchange est asynchrone dans jsdom — lire le hash directement
    expect(window.location.hash).toBe('#/mobile/messaging');
  });

  it('navigate() supporte tous les écrans définis', () => {
    const { result } = renderHook(() => useMobileRouter());
    for (const screen of Object.keys(ROUTES)) {
      act(() => {
        result.current.navigate(screen);
      });
      expect(window.location.hash).toBe('#' + ROUTES[screen]);
    }
  });

  /* ─── goBack ─── */
  it('goBack() depuis planning → parc-dashboard', () => {
    window.location.hash = '#/mobile/planning';
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('planning');

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentScreen).toBe('parc-dashboard');
    expect(window.location.hash).toBe('#/mobile/parc');
  });

  it('goBack() depuis affaires → home', () => {
    window.location.hash = '#/mobile/affaires';
    const { result } = renderHook(() => useMobileRouter());

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentScreen).toBe('home');
    expect(window.location.hash).toBe('#/mobile');
  });

  it('goBack() depuis home → ne fait rien', () => {
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('home');

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentScreen).toBe('home');
    expect(window.location.hash).toBe('#/mobile');
  });

  it('goBack() respecte la hiérarchie parc', () => {
    for (const screen of Object.keys(BACK_TARGET)) {
      window.location.hash = '#' + ROUTES[screen];
      const { result } = renderHook(() => useMobileRouter());
      const expectedParent = BACK_TARGET[screen];

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentScreen).toBe(expectedParent);
    }
  });

  /* ─── QR Deep Link ─── */
  it('détecte un QR deep link EMAG-XXXXX', () => {
    window.location.hash = '#/mobile/equipment/EMAG-00042';
    const { result } = renderHook(() => useMobileRouter());

    expect(result.current.currentScreen).toBe('qr-landing');
    expect(result.current.qrUid).toBe('EMAG-00042');
  });

  it('qrUid est null pour les routes normales', () => {
    window.location.hash = '#/mobile/equipment';
    const { result } = renderHook(() => useMobileRouter());

    expect(result.current.currentScreen).toBe('equipment');
    expect(result.current.qrUid).toBeNull();
  });

  /* ─── hashchange (simulé) ─── */
  it('réagit aux changements de hash (back navigateur)', () => {
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('home');

    act(() => {
      window.location.hash = '#/mobile/leaves';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current.currentScreen).toBe('leaves');
  });

  /* ─── Hash inconnu ─── */
  it('hash inconnu → fallback home', () => {
    window.location.hash = '#/mobile/unknown-screen';
    const { result } = renderHook(() => useMobileRouter());
    expect(result.current.currentScreen).toBe('home');
  });
});
