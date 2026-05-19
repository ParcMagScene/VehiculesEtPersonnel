import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useListResource } from '../hooks/useListResource';
import { refreshBus } from '../utils/refresh-bus';

describe('useListResource', () => {
  it('charge la donnée au montage et expose data/loading', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { result } = renderHook(() => useListResource('controls', fetcher));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current.error).toBeNull();
  });

  it('relance le fetch sur publish de la clé souscrite', async () => {
    const fetcher = vi.fn().mockResolvedValue(['a']);
    const { result } = renderHook(() => useListResource('controls', fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetcher.mockResolvedValueOnce(['b']);
    await act(async () => {
      refreshBus.publish('controls');
    });
    await waitFor(() => expect(result.current.data).toEqual(['b']));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('accepte un tableau de clés', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    renderHook(() => useListResource(['controls', 'equipment'], fetcher));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => {
      refreshBus.publish('equipment');
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("capture l'erreur sans réinitialiser data", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce([1, 2, 3]);
    const { result } = renderHook(() => useListResource('controls', fetcher));
    await waitFor(() => expect(result.current.data).toEqual([1, 2, 3]));

    fetcher.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.data).toEqual([1, 2, 3]);
  });

  it('ne charge pas si enabled=false', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useListResource('controls', fetcher, { enabled: false }));

    expect(result.current.loading).toBe(false);
    await act(async () => {
      refreshBus.publish('controls');
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('ne charge pas au montage si autoLoad=false mais reload manuel fonctionne', async () => {
    const fetcher = vi.fn().mockResolvedValue(['x']);
    const { result } = renderHook(() =>
      useListResource('controls', fetcher, { autoLoad: false, initialData: [] }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.reload();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(['x']);
  });

  it('ignore une réponse périmée si un reload plus récent est arrivé', async () => {
    let resolveFirst;
    const firstPromise = new Promise((r) => {
      resolveFirst = r;
    });
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce(['fresh']);

    const { result } = renderHook(() => useListResource('controls', fetcher));

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toEqual(['fresh']);

    await act(async () => {
      resolveFirst(['stale']);
      await firstPromise;
    });
    expect(result.current.data).toEqual(['fresh']);
  });
});
