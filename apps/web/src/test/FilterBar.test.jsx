import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from '../components/ui/FilterBar';

const options = [
  { value: 'all', label: 'Tous', count: 42 },
  { value: 'active', label: 'Actifs', count: 30 },
  { value: 'archived', label: 'Archivés', count: 12 },
];

describe('FilterBar', () => {
  it('rend les options comme boutons radio', () => {
    render(<FilterBar value="all" options={options} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('role="radiogroup" sur le conteneur', () => {
    render(<FilterBar value="all" options={options} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it("aria-checked sur l'option active", () => {
    render(<FilterBar value="active" options={options} />);
    expect(screen.getByRole('radio', { name: /Actifs/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Tous/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('appelle onChange au clic', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar value="all" onChange={onChange} options={options} />);
    await user.click(screen.getByRole('radio', { name: /Archivés/ }));
    expect(onChange).toHaveBeenCalledWith('archived');
  });

  it('affiche les compteurs', () => {
    render(<FilterBar value="all" options={options} />);
    expect(screen.getByText('42')).toHaveClass('ui-filter-btn__count');
  });

  it('option active a la classe', () => {
    render(<FilterBar value="all" options={options} />);
    expect(screen.getByRole('radio', { name: /Tous/ })).toHaveClass('ui-filter-btn--active');
  });

  it('option disabled est désactivée', () => {
    const opts = [{ value: 'x', label: 'X', disabled: true }];
    render(<FilterBar value="" options={opts} />);
    expect(screen.getByRole('radio', { name: 'X' })).toBeDisabled();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<FilterBar value="" options={[]} className="extra" />);
    expect(container.firstChild).toHaveClass('ui-filter-bar', 'extra');
  });
});
