/**
 * Tests Vitest — TaskFormDialog (T-P0-05b)
 *
 * Vérifie :
 *   - rendu mode create (form vide, bouton "Créer")
 *   - rendu mode edit (form pré-rempli, bouton "Enregistrer")
 *   - validation locale : date requise
 *   - submit envoie un payload propre (trim, coerce)
 *   - affichage d'une erreur backend via `submitError`
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import TaskFormDialog from '../../components/planning-v2/TaskFormDialog';

function renderDialog(overrides = {}) {
  const props = {
    open: true,
    mode: 'create',
    initialTask: null,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    submitting: false,
    submitError: null,
    ...overrides,
  };
  const utils = render(<TaskFormDialog {...props} />);
  return { ...utils, props };
}

describe('TaskFormDialog', () => {
  it('rendu mode create : titre + bouton Créer', () => {
    renderDialog();
    expect(screen.getByRole('form', { name: /nouvelle tâche/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /créer/i })).toBeInTheDocument();
  });

  it('rendu mode edit : titre + bouton Enregistrer + valeurs pré-remplies', () => {
    renderDialog({
      mode: 'edit',
      initialTask: {
        id: 'abc',
        date: '2026-08-01',
        period: 'PM',
        section: 'chargement',
        title: 'Charger camion',
        notes: 'attention hayon',
        status: 'in_progress',
        person_id: 42,
        affaire_num: 'AF-2026-001',
        visible: 1,
      },
    });
    expect(screen.getByRole('form', { name: /modifier la tâche/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
    // Un champ pré-rempli est visible
    expect(screen.getByDisplayValue('Charger camion')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AF-2026-001')).toBeInTheDocument();
  });

  it('validation locale : refuse submit sans date (HTML5 required + fallback)', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    await user.click(screen.getByRole('button', { name: /créer/i }));
    // HTML5 `required` empêche onSubmit — le message natif du navigateur
    // gère l'affichage utilisateur ; côté test on vérifie l'absence d'appel.
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submit envoie un payload propre en mode create', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    // Saisit une date valide
    const dateInput = screen.getByLabelText(/^date/i);
    await user.type(dateInput, '2026-08-01');

    // Titre optionnel
    const titleInput = screen.getByLabelText(/^titre/i);
    await user.type(titleInput, '  Ma tâche  ');

    await user.click(screen.getByRole('button', { name: /créer/i }));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    const payload = props.onSubmit.mock.calls[0][0];
    expect(payload.date).toBe('2026-08-01');
    expect(payload.title).toBe('Ma tâche');
    expect(payload.section).toBe('manual'); // défaut
    expect(payload.status).toBe('pending'); // défaut
    expect(payload.visible).toBe(1); // checkbox coché par défaut
  });

  it('affiche une erreur backend via submitError', () => {
    renderDialog({ submitError: 'section invalide' });
    expect(screen.getByText(/section invalide/i)).toBeInTheDocument();
  });
});
