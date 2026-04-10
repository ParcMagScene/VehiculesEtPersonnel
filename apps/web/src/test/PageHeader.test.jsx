import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from '../components/ui/PageHeader';

describe('PageHeader', () => {
  it('affiche le titre dans un h2', () => {
    render(<PageHeader title="Véhicules" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Véhicules');
  });

  it('affiche le sous-titre', () => {
    render(<PageHeader title="T" subtitle="Gestion du parc" />);
    expect(screen.getByText('Gestion du parc')).toBeInTheDocument();
  });

  it('affiche le badge', () => {
    render(<PageHeader title="Véhicules" badge={42} />);
    expect(screen.getByText('42')).toHaveClass('ui-page-header-badge');
  });

  it('pas de badge si null', () => {
    const { container } = render(<PageHeader title="T" />);
    expect(container.querySelector('.ui-page-header-badge')).toBeNull();
  });

  it('affiche l\'icône', () => {
    render(<PageHeader title="T" icon={<span data-testid="ico">★</span>} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('affiche les actions', () => {
    render(<PageHeader title="T" actions={<button>Ajouter</button>} />);
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('affiche le breadcrumb avec aria-label', () => {
    render(<PageHeader title="T" breadcrumb={<a href="/">Accueil</a>} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('children dans la toolbar', () => {
    render(<PageHeader title="T"><input placeholder="Rechercher" /></PageHeader>);
    expect(screen.getByPlaceholderText('Rechercher')).toBeInTheDocument();
  });

  it('rend un <header>', () => {
    const { container } = render(<PageHeader title="T" />);
    expect(container.firstChild.tagName).toBe('HEADER');
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<PageHeader title="T" className="extra" />);
    expect(container.firstChild).toHaveClass('ui-page-header', 'extra');
  });
});
