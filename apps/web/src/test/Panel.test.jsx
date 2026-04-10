import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import Panel from '../components/ui/Panel';

describe('Panel', () => {
  it('rend les enfants dans le body', () => {
    render(<Panel>Contenu</Panel>);
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('affiche le titre', () => {
    render(<Panel title="Mon panel">body</Panel>);
    expect(screen.getByText('Mon panel')).toBeInTheDocument();
  });

  it('pas de header sans titre', () => {
    const { container } = render(<Panel>body</Panel>);
    expect(container.querySelector('.ui-panel-header')).toBeNull();
  });

  it('affiche le bouton fermer avec onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Panel title="T" onClose={onClose}>body</Panel>);
    const btn = screen.getByRole('button', { name: 'Fermer' });
    await user.click(btn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('pas de bouton fermer sans onClose', () => {
    render(<Panel title="T">body</Panel>);
    expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument();
  });

  it('affiche le footer', () => {
    render(<Panel footer={<span>Pied</span>}>body</Panel>);
    expect(screen.getByText('Pied')).toBeInTheDocument();
  });

  it('affiche l\'icône', () => {
    render(<Panel title="T" icon={<span data-testid="ico">★</span>}>body</Panel>);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('forward ref', () => {
    const ref = createRef();
    render(<Panel ref={ref}>body</Panel>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('ui-panel');
  });

  it('applique className', () => {
    const { container } = render(<Panel className="extra">body</Panel>);
    expect(container.firstChild).toHaveClass('ui-panel', 'extra');
  });
});
