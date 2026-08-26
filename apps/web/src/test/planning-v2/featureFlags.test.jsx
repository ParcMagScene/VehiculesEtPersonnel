/**
 * Tests Vitest — router/featureFlags.js (T-P0-05)
 *
 * Vérifie la détection des feature flags client (URL + localStorage)
 * ainsi que le hook useFeatureFlag.
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readFeatureFlag, setFeatureFlag, useFeatureFlag } from '../../router/featureFlags';

const ORIGINAL_LOCATION = window.location;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  // Restore location if a test replaced search
  window.history.replaceState({}, '', ORIGINAL_LOCATION.pathname);
});

describe('readFeatureFlag', () => {
  it('off par défaut', () => {
    expect(readFeatureFlag('v2Planning')).toBe(false);
  });

  it('on via localStorage', () => {
    window.localStorage.setItem('emag_flag_v2Planning', '1');
    expect(readFeatureFlag('v2Planning')).toBe(true);
  });

  it('on via ?v=2 quand module correspondant', () => {
    window.history.replaceState({}, '', '/?module=planning&v=2');
    expect(readFeatureFlag('v2Planning')).toBe(true);
  });

  it('reste off avec ?v=2 mais module différent', () => {
    window.history.replaceState({}, '', '/?module=stock&v=2');
    expect(readFeatureFlag('v2Planning')).toBe(false);
  });

  it('accepte override moduleParam explicite', () => {
    window.history.replaceState({}, '', '/?v=2');
    expect(readFeatureFlag('v2Planning', { moduleParam: 'planning' })).toBe(true);
  });
});

describe('setFeatureFlag', () => {
  it('persiste on/off dans localStorage', () => {
    setFeatureFlag('v2Planning', true);
    expect(window.localStorage.getItem('emag_flag_v2Planning')).toBe('1');
    setFeatureFlag('v2Planning', false);
    expect(window.localStorage.getItem('emag_flag_v2Planning')).toBeNull();
  });
});

describe('useFeatureFlag', () => {
  it('renvoie la valeur initiale et se met à jour sur storage event', () => {
    const { result, rerender } = renderHook(() => useFeatureFlag('v2Planning'));
    expect(result.current).toBe(false);

    act(() => {
      window.localStorage.setItem('emag_flag_v2Planning', '1');
      window.dispatchEvent(new StorageEvent('storage'));
    });
    rerender();
    expect(result.current).toBe(true);
  });
});
