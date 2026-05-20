/**
 * Tests useRefreshOnFocus — N4 audit nav.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

describe('useRefreshOnFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Force visibilityState mutable
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fireVisibilityChange() {
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('appelle refreshFn quand visibilitychange → visible (passé minIntervalMs)', () => {
    const fn = vi.fn();
    renderHook(() => useRefreshOnFocus(fn, { minIntervalMs: 1000 }));
    // Initial render → lastRunRef = now. Pour passer le throttle, avancer le temps.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => fireVisibilityChange());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throttle : 2 visibilitychange < minIntervalMs → 1 seul appel', () => {
    const fn = vi.fn();
    renderHook(() => useRefreshOnFocus(fn, { minIntervalMs: 5000 }));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    act(() => fireVisibilityChange());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => fireVisibilityChange());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("désactivé (enabled: false) → pas d'appel", () => {
    const fn = vi.fn();
    renderHook(() => useRefreshOnFocus(fn, { minIntervalMs: 100, enabled: false }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => fireVisibilityChange());
    expect(fn).not.toHaveBeenCalled();
  });

  it('window focus event déclenche aussi le refresh', () => {
    const fn = vi.fn();
    renderHook(() => useRefreshOnFocus(fn, { minIntervalMs: 100 }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => window.dispatchEvent(new Event('focus')));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('attrape une promesse rejetée sans crasher', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = vi.fn(() => Promise.reject(new Error('boom')));
    renderHook(() => useRefreshOnFocus(fn, { minIntervalMs: 100 }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => fireVisibilityChange());
    // Laisser la microtask de catch s'exécuter
    await vi.runAllTimersAsync();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
