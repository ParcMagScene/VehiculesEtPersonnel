import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSwipeBack from '../hooks/useSwipeBack';

const touch = (clientX, clientY = 0) => ({
  touches: [{ clientX, clientY }],
});

describe('useSwipeBack', () => {
  it('retourne swipeBackProps et swipeProgress', () => {
    const { result } = renderHook(() => useSwipeBack(vi.fn()));
    expect(result.current.swipeBackProps).toHaveProperty('onTouchStart');
    expect(result.current.swipeBackProps).toHaveProperty('onTouchMove');
    expect(result.current.swipeBackProps).toHaveProperty('onTouchEnd');
    expect(result.current.swipeProgress).toBe(0);
  });

  it('ignore le touch hors du bord gauche (> edgeWidth)', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack, { edgeWidth: 30 }));

    act(() => result.current.swipeBackProps.onTouchStart(touch(50)));
    act(() => result.current.swipeBackProps.onTouchMove(touch(200)));
    act(() => result.current.swipeBackProps.onTouchEnd());

    expect(result.current.swipeProgress).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('detecte le swipe depuis le bord gauche', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack, { edgeWidth: 30, threshold: 100 }));

    act(() => result.current.swipeBackProps.onTouchStart(touch(10)));
    act(() => result.current.swipeBackProps.onTouchMove(touch(60)));

    expect(result.current.swipeProgress).toBe(0.5); // 50/100
  });

  it('appelle onBack quand le seuil est depasse', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack, { edgeWidth: 30, threshold: 100 }));

    act(() => result.current.swipeBackProps.onTouchStart(touch(10)));
    act(() => result.current.swipeBackProps.onTouchMove(touch(120)));
    // swipeProgress should be 1 (capped)
    expect(result.current.swipeProgress).toBe(1);

    act(() => result.current.swipeBackProps.onTouchEnd());
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(result.current.swipeProgress).toBe(0); // reset
  });

  it('annule si le mouvement vertical depasse horizontal', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack, { edgeWidth: 30, threshold: 100 }));

    act(() => result.current.swipeBackProps.onTouchStart(touch(10, 0)));
    // dy=100, dx=20 → vertical > horizontal → cancel
    act(() => result.current.swipeBackProps.onTouchMove(touch(30, 100)));

    expect(result.current.swipeProgress).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('ne fait rien quand disabled', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack, { disabled: true }));

    act(() => result.current.swipeBackProps.onTouchStart(touch(5)));
    act(() => result.current.swipeBackProps.onTouchMove(touch(200)));
    act(() => result.current.swipeBackProps.onTouchEnd());

    expect(result.current.swipeProgress).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('reset swipeProgress apres touchEnd sans depasser le seuil', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack, { threshold: 100 }));

    act(() => result.current.swipeBackProps.onTouchStart(touch(10)));
    act(() => result.current.swipeBackProps.onTouchMove(touch(50)));
    expect(result.current.swipeProgress).toBe(0.4);

    act(() => result.current.swipeBackProps.onTouchEnd());
    expect(result.current.swipeProgress).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('cap swipeProgress a 1 maximum', () => {
    const { result } = renderHook(() => useSwipeBack(vi.fn(), { threshold: 50 }));

    act(() => result.current.swipeBackProps.onTouchStart(touch(10)));
    act(() => result.current.swipeBackProps.onTouchMove(touch(200)));

    expect(result.current.swipeProgress).toBe(1);
  });
});
