import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Divider from '../components/ui/Divider';

describe('Divider', () => {
  it('rend un séparateur avec role="separator"', () => {
    render(<Divider />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('orientation horizontale par défaut', () => {
    render(<Divider />);
    const el = screen.getByRole('separator');
    expect(el).toHaveClass('ui-divider--horizontal');
    expect(el).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('orientation verticale', () => {
    render(<Divider orientation="vertical" />);
    const el = screen.getByRole('separator');
    expect(el).toHaveClass('ui-divider--vertical');
    expect(el).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('affiche un label', () => {
    render(<Divider label="ou" />);
    expect(screen.getByText('ou')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toHaveClass('ui-divider--label');
  });

  it('pas de label par défaut', () => {
    const { container } = render(<Divider />);
    expect(container.querySelector('.ui-divider__label')).toBeNull();
  });

  it('applique className supplémentaire', () => {
    render(<Divider className="extra" />);
    expect(screen.getByRole('separator')).toHaveClass('ui-divider', 'extra');
  });
});
