import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePullToRefresh from '../hooks/usePullToRefresh';

const touch = (clientY) => ({
  touches: [{ clientY }],
});

describe('usePullToRefresh', () => {
  it('retourne containerProps, indicatorNode et isRefreshing', () => {
    const { result } = renderHook(() => usePullToRefresh(vi.fn()));
    expect(result.current.containerProps).toHaveProperty('onTouchStart');
    expect(result.current.containerProps).toHaveProperty('onTouchMove');
    expect(result.current.containerProps).toHaveProperty('onTouchEnd');
    expect(result.current.containerProps).toHaveProperty('ref');
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.indicatorNode).toBeNull();
  });

  it('met a jour pullDistance avec resistance lors du pull', () => {
    const { result } = renderHook(() => usePullToRefresh(vi.fn(), { threshold: 80, maxPull: 120 }));

    // Simuler containerRef.current avec scrollTop = 0
    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 0 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    // Pull de 60px → 60 * 0.5 = 30, > 10 donc pulling=true
    act(() => result.current.containerProps.onTouchMove(touch(160)));

    expect(result.current.indicatorNode).not.toBeNull();
    // distance = min(60 * 0.5, 120) = 30
    expect(result.current.indicatorNode.style.height).toBe(30);
  });

  it('declenche onRefresh quand le seuil est depasse', async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => usePullToRefresh(onRefresh, { threshold: 80 }));

    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 0 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    // Pull de 200px → 200 * 0.5 = 100 > threshold 80
    act(() => result.current.containerProps.onTouchMove(touch(300)));

    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('ne declenche pas si le pull est sous le seuil', async () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => usePullToRefresh(onRefresh, { threshold: 80 }));

    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 0 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    // Pull de 40px → 40 * 0.5 = 20 < threshold 80
    act(() => result.current.containerProps.onTouchMove(touch(140)));

    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ne fait rien quand disabled', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => usePullToRefresh(onRefresh, { disabled: true }));

    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 0 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    act(() => result.current.containerProps.onTouchMove(touch(300)));

    expect(result.current.indicatorNode).toBeNull();
  });

  it('ne fait rien quand scrollTop > 0', () => {
    const { result } = renderHook(() => usePullToRefresh(vi.fn()));

    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 50 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    act(() => result.current.containerProps.onTouchMove(touch(300)));

    // pullDistance should remain 0
    expect(result.current.indicatorNode).toBeNull();
  });

  it('cap la distance au maxPull', () => {
    const { result } = renderHook(() => usePullToRefresh(vi.fn(), { maxPull: 60 }));

    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 0 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    // Pull de 500px → 500 * 0.5 = 250, capped at maxPull=60
    act(() => result.current.containerProps.onTouchMove(touch(600)));

    expect(result.current.indicatorNode.style.height).toBe(60);
  });

  it('reset indicatorNode apres touchEnd', async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => usePullToRefresh(onRefresh, { threshold: 80 }));

    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 0 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    act(() => result.current.containerProps.onTouchMove(touch(300)));

    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });

    // After refresh completes, pullDistance=0
    expect(result.current.indicatorNode).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it('gere les erreurs de onRefresh sans crash', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onRefresh = vi.fn(() => Promise.reject(new Error('fail')));
    const { result } = renderHook(() => usePullToRefresh(onRefresh, { threshold: 80 }));

    act(() => {
      result.current.containerProps.ref.current = { scrollTop: 0 };
    });

    act(() => result.current.containerProps.onTouchStart(touch(100)));
    act(() => result.current.containerProps.onTouchMove(touch(300)));

    await act(async () => {
      await result.current.containerProps.onTouchEnd();
    });

    expect(onRefresh).toHaveBeenCalled();
    expect(result.current.isRefreshing).toBe(false);
    consoleSpy.mockRestore();
  });
});
