import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRefreshSubscription } from '../hooks/useRefreshSubscription';
import { refreshBus } from '../utils/refresh-bus';

describe('useRefreshSubscription', () => {
  it('appelle le handler à chaque publish de la clé souscrite', () => {
    const handler = vi.fn();
    renderHook(() => useRefreshSubscription('affaires', handler));

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(handler).toHaveBeenCalledTimes(1);

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("ignore les publish sur d'autres clés", () => {
    const handler = vi.fn();
    renderHook(() => useRefreshSubscription('affaires', handler));

    act(() => {
      refreshBus.publish('vehicles');
      refreshBus.publish('reservations');
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('se désabonne automatiquement au démontage', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useRefreshSubscription('affaires', handler));

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('se réabonne lorsque la clé change', () => {
    const handler = vi.fn();
    const { rerender } = renderHook(({ key }) => useRefreshSubscription(key, handler), {
      initialProps: { key: 'affaires' },
    });

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(handler).toHaveBeenCalledTimes(1);

    rerender({ key: 'vehicles' });

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(handler).toHaveBeenCalledTimes(1);

    act(() => {
      refreshBus.publish('vehicles');
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('ne souscrit pas si la clé est absente ou le handler invalide', () => {
    const handler = vi.fn();
    renderHook(() => useRefreshSubscription('', handler));
    renderHook(() => useRefreshSubscription('affaires', null));
    renderHook(() => useRefreshSubscription(undefined, handler));

    act(() => {
      refreshBus.publish('affaires');
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
