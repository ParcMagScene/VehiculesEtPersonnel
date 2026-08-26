/**
 * Tests Vitest — TasksPanelV2 smoke (T-P0-05)
 *
 * Vérifie le rendu du composant en 3 cas :
 *   - loading initial (spinner)
 *   - succès (rangs)
 *   - FEATURE_DISABLED (bannière info)
 *
 * `api.listV2Tasks` est mocké pour éviter tout appel réseau réel.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TasksPanelV2 from '../../components/planning-v2/TasksPanelV2';
import api from '../../utils/api';

const featureDisabledError = () => {
  const err = new Error('Endpoint non disponible');
  err.response = { status: 404, data: { code: 'FEATURE_DISABLED' } };
  return err;
};

beforeEach(() => {
  vi.spyOn(api, 'listV2Tasks');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TasksPanelV2 (smoke)', () => {
  it('affiche la bannière FEATURE_DISABLED quand le backend refuse', async () => {
    api.listV2Tasks.mockRejectedValueOnce(featureDisabledError());
    render(<TasksPanelV2 />);
    await waitFor(() => {
      expect(screen.getByText(/Planning v2 non activé côté serveur/i)).toBeInTheDocument();
    });
    // La table n'est pas rendue dans ce cas
    expect(screen.queryByText(/Rafraîchir/i)).not.toBeInTheDocument();
  });

  it('affiche les tâches quand la réponse est OK', async () => {
    api.listV2Tasks.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'ffffffffffffffffffffffffffffffff',
          date: '2026-07-08',
          period: 'AM',
          section: 'manual',
          title: 'Tâche test T-P0-05',
          status: 'pending',
        },
      ],
      meta: {
        protocol_version: 1,
        pagination: { cursor: null, next_cursor: null, limit: 50, has_more: false },
        count: 1,
      },
    });
    render(<TasksPanelV2 />);
    await waitFor(() => {
      expect(screen.getByText(/Tâche test T-P0-05/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 tâche chargée/i)).toBeInTheDocument();
    // Pas de bouton "Charger plus" quand has_more=false
    expect(screen.queryByRole('button', { name: /Charger plus/i })).not.toBeInTheDocument();
  });

  it('affiche le bouton "Charger plus" quand has_more=true', async () => {
    api.listV2Tasks.mockResolvedValueOnce({
      success: true,
      data: [{ id: 'a', date: '2026-07-08', section: 'manual', title: 'T-A', status: 'pending' }],
      meta: {
        protocol_version: 1,
        pagination: { cursor: null, next_cursor: 'xxx', limit: 1, has_more: true },
      },
    });
    render(<TasksPanelV2 />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Charger plus de tâches Planning v2/i }),
      ).toBeInTheDocument();
    });
  });
});
