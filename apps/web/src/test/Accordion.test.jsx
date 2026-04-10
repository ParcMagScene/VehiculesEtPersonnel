import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Accordion from '../components/ui/Accordion';

describe('Accordion', () => {
  it('rend le titre', () => {
    render(<Accordion title="Section">Contenu</Accordion>);
    expect(screen.getByText('Section')).toBeInTheDocument();
  });

  it('est fermé par défaut', () => {
    render(<Accordion title="Section">Contenu</Accordion>);
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('defaultOpen affiche le contenu', () => {
    render(<Accordion title="Section" defaultOpen>Contenu</Accordion>);
    expect(screen.getByText('Contenu')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggle ouvre puis ferme', async () => {
    const user = userEvent.setup();
    render(<Accordion title="Section">Contenu</Accordion>);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Contenu')).toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });

  it('appelle onToggle avec la nouvelle valeur', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<Accordion title="Section" onToggle={onToggle}>Contenu</Accordion>);

    await user.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('mode contrôlé respecte la prop open', () => {
    const { rerender } = render(
      <Accordion title="Section" open={false}>Contenu</Accordion>
    );
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();

    rerender(<Accordion title="Section" open={true}>Contenu</Accordion>);
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('affiche l\'icône si fournie', () => {
    render(<Accordion title="Section" icon={<span data-testid="icon">★</span>}>Contenu</Accordion>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('le contenu a role="region"', () => {
    render(<Accordion title="Section" defaultOpen>Contenu</Accordion>);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(
      <Accordion title="Section" className="custom">Contenu</Accordion>
    );
    expect(container.firstChild).toHaveClass('ui-accordion', 'custom');
  });

  it('ajoute la classe --open quand ouvert', () => {
    const { container } = render(
      <Accordion title="Section" defaultOpen>Contenu</Accordion>
    );
    expect(container.firstChild).toHaveClass('ui-accordion--open');
  });
});
