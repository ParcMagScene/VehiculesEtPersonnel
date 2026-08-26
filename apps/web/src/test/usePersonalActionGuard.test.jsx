import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import usePersonalActionGuard from '../hooks/usePersonalActionGuard.js';

// ── Mocks ────────────────────────────────────────────────────────
// Le hook importe depuis '../utils/api' (barrel) qui réexporte `{ api, default }`
// depuis './api/index.js'. On mocke donc le module index.js avec les deux exports.
const { apiMock } = vi.hoisted(() => ({
  apiMock: { performPersonalAction: vi.fn() },
}));
vi.mock('../utils/api/index.js', () => ({
  default: apiMock,
  api: apiMock,
  getApiUrl: () => '/api',
}));

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../utils/api/index.js';

describe('usePersonalActionGuard', () => {
  beforeEach(() => {
    api.performPersonalAction.mockReset();
    useAuth.mockReset();
  });

  it('compte perso normal : appelle direct() et bypass la modal', async () => {
    useAuth.mockReturnValue({ isTeamAccount: false });
    const direct = vi.fn().mockResolvedValue({ id: 99 });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => usePersonalActionGuard());
    let promise;
    await act(async () => {
      promise = result.current.run({
        actionType: 'create_assignment',
        payload: { foo: 'bar' },
        direct,
        onSuccess,
      });
      await promise;
    });

    expect(direct).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ id: 99 });
    expect(api.performPersonalAction).not.toHaveBeenCalled();
    expect(result.current.dialogProps.isOpen).toBe(false);
  });

  it('compte perso normal : propage l’erreur direct() et appelle onError', async () => {
    useAuth.mockReturnValue({ isTeamAccount: false });
    const err = new Error('boom');
    const direct = vi.fn().mockRejectedValue(err);
    const onError = vi.fn();

    const { result } = renderHook(() => usePersonalActionGuard());
    await expect(
      act(async () => {
        await result.current.run({
          actionType: 'create_assignment',
          payload: {},
          direct,
          onError,
        });
      }),
    ).rejects.toThrow('boom');
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('compte Equipe : ouvre la modal sans appeler l’API immédiatement', async () => {
    useAuth.mockReturnValue({ isTeamAccount: true });
    const direct = vi.fn();
    const onSuccess = vi.fn();

    const { result } = renderHook(() => usePersonalActionGuard());
    await act(async () => {
      await result.current.run({
        actionType: 'create_assignment',
        payload: { date: '2026-06-10' },
        defaultPersonId: 42,
        actionLabel: 'Confirmer',
        direct,
        onSuccess,
      });
    });

    expect(direct).not.toHaveBeenCalled();
    expect(api.performPersonalAction).not.toHaveBeenCalled();
    expect(result.current.dialogProps.isOpen).toBe(true);
    expect(result.current.dialogProps.defaultPersonId).toBe(42);
    expect(result.current.dialogProps.actionLabel).toBe('Confirmer');
  });

  it('compte Equipe : handleConfirm appelle l’API et déclenche onSuccess + close', async () => {
    useAuth.mockReturnValue({ isTeamAccount: true });
    api.performPersonalAction.mockResolvedValue({
      success: true,
      person: { id: 42 },
      result: { id: 7 },
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => usePersonalActionGuard());
    await act(async () => {
      await result.current.run({
        actionType: 'create_assignment',
        payload: { date: '2026-06-10' },
        defaultPersonId: 42,
        onSuccess,
      });
    });

    expect(result.current.dialogProps.isOpen).toBe(true);

    await act(async () => {
      await result.current.dialogProps.onConfirm({
        personId: 42,
        pin: '1234',
        password: '',
      });
    });

    expect(api.performPersonalAction).toHaveBeenCalledWith({
      personId: 42,
      pin: '1234',
      password: '',
      actionType: 'create_assignment',
      payload: { date: '2026-06-10' },
    });
    expect(onSuccess).toHaveBeenCalledWith({
      success: true,
      person: { id: 42 },
      result: { id: 7 },
    });
    expect(result.current.dialogProps.isOpen).toBe(false);
  });

  it('compte Equipe : handleConfirm throw sur erreur API (modal reste ouverte)', async () => {
    useAuth.mockReturnValue({ isTeamAccount: true });
    api.performPersonalAction.mockResolvedValue({
      success: false,
      error: 'Identifiants incorrects',
    });

    const { result } = renderHook(() => usePersonalActionGuard());
    await act(async () => {
      await result.current.run({
        actionType: 'request_leave',
        payload: {},
      });
    });

    await expect(
      act(async () => {
        await result.current.dialogProps.onConfirm({
          personId: 1,
          pin: '0000',
          password: '',
        });
      }),
    ).rejects.toThrow('Identifiants incorrects');

    expect(result.current.dialogProps.isOpen).toBe(true);
  });

  it('closeDialog réinitialise l’état', async () => {
    useAuth.mockReturnValue({ isTeamAccount: true });
    const { result } = renderHook(() => usePersonalActionGuard());
    await act(async () => {
      await result.current.run({ actionType: 'declare_unavailability', payload: {} });
    });
    expect(result.current.dialogProps.isOpen).toBe(true);
    act(() => result.current.dialogProps.onClose());
    expect(result.current.dialogProps.isOpen).toBe(false);
  });

  it('compte Equipe : onCancel est appelé quand l’utilisateur ferme la modal', async () => {
    useAuth.mockReturnValue({ isTeamAccount: true });
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePersonalActionGuard());
    await act(async () => {
      await result.current.run({
        actionType: 'create_assignment',
        payload: {},
        onCancel,
      });
    });
    expect(result.current.dialogProps.isOpen).toBe(true);
    act(() => result.current.dialogProps.onClose());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.isOpen).toBe(false);
  });
});
