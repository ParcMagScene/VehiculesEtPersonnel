/**
 * Tests softReload — N2 audit nav (centralisation des window.location.reload()).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SOFT_RELOAD_EVENT_NAME, softReload } from '../utils/softReload';

describe('softReload', () => {
  let reloadSpy;
  let warnSpy;

  beforeEach(() => {
    reloadSpy = vi.fn();
    // jsdom : window.location.reload est non-configurable; on remplace toute location
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, reload: reloadSpy };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  it('appelle window.location.reload() avec la raison loggée', () => {
    softReload('auth-session-expired');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('reason=auth-session-expired'));
  });

  it('émet un CustomEvent app:soft-reload écoutable', () => {
    const handler = vi.fn();
    window.addEventListener(SOFT_RELOAD_EVENT_NAME, handler);
    softReload('error-boundary');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ reason: 'error-boundary' });
    window.removeEventListener(SOFT_RELOAD_EVENT_NAME, handler);
  });

  it("fallback 'unspecified' si la raison est manquante ou invalide", () => {
    softReload();
    softReload('');
    softReload(42);
    expect(warnSpy).toHaveBeenCalledTimes(3);
    warnSpy.mock.calls.forEach((call) => {
      expect(call[0]).toContain('reason=unspecified');
    });
  });

  it('respecte delayMs (reload différé)', () => {
    vi.useFakeTimers();
    softReload('backup-restored', { delayMs: 500 });
    expect(reloadSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(reloadSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('ignore les delayMs invalides (reload immédiat)', () => {
    softReload('test', { delayMs: -10 });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
