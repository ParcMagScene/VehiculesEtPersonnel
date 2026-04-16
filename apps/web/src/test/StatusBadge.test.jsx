import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import StatusBadge from '../components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders children text', () => {
    render(<StatusBadge color="#4caf50">Actif</StatusBadge>);
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('applies color as inline style', () => {
    render(<StatusBadge color="#ff0000">Urgent</StatusBadge>);
    const badge = screen.getByText('Urgent');
    // jsdom normalise les hex en rgb
    expect(badge.style.color).toBe('rgb(255, 0, 0)');
    expect(badge.style.borderColor).toBe('rgb(255, 0, 0)');
    // backgroundColor with alpha stays as-is (not a valid CSS color, kept verbatim)
    expect(badge.style.backgroundColor).toBeTruthy();
  });

  it('renders without color gracefully', () => {
    render(<StatusBadge>Sans couleur</StatusBadge>);
    const badge = screen.getByText('Sans couleur');
    expect(badge).toBeInTheDocument();
    expect(badge.style.color).toBe('');
  });

  it('applies sm size class', () => {
    render(
      <StatusBadge color="#333" size="sm">
        Petit
      </StatusBadge>,
    );
    expect(screen.getByText('Petit')).toHaveClass('ui-status-badge--sm');
  });

  it('does not apply sm class for md size', () => {
    render(
      <StatusBadge color="#333" size="md">
        Normal
      </StatusBadge>,
    );
    expect(screen.getByText('Normal')).not.toHaveClass('ui-status-badge--sm');
  });

  it('renders icon when provided', () => {
    render(
      <StatusBadge color="#333" icon={<span data-testid="icon">🔴</span>}>
        Avec icône
      </StatusBadge>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <StatusBadge color="#333" className="custom">
        Test
      </StatusBadge>,
    );
    expect(screen.getByText('Test')).toHaveClass('custom');
  });
});
