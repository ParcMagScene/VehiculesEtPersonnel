import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import CalendarHeaders from '../components/vehicles/CalendarHeaders';

const makeWeekDays = () => {
  // Semaine du 13 au 19 avril 2026 (lun-dim)
  return Array.from({ length: 7 }, (_, i) => new Date(2026, 3, 13 + i));
};

const defaultProps = {
  view: 'week',
  days: makeWeekDays(),
  currentDate: new Date(2026, 3, 15),
  gridColumns: 'repeat(14, 1fr)',
  handleMonthClick: vi.fn(),
  handleWeekClick: vi.fn(),
  handleDayClick: vi.fn(),
};

describe('CalendarHeaders', () => {
  // ═══ Vue semaine ═══
  it('affiche les jours de la semaine en vue semaine', () => {
    render(<CalendarHeaders {...defaultProps} />);
    expect(screen.getByText('lundi')).toBeInTheDocument();
    expect(screen.getByText('mardi')).toBeInTheDocument();
    expect(screen.getByText('mercredi')).toBeInTheDocument();
    expect(screen.getByText('dimanche')).toBeInTheDocument();
  });

  it('affiche AM/PM pour chaque jour en vue semaine', () => {
    render(<CalendarHeaders {...defaultProps} />);
    const amCells = screen.getAllByText('AM');
    const pmCells = screen.getAllByText('PM');
    expect(amCells).toHaveLength(7);
    expect(pmCells).toHaveLength(7);
  });

  it('marque le weekend', () => {
    const { container } = render(<CalendarHeaders {...defaultProps} />);
    const weekendCells = container.querySelectorAll('.weekend');
    expect(weekendCells.length).toBeGreaterThan(0);
  });

  // ═══ Vue jour ═══
  it('affiche Matin et Apres-midi en vue jour', () => {
    render(<CalendarHeaders {...defaultProps} view="day" />);
    expect(screen.getByText('Matin')).toBeInTheDocument();
    expect(screen.getByText(/midi/i)).toBeInTheDocument();
  });

  it('affiche la date formatee en vue jour', () => {
    render(<CalendarHeaders {...defaultProps} view="day" />);
    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByText(/avril/)).toBeInTheDocument();
  });

  // ═══ Vue annee ═══
  it('affiche les mois en vue annee', () => {
    const months = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1));
    render(<CalendarHeaders {...defaultProps} view="year" days={months} />);
    expect(screen.getByText('janvier')).toBeInTheDocument();
    expect(screen.getByText('juin')).toBeInTheDocument();
    expect(screen.getByText(/cembre/)).toBeInTheDocument();
  });

  it('appelle handleMonthClick au clic sur un mois', async () => {
    const user = userEvent.setup();
    const handleMonthClick = vi.fn();
    const months = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1));
    render(
      <CalendarHeaders
        {...defaultProps}
        view="year"
        days={months}
        handleMonthClick={handleMonthClick}
      />,
    );
    await user.click(screen.getByText('janvier'));
    expect(handleMonthClick).toHaveBeenCalledWith(0);
  });

  // ═══ Vue mois ═══
  it('appelle handleDayClick en vue mois', async () => {
    const user = userEvent.setup();
    const handleDayClick = vi.fn();
    render(<CalendarHeaders {...defaultProps} view="month" handleDayClick={handleDayClick} />);
    await user.click(screen.getByText('lundi'));
    expect(handleDayClick).toHaveBeenCalled();
  });
});
