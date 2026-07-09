/**
 * Tests Vitest — TasksPanelV2 mutations (T-P0-05b)
 *
 * Vérifie l'intégration des dialogs Create/Edit/Delete avec l'ApiClient v2.
 * `api.listV2Tasks`, `api.createV2Task`, `api.updateV2Task`, `api.deleteV2Task`
 * sont mockés.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TasksPanelV2 from '../../components/planning-v2/TasksPanelV2';
import api from '../../utils/api';

const TASK_SAMPLE = {
  id: 'ffffffffffffffffffffffffffffffff',
  date: '2026-08-01',
  period: 'AM',
  section: 'manual',
  title: 'Tâche existante',
  status: 'pending',
  visible: 1,
};

function mockListOk(items) {
  api.listV2Tasks.mockResolvedValue({
    success: true,
    data: items,
    meta: {
      protocol_version: 1,
      pagination: { cursor: null, next_cursor: null, limit: 50, has_more: false },
      count: items.length,
    },
  });
}

beforeEach(() => {
  vi.spyOn(api, 'listV2Tasks');
  vi.spyOn(api, 'createV2Task').mockResolvedValue({
    success: true,
    data: { ...TASK_SAMPLE, id: 'newid00000000000000000000000000', title: 'Nouvelle' },
    meta: { protocol_version: 1 },
  });
  vi.spyOn(api, 'updateV2Task').mockResolvedValue({
    success: true,
    data: { ...TASK_SAMPLE, title: 'Éditée' },
    meta: { protocol_version: 1 },
  });
  vi.spyOn(api, 'deleteV2Task').mockResolvedValue({
    success: true,
    data: { id: TASK_SAMPLE.id, deleted: true },
    meta: { protocol_version: 1 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TasksPanelV2 mutations (T-P0-05b)', () => {
  it('bouton "Nouvelle tâche" ouvre le form dialog', async () => {
    mockListOk([TASK_SAMPLE]);
    const user = userEvent.setup();
    render(<TasksPanelV2 />);

    await waitFor(() => {
      expect(screen.getByText('Tâche existante')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /créer une nouvelle tâche planning v2/i }));

    expect(screen.getByRole('form', { name: /nouvelle tâche/i })).toBeInTheDocument();
  });

  it('création : POST /api/v2/planning/tasks puis refresh', async () => {
    mockListOk([TASK_SAMPLE]);
    const user = userEvent.setup();
    render(<TasksPanelV2 />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /créer une nouvelle tâche/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /créer une nouvelle tâche planning v2/i }));

    const dateInput = screen.getByLabelText(/^date/i);
    await user.type(dateInput, '2026-09-01');

    await user.click(screen.getByRole('button', { name: /^créer$/i }));

    await waitFor(() => {
      expect(api.createV2Task).toHaveBeenCalledTimes(1);
    });
    // refresh appelle listV2Tasks une seconde fois
    await waitFor(() => {
      expect(api.listV2Tasks).toHaveBeenCalledTimes(2);
    });
  });

  it('édition : PUT /api/v2/planning/tasks/:id puis refresh', async () => {
    mockListOk([TASK_SAMPLE]);
    const user = userEvent.setup();
    render(<TasksPanelV2 />);

    await waitFor(() => expect(screen.getByText('Tâche existante')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /modifier la tâche tâche existante/i }));
    // Form pré-rempli
    expect(screen.getByDisplayValue('Tâche existante')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(api.updateV2Task).toHaveBeenCalledWith(TASK_SAMPLE.id, expect.any(Object)),
    );
  });

  it('suppression : Dialog danger destructive puis DELETE + refresh', async () => {
    mockListOk([TASK_SAMPLE]);
    const user = userEvent.setup();
    render(<TasksPanelV2 />);

    await waitFor(() => expect(screen.getByText('Tâche existante')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /supprimer la tâche tâche existante/i }));
    expect(screen.getByText(/supprimer cette tâche/i)).toBeInTheDocument();

    // Bouton Confirmer du Dialog (label "Supprimer" dans variant danger)
    const confirmBtn = screen
      .getAllByRole('button', { name: /supprimer/i })
      .find((el) => el.textContent?.trim() === 'Supprimer');
    expect(confirmBtn).toBeDefined();
    await user.click(confirmBtn);

    await waitFor(() => expect(api.deleteV2Task).toHaveBeenCalledWith(TASK_SAMPLE.id));
  });

  it("affiche l'erreur backend en cas d'échec de création", async () => {
    mockListOk([TASK_SAMPLE]);
    const err = new Error('Refusé');
    err.response = {
      status: 400,
      data: { error: 'section invalide', code: 'PLANNING_V2_VALIDATION' },
    };
    api.createV2Task.mockRejectedValueOnce(err);

    const user = userEvent.setup();
    render(<TasksPanelV2 />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /créer une nouvelle tâche/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /créer une nouvelle tâche planning v2/i }));
    await user.type(screen.getByLabelText(/^date/i), '2026-09-01');
    await user.click(screen.getByRole('button', { name: /^créer$/i }));

    await waitFor(() => {
      expect(screen.getByText(/section invalide/i)).toBeInTheDocument();
    });
  });
});
