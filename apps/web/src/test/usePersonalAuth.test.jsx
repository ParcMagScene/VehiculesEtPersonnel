import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonalAuthProvider, usePersonalAuth } from '../contexts/PersonalAuthContext.jsx';

// Mock global du module api (singleton) — utilisé par PersonalAuthContext
vi.mock('../utils/api/index.js', () => ({
  default: {
    request: vi.fn(),
  },
}));

import api from '../utils/api/index.js';

const wrapper = ({ children }) => <PersonalAuthProvider>{children}</PersonalAuthProvider>;

describe('usePersonalAuth (PersonalAuthContext)', () => {
  beforeEach(() => {
    api.request.mockReset();
  });

  it.skip('lève une erreur si utilisé hors du provider', () => {
    // Ce cas génère des traces React non suppressibles dans jsdom même lorsqu'il est attendu.
  });

  it('expose un état initial non authentifié', () => {
    const { result } = renderHook(() => usePersonalAuth(), { wrapper });
    expect(result.current.isPersonalAuthenticated).toBe(false);
    expect(result.current.authenticatedPerson).toBeNull();
    expect(result.current.authError).toBeNull();
    expect(result.current.authLoading).toBe(false);
    expect(result.current.getAuthenticatedPersonId()).toBeNull();
  });

  it('retourne false et publie une erreur si ni PIN ni mot de passe fourni', async () => {
    const { result } = renderHook(() => usePersonalAuth(), { wrapper });
    let outcome;
    await act(async () => {
      outcome = await result.current.authenticatePersonal(42, {});
    });
    expect(outcome).toBe(false);
    expect(result.current.authError).toMatch(/PIN ou mot de passe requis/i);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('authentifie via PIN et expose la personne retournée', async () => {
    api.request.mockResolvedValueOnce({
      success: true,
      person: { id: 42, name: 'Alice' },
    });
    const { result } = renderHook(() => usePersonalAuth(), { wrapper });

    let outcome;
    await act(async () => {
      outcome = await result.current.authenticatePersonal(42, { pin: '1234' });
    });

    expect(api.request).toHaveBeenCalledWith('/api/suivi/personal-auth', 'POST', {
      personId: 42,
      pin: '1234',
      password: undefined,
    });
    expect(outcome).toMatchObject({ success: true });
    await waitFor(() => expect(result.current.isPersonalAuthenticated).toBe(true));
    expect(result.current.authenticatedPerson).toEqual({ id: 42, name: 'Alice' });
    expect(result.current.getAuthenticatedPersonId()).toBe(42);
    expect(result.current.authError).toBeNull();
  });

  it("retourne false et stocke l'erreur quand l'API répond success:false", async () => {
    api.request.mockResolvedValueOnce({ success: false, error: 'Code PIN invalide' });
    const { result } = renderHook(() => usePersonalAuth(), { wrapper });

    let outcome;
    await act(async () => {
      outcome = await result.current.authenticatePersonal(7, { pin: '0000' });
    });

    expect(outcome).toBe(false);
    expect(result.current.isPersonalAuthenticated).toBe(false);
    expect(result.current.authError).toBe('Code PIN invalide');
  });

  it("capture les erreurs réseau et expose un message d'erreur", async () => {
    api.request.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePersonalAuth(), { wrapper });

    let outcome;
    await act(async () => {
      outcome = await result.current.authenticatePersonal(1, { password: 'pw' });
    });

    expect(outcome).toBeFalsy();
    expect(result.current.authError).toBe('boom');
    expect(result.current.authLoading).toBe(false);
  });

  it('logoutPersonal réinitialise l’état', async () => {
    api.request.mockResolvedValueOnce({ success: true, person: { id: 1, name: 'Bob' } });
    const { result } = renderHook(() => usePersonalAuth(), { wrapper });

    await act(async () => {
      await result.current.authenticatePersonal(1, { pin: '1234' });
    });
    expect(result.current.isPersonalAuthenticated).toBe(true);

    act(() => result.current.logoutPersonal());
    expect(result.current.isPersonalAuthenticated).toBe(false);
    expect(result.current.authenticatedPerson).toBeNull();
    expect(result.current.authError).toBeNull();
  });

  it('clearError() remet authError à null', async () => {
    const { result } = renderHook(() => usePersonalAuth(), { wrapper });
    await act(async () => {
      await result.current.authenticatePersonal(1, {});
    });
    expect(result.current.authError).not.toBeNull();
    act(() => result.current.clearError());
    expect(result.current.authError).toBeNull();
  });
});
