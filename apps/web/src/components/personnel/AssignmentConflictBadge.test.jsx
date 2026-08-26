// apps/web/src/components/personnel/AssignmentConflictBadge.test.jsx
// Ticket : T-P1-05c.

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useConflictsPrecheck.js', () => ({
  useConflictsPrecheck: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  default: {},
}));

import { useConflictsPrecheck } from '../../hooks/useConflictsPrecheck.js';
import AssignmentConflictBadge from './AssignmentConflictBadge.jsx';

afterEach(() => {
  vi.clearAllMocks();
});

describe('AssignmentConflictBadge — invisibilite', () => {
  it('rend null si params manquants (personId nul)', () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
      loading: false,
      available: true,
    });
    const { container } = render(
      <AssignmentConflictBadge personId={null} startDate="2026-08-01" endDate="2026-08-03" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('rend null si dates manquantes', () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
      loading: false,
      available: true,
    });
    const { container } = render(
      <AssignmentConflictBadge personId={5} startDate="" endDate="2026-08-03" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('rend null si available=false (pre-check indisponible)', () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
      loading: false,
      available: false,
    });
    const { container } = render(
      <AssignmentConflictBadge personId={5} startDate="2026-08-01" endDate="2026-08-03" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AssignmentConflictBadge — etats visibles', () => {
  it('loading : Spinner + texte "Verification…"', () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
      loading: true,
      available: false,
    });
    render(<AssignmentConflictBadge personId={5} startDate="2026-08-01" endDate="2026-08-03" />);
    expect(screen.getByText(/Verification des conflits agenda/i)).toBeInTheDocument();
  });

  it('succes : InlineAlert "Aucun conflit"', () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
      loading: false,
      available: true,
    });
    render(<AssignmentConflictBadge personId={5} startDate="2026-08-01" endDate="2026-08-03" />);
    expect(screen.getByText(/Aucun conflit agenda detecte/i)).toBeInTheDocument();
  });

  it('warning : liste des conflits + hint', () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [
        {
          source: 'missions',
          entityType: 'mission',
          entityId: 12,
          label: 'Concert X',
          startDate: '2026-08-01',
          endDate: '2026-08-02',
        },
        {
          source: 'availabilities',
          entityType: 'availability',
          entityId: 5,
          label: 'Conge',
          date: '2026-08-03',
        },
      ],
      hasConflict: true,
      count: 2,
      loading: false,
      available: true,
    });
    render(<AssignmentConflictBadge personId={5} startDate="2026-08-01" endDate="2026-08-03" />);
    expect(screen.getByText(/2 conflits agenda detectes/i)).toBeInTheDocument();
    expect(screen.getByText(/Concert X/)).toBeInTheDocument();
    expect(screen.getByText(/Conge/)).toBeInTheDocument();
    expect(screen.getByText(/enregistrera un warning/i)).toBeInTheDocument();
  });

  it('warning : plus de 5 conflits -> ellipsis "… et N de plus"', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      source: 'missions',
      entityType: 'mission',
      entityId: 100 + i,
      label: `Mission ${i + 1}`,
    }));
    useConflictsPrecheck.mockReturnValue({
      conflicts: many,
      hasConflict: true,
      count: 8,
      loading: false,
      available: true,
    });
    render(<AssignmentConflictBadge personId={5} startDate="2026-08-01" endDate="2026-08-03" />);
    expect(screen.getByText(/8 conflits agenda detectes/i)).toBeInTheDocument();
    expect(screen.getByText(/et 3 de plus/i)).toBeInTheDocument();
  });

  it('transmet exclude = mission en mode edition', async () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
      loading: false,
      available: true,
    });
    render(
      <AssignmentConflictBadge
        personId={5}
        startDate="2026-08-01"
        endDate="2026-08-03"
        excludeMissionId={42}
      />,
    );
    await waitFor(() =>
      expect(useConflictsPrecheck).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          personId: 5,
          startDate: '2026-08-01',
          endDate: '2026-08-03',
          exclude: [{ entityType: 'mission', entityId: 42 }],
        }),
        expect.any(Object),
      ),
    );
  });

  it('pas de exclude si excludeMissionId absent', async () => {
    useConflictsPrecheck.mockReturnValue({
      conflicts: [],
      hasConflict: false,
      count: 0,
      loading: false,
      available: true,
    });
    render(<AssignmentConflictBadge personId={5} startDate="2026-08-01" endDate="2026-08-03" />);
    await waitFor(() =>
      expect(useConflictsPrecheck).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ exclude: undefined }),
        expect.any(Object),
      ),
    );
  });
});
