import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../components/ui/EmptyState';

describe('EmptyState', () => {
  it('affiche le titre', () => {
    render(<EmptyState title="Aucun résultat" />);
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
  });

  it('affiche la description', () => {
    render(<EmptyState title="Vide" description="Essayez autre chose" />);
    expect(screen.getByText('Essayez autre chose')).toBeInTheDocument();
  });

  it("affiche un bouton d'action", () => {
    render(<EmptyState title="Vide" action={<button>Ajouter</button>} />);
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('applique la taille sm/md/lg', () => {
    const { container, rerender } = render(<EmptyState title="T" size="sm" />);
    expect(container.querySelector('.ui-empty-state--sm')).toBeInTheDocument();
    rerender(<EmptyState title="T" size="lg" />);
    expect(container.querySelector('.ui-empty-state--lg')).toBeInTheDocument();
  });

  it("ne rend pas l'icône si non fournie", () => {
    const { container } = render(<EmptyState title="T" />);
    expect(container.querySelector('.ui-empty-state__icon')).not.toBeInTheDocument();
  });
});
