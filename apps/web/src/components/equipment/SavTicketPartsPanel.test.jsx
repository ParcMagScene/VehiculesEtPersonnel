// apps/web/src/components/equipment/SavTicketPartsPanel.test.jsx
// Ticket : T-P1-07c.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks helpers T-P1-07b ───

vi.mock('../../utils/api', () => ({
  default: {},
}));

vi.mock('../../utils/sav/fetchSavParts.js', () => ({
  fetchSavPartsUnified: vi.fn(),
  addSavPartUnified: vi.fn(),
  updateSavPartStatusUnified: vi.fn(),
  transitionSavTicketUnified: vi.fn(),
}));

// readSavV2ClientFlag est le seul mock de v2Adapters : on garde
// les vrais constantes / matrices pour tester la logique reelle
// (getSavAllowedNext, SAV_PART_STATUSES, etc.).
vi.mock('../../utils/sav/v2Adapters.js', async () => {
  const actual = await vi.importActual('../../utils/sav/v2Adapters.js');
  return {
    ...actual,
    readSavV2ClientFlag: vi.fn(() => true),
  };
});

import {
  addSavPartUnified,
  fetchSavPartsUnified,
  transitionSavTicketUnified,
  updateSavPartStatusUnified,
} from '../../utils/sav/fetchSavParts.js';
import { readSavV2ClientFlag } from '../../utils/sav/v2Adapters.js';
import SavTicketPartsPanel from './SavTicketPartsPanel.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  readSavV2ClientFlag.mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SavTicketPartsPanel — comportement de base', () => {
  it('rend null si ticketId manquant', () => {
    const { container } = render(<SavTicketPartsPanel ticketId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le message "v2 désactivé" quand helper retourne null', async () => {
    fetchSavPartsUnified.mockResolvedValue(null);
    render(<SavTicketPartsPanel ticketId={42} />);
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalled());
    expect(await screen.findByText(/Namespace v2 SAV désactivé/i)).toBeInTheDocument();
  });

  it('affiche liste vide + message "aucune pièce" quand v2 renvoie []', async () => {
    fetchSavPartsUnified.mockResolvedValue({ parts: [], total: 0 });
    render(<SavTicketPartsPanel ticketId={42} />);
    expect(await screen.findByText(/Aucune pièce enregistrée/i)).toBeInTheDocument();
  });

  it('affiche les pièces retournées par le helper', async () => {
    fetchSavPartsUnified.mockResolvedValue({
      parts: [
        {
          id: 1,
          partName: 'Fusible 5A',
          partReference: 'F5A',
          quantity: 2,
          unitPrice: 3.5,
          supplier: 'ACME',
          status: 'ordered',
        },
      ],
      total: 1,
    });
    render(<SavTicketPartsPanel ticketId={42} />);
    expect(await screen.findByText('Fusible 5A')).toBeInTheDocument();
    expect(screen.getByText(/réf. F5A/)).toBeInTheDocument();
    expect(screen.getByText(/×2/)).toBeInTheDocument();
    expect(screen.getByText(/3\.50 €/)).toBeInTheDocument();
    expect(screen.getByText('ACME')).toBeInTheDocument();
  });
});

describe("SavTicketPartsPanel — ajout d'une pièce", () => {
  it('valide champ requis partName', async () => {
    fetchSavPartsUnified.mockResolvedValue({ parts: [], total: 0 });
    render(<SavTicketPartsPanel ticketId={42} />);
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter la pièce/i }));
    expect(await screen.findByText(/Le nom de la pièce est requis/i)).toBeInTheDocument();
    expect(addSavPartUnified).not.toHaveBeenCalled();
  });

  it('appelle addSavPartUnified avec payload adapte + refresh', async () => {
    fetchSavPartsUnified.mockResolvedValueOnce({ parts: [], total: 0 }).mockResolvedValueOnce({
      parts: [{ id: 1, partName: 'Nouvelle', quantity: 1, status: 'requested' }],
      total: 1,
    });
    addSavPartUnified.mockResolvedValue({ id: 1, partName: 'Nouvelle', quantity: 1 });

    render(<SavTicketPartsPanel ticketId={42} />);
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /Ajouter/i }));
    fireEvent.change(screen.getByPlaceholderText(/Fusible 5A/i), {
      target: { value: 'Nouvelle' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter la pièce/i }));

    await waitFor(() =>
      expect(addSavPartUnified).toHaveBeenCalledWith(
        {},
        42,
        expect.objectContaining({ partName: 'Nouvelle', quantity: 1 }),
        { useV2: true },
      ),
    );
    // Refresh apres ajout
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Pièce « Nouvelle » ajoutée/i)).toBeInTheDocument();
  });

  it('affiche erreur si addSavPartUnified retourne null', async () => {
    fetchSavPartsUnified.mockResolvedValue({ parts: [], total: 0 });
    addSavPartUnified.mockResolvedValue(null);
    render(<SavTicketPartsPanel ticketId={42} />);
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/i }));
    fireEvent.change(screen.getByPlaceholderText(/Fusible 5A/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter la pièce/i }));
    expect(await screen.findByText(/Impossible d'ajouter la pièce/i)).toBeInTheDocument();
  });
});

describe('SavTicketPartsPanel — changement de statut piece', () => {
  it('appelle updateSavPartStatusUnified + refresh', async () => {
    fetchSavPartsUnified
      .mockResolvedValueOnce({
        parts: [{ id: 10, partName: 'A', quantity: 1, status: 'requested' }],
        total: 1,
      })
      .mockResolvedValueOnce({
        parts: [{ id: 10, partName: 'A', quantity: 1, status: 'ordered' }],
        total: 1,
      });
    updateSavPartStatusUnified.mockResolvedValue({
      id: 10,
      partName: 'A',
      quantity: 1,
      status: 'ordered',
    });
    render(<SavTicketPartsPanel ticketId={42} />);
    const select = await screen.findByDisplayValue('Demandée');
    fireEvent.change(select, { target: { value: 'ordered' } });
    await waitFor(() =>
      expect(updateSavPartStatusUnified).toHaveBeenCalledWith({}, 10, 'ordered', {
        useV2: true,
      }),
    );
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalledTimes(2));
  });
});

describe('SavTicketPartsPanel — transition ticket (matrice)', () => {
  it("ne propose pas d'auto-transition + n'affiche pas le bloc si aucune cible", async () => {
    fetchSavPartsUnified.mockResolvedValue({ parts: [], total: 0 });
    // Statut inconnu -> aucune transition possible
    render(<SavTicketPartsPanel ticketId={42} ticketStatus="unknown_state" />);
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalled());
    expect(screen.queryByText(/Transitionner vers/i)).not.toBeInTheDocument();
  });

  it('propose uniquement les cibles valides depuis "open" (exclut open lui-meme)', async () => {
    fetchSavPartsUnified.mockResolvedValue({ parts: [], total: 0 });
    render(<SavTicketPartsPanel ticketId={42} ticketStatus="open" />);
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalled());
    // Le placeholder + les 4 cibles valides (in_progress, waiting_parts, sortie_sav, closed)
    expect(screen.getByText(/Transitionner vers/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'En cours' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Attente pièces' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sortie SAV' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Fermé' })).toBeInTheDocument();
    // "Résolu" n'est PAS accessible depuis open (nécessite in_progress d'abord)
    expect(screen.queryByRole('option', { name: 'Résolu' })).not.toBeInTheDocument();
  });

  it('applique la transition + callback onTicketTransitioned', async () => {
    fetchSavPartsUnified
      .mockResolvedValueOnce({ parts: [], total: 0 })
      .mockResolvedValueOnce({ parts: [], total: 0 });
    transitionSavTicketUnified.mockResolvedValue({
      ticket: { id: 42, status: 'in_progress' },
      previous_status: 'open',
      new_status: 'in_progress',
    });
    const onTicketTransitioned = vi.fn();
    render(
      <SavTicketPartsPanel
        ticketId={42}
        ticketStatus="open"
        onTicketTransitioned={onTicketTransitioned}
      />,
    );
    await waitFor(() => expect(fetchSavPartsUnified).toHaveBeenCalled());
    // Selectionner "En cours" dans le dropdown de transition (unique select
    // affiche quand parts=[] et pas de piece)
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'in_progress' } });
    fireEvent.click(screen.getByRole('button', { name: /Appliquer/i }));
    await waitFor(() =>
      expect(transitionSavTicketUnified).toHaveBeenCalledWith({}, 42, 'in_progress', {
        useV2: true,
      }),
    );
    await waitFor(() => expect(onTicketTransitioned).toHaveBeenCalled());
  });
});
