import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner, LoadingOverlay } from '../components/ui/Loader';

describe('Spinner', () => {
  it('rend avec aria-hidden', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('applique la classe ui-spinner', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')).toHaveClass('ui-spinner');
  });

  it('taille md par défaut (24px)', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it.each([
    ['sm', '16'],
    ['md', '24'],
    ['lg', '32'],
    ['xl', '48'],
  ])('size %s → %spx', (size, px) => {
    const { container } = render(<Spinner size={size} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', px);
  });

  it('accepte un nombre en px', () => {
    const { container } = render(<Spinner size={40} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '40');
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<Spinner className="extra" />);
    expect(container.querySelector('svg')).toHaveClass('ui-spinner', 'extra');
  });
});

describe('LoadingOverlay', () => {
  it('rend avec role="status"', () => {
    render(<LoadingOverlay />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('ne rend rien si visible=false', () => {
    const { container } = render(<LoadingOverlay visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le label', () => {
    render(<LoadingOverlay label="Chargement des données…" />);
    const matches = screen.getAllByText('Chargement des données…');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]).toHaveClass('ui-loading-overlay__label');
  });

  it('sr-only avec label par défaut', () => {
    render(<LoadingOverlay />);
    expect(screen.getByText('Chargement…')).toHaveClass('sr-only');
  });

  it('applique className supplémentaire', () => {
    render(<LoadingOverlay className="custom" />);
    expect(screen.getByRole('status')).toHaveClass('ui-loading-overlay', 'custom');
  });
});
