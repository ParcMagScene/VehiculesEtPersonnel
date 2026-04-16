import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionHeader from '../components/ui/SectionHeader';

describe('SectionHeader', () => {
  it('affiche le titre dans un h3 par défaut', () => {
    render(<SectionHeader title="Détails" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Détails');
  });

  it('as="h4" rend un h4', () => {
    render(<SectionHeader title="Sous-section" as="h4" />);
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Sous-section');
  });

  it('affiche le badge de comptage', () => {
    render(<SectionHeader title="Items" count={5} />);
    expect(screen.getByText('5')).toHaveClass('ui-section-badge');
  });

  it('pas de badge si count est null', () => {
    const { container } = render(<SectionHeader title="T" />);
    expect(container.querySelector('.ui-section-badge')).toBeNull();
  });

  it('count=0 affiche le badge', () => {
    render(<SectionHeader title="T" count={0} />);
    expect(screen.getByText('0')).toHaveClass('ui-section-badge');
  });

  it("affiche l'icône", () => {
    render(<SectionHeader title="T" icon={<span data-testid="ico">★</span>} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('affiche les actions', () => {
    render(<SectionHeader title="T" actions={<button>+</button>} />);
    expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<SectionHeader title="T" className="extra" />);
    expect(container.firstChild).toHaveClass('ui-section-header', 'extra');
  });
});
