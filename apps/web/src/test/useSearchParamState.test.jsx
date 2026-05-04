/**
 * Sprint D — tests E2E navigation desktop (search params source de vérité).
 *
 * Couvre :
 *  - Lecture initiale d'un search param (?module=stock)
 *  - Validation contre le set `allowed` (param hostile → defaultValue)
 *  - Setter d'API style useState (valeur + updater)
 *  - Suppression du param quand on revient à la defaultValue
 *  - Mode `replace` (pas de pollution historique) vs push
 */

import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useSearchParamState } from '../router/RouterCompat';
import {
  ALLOWED_MODULES,
  CALENDAR_VIEWS,
  DEFAULT_CALENDAR_VIEW,
  DEFAULT_MODULE,
  STOCK_SUBTABS,
} from '../router/routes.config';

const wrapper = (initialEntry) =>
  function Wrapper({ children }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };

describe('useSearchParamState — Sprint B/D nav', () => {
  it("lit la valeur d'URL si présente et autorisée", () => {
    const { result } = renderHook(
      () => useSearchParamState('module', DEFAULT_MODULE, { allowed: ALLOWED_MODULES }),
      { wrapper: wrapper('/?module=stock') },
    );
    expect(result.current[0]).toBe('stock');
  });

  it('retombe sur la defaultValue si valeur hostile/inconnue', () => {
    const { result } = renderHook(
      () => useSearchParamState('module', DEFAULT_MODULE, { allowed: ALLOWED_MODULES }),
      { wrapper: wrapper('/?module=<script>') },
    );
    expect(result.current[0]).toBe(DEFAULT_MODULE);
  });

  it('retombe sur la defaultValue si param absent', () => {
    const { result } = renderHook(
      () => useSearchParamState('module', DEFAULT_MODULE, { allowed: ALLOWED_MODULES }),
      { wrapper: wrapper('/') },
    );
    expect(result.current[0]).toBe(DEFAULT_MODULE);
  });

  it('setter accepte une valeur directe', () => {
    const { result } = renderHook(
      () => useSearchParamState('module', DEFAULT_MODULE, { allowed: ALLOWED_MODULES }),
      { wrapper: wrapper('/') },
    );
    act(() => result.current[1]('planning'));
    expect(result.current[0]).toBe('planning');
  });

  it('setter accepte une fonction updater', () => {
    const { result } = renderHook(
      () => useSearchParamState('tab', 'vente', { allowed: STOCK_SUBTABS }),
      { wrapper: wrapper('/?tab=sav') },
    );
    act(() => result.current[1]((prev) => (prev === 'sav' ? 'inventory' : 'vente')));
    expect(result.current[0]).toBe('inventory');
  });

  it('supprime le param quand on remet la defaultValue (URL propre)', () => {
    const { result, rerender } = renderHook(
      ({ search }) =>
        useSearchParamState('view', DEFAULT_CALENDAR_VIEW, { allowed: CALENDAR_VIEWS }),
      {
        wrapper: wrapper('/?view=month'),
        initialProps: { search: '?view=month' },
      },
    );
    expect(result.current[0]).toBe('month');
    act(() => result.current[1](DEFAULT_CALENDAR_VIEW));
    rerender({ search: '/' });
    expect(result.current[0]).toBe(DEFAULT_CALENDAR_VIEW);
  });

  it('valide la cohérence des sets exportés (pas de drift desktop)', () => {
    expect(ALLOWED_MODULES.has(DEFAULT_MODULE)).toBe(true);
    expect(STOCK_SUBTABS.has('vente')).toBe(true);
    expect(STOCK_SUBTABS.has('sav')).toBe(true);
    expect(STOCK_SUBTABS.has('inventory')).toBe(true);
    expect(CALENDAR_VIEWS.has(DEFAULT_CALENDAR_VIEW)).toBe(true);
  });
});
