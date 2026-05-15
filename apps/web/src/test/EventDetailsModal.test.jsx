import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EventDetailsModal from '../components/planning/EventDetailsModal';

// Mock complet du module api utilisé dans EventDetailsModal
vi.mock('../utils/api', () => ({
  default: {
    request: vi.fn().mockResolvedValue({}),
    getReservations: vi.fn().mockResolvedValue([]),
    getAttachments: vi.fn().mockResolvedValue([]),
    listEventAttachments: vi.fn().mockResolvedValue([]),
    listAttachments: vi.fn().mockResolvedValue([]),
    getAffaires: vi.fn().mockResolvedValue([]),
    listAffaires: vi.fn().mockResolvedValue([]),
  },
}));

// Mocks des dépendances modales chargées en lazy / portail
vi.mock('../components/affaires/BLImportModal', () => ({
  default: () => <div data-testid="bl-import-modal" />,
}));
vi.mock('../components/DynamicDisplayDialog', () => ({
  default: () => <div data-testid="dynamic-display-dialog" />,
}));

// Toast & ConfirmDialog ne doivent rien rendre / faire planter
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    ConfirmDialogRenderer: () => null,
  }),
}));

const baseEvent = {
  id: 'evt-123',
  summary: 'Réunion technique',
  start: { dateTime: '2026-05-20T09:00:00+02:00' },
  end: { dateTime: '2026-05-20T10:30:00+02:00' },
  description: 'Détail de la réunion',
};

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  event: baseEvent,
  reservations: [],
  onRequestEditReservation: vi.fn(),
  onRequestCreateReservation: vi.fn(),
  onRequestCreateAssignment: vi.fn(),
  onEventCreated: vi.fn(),
  onRequestEditEvent: vi.fn(),
  onRequestDeleteEvent: vi.fn(),
  onReservationsRefresh: vi.fn(),
  currentUser: { id: 1, name: 'Tester', isAdmin: true },
  activeModule: 'planning',
};

beforeEach(() => {
  // #emag-modal-root : portail unique géré par le ModalManager.
  // Auto-créé par getModalRoot() si absent, mais on le pré-crée pour
  // éviter une création asynchrone pendant les assertions.
  if (!document.getElementById('emag-modal-root')) {
    const root = document.createElement('div');
    root.id = 'emag-modal-root';
    document.body.appendChild(root);
  }
});

// NB : on NE vide PAS le portail manuellement → la cleanup auto de RTL
// (configurée par @testing-library) démonte les arbres React proprement.
// Vider innerHTML ici provoquerait NotFoundError côté React.

describe('EventDetailsModal', () => {
  it('ne rend rien quand isOpen est false', () => {
    const { container } = render(<EventDetailsModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
    // Le portail ne doit rien injecter
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("ne rend rien quand l'event est null", () => {
    render(<EventDetailsModal {...baseProps} event={null} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("affiche le titre de l'événement quand ouvert", () => {
    render(<EventDetailsModal {...baseProps} />);
    expect(screen.getByText('Réunion technique')).toBeInTheDocument();
  });

  it('affiche un titre par défaut si summary est vide', () => {
    render(<EventDetailsModal {...baseProps} event={{ ...baseEvent, summary: '' }} />);
    expect(screen.getByText('(Sans titre)')).toBeInTheDocument();
  });

  it('affiche le lien Google Calendar si event.htmlLink est fourni', () => {
    render(
      <EventDetailsModal
        {...baseProps}
        event={{ ...baseEvent, htmlLink: 'https://calendar.google.com/abc' }}
      />,
    );
    const link = screen.getByRole('link', { name: /Voir dans Google Calendar/i });
    expect(link).toHaveAttribute('href', 'https://calendar.google.com/abc');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
