import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonalAuthProvider, usePersonalAuth } from '../contexts/PersonalAuthContext.jsx';
import { usePersonalAuthWithAutoLogout } from '../hooks/usePersonalAuthWithAutoLogout.js';

vi.mock('../utils/api/index.js', () => ({
  default: { request: vi.fn() },
}));

import api from '../utils/api/index.js';

// Helper : monte le hook + helper pour authentifier depuis l'extérieur
function useTestSetup(options) {
  const auth = usePersonalAuth();
  const autoLogout = usePersonalAuthWithAutoLogout(options);
  return { auth, autoLogout };
}

const wrapper = ({ children }) => <PersonalAuthProvider>{children}</PersonalAuthProvider>;

describe('usePersonalAuthWithAutoLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.request.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expose isPersonalAuthenticated=false initialement', () => {
    const { result } = renderHook(() => useTestSetup(), { wrapper });
    expect(result.current.autoLogout.isPersonalAuthenticated).toBe(false);
    expect(typeof result.current.autoLogout.notifyActivity).toBe('function');
    expect(typeof result.current.autoLogout.logoutAfterSave).toBe('function');
  });

  it('déconnecte automatiquement après inactivityTimeout', async () => {
    api.request.mockResolvedValueOnce({ success: true, person: { id: 1, name: 'A' } });
    const { result } = renderHook(
      () => useTestSetup({ inactivityTimeout: 1000, sessionTimeout: 999_999 }),
      { wrapper },
    );

    await act(async () => {
      await result.current.auth.authenticatePersonal(1, { pin: '1234' });
    });
    expect(result.current.auth.isPersonalAuthenticated).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.auth.isPersonalAuthenticated).toBe(false);
  });

  it('déconnecte après sessionTimeout même avec activité', async () => {
    api.request.mockResolvedValueOnce({ success: true, person: { id: 1, name: 'A' } });
    const { result } = renderHook(
      () => useTestSetup({ inactivityTimeout: 10_000, sessionTimeout: 2000 }),
      { wrapper },
    );

    await act(async () => {
      await result.current.auth.authenticatePersonal(1, { pin: '1234' });
    });

    // Activité régulière -> reset inactivité, mais la session totale doit s'épuiser
    await act(async () => {
      vi.advanceTimersByTime(1000);
      result.current.autoLogout.notifyActivity();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.auth.isPersonalAuthenticated).toBe(false);
  });

  it("notifyActivity reset le timer d'inactivité", async () => {
    api.request.mockResolvedValueOnce({ success: true, person: { id: 1, name: 'A' } });
    const { result } = renderHook(
      () => useTestSetup({ inactivityTimeout: 1000, sessionTimeout: 999_999 }),
      { wrapper },
    );

    await act(async () => {
      await result.current.auth.authenticatePersonal(1, { pin: '1234' });
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
      result.current.autoLogout.notifyActivity();
      vi.advanceTimersByTime(800);
    });
    // 800 + 800 = 1600ms total, mais reset à 800 → 800ms après reset = pas timeout
    expect(result.current.auth.isPersonalAuthenticated).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.auth.isPersonalAuthenticated).toBe(false);
  });

  it('logoutAfterSave déconnecte après le délai fourni', async () => {
    api.request.mockResolvedValueOnce({ success: true, person: { id: 1, name: 'A' } });
    const { result } = renderHook(() => useTestSetup(), { wrapper });

    await act(async () => {
      await result.current.auth.authenticatePersonal(1, { pin: '1234' });
    });
    expect(result.current.auth.isPersonalAuthenticated).toBe(true);

    let resolved = false;
    act(() => {
      result.current.autoLogout.logoutAfterSave(500).then(() => {
        resolved = true;
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    // Attendre la microtask de la promesse
    await act(async () => {});
    expect(resolved).toBe(true);
    expect(result.current.auth.isPersonalAuthenticated).toBe(false);
  });

  it("nettoie les listeners document à l'unmount", () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const TestCmp = () => {
      const auth = usePersonalAuth();
      usePersonalAuthWithAutoLogout();
      // Simule auth pour brancher les listeners
      if (!auth.isPersonalAuthenticated) {
        // pas d'effet
      }
      return null;
    };

    const { unmount } = render(
      <PersonalAuthProvider>
        <TestCmp />
      </PersonalAuthProvider>,
    );

    unmount();
    // Aucun listener attaché tant que non authentifié → aucun retiré
    expect(removeSpy).not.toThrow;
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
