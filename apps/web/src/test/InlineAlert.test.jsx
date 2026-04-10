import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InlineAlert from '../components/ui/InlineAlert';

describe('InlineAlert', () => {
  it('affiche le message avec role="alert"', () => {
    render(<InlineAlert>Erreur détectée</InlineAlert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Erreur détectée');
  });

  it('variant par défaut est error', () => {
    const { container } = render(<InlineAlert>msg</InlineAlert>);
    expect(container.firstChild).toHaveClass('ui-inline-alert--error');
  });

  it.each(['error', 'warning', 'success', 'info'])('variant %s applique la classe', (v) => {
    const { container } = render(<InlineAlert variant={v}>msg</InlineAlert>);
    expect(container.firstChild).toHaveClass(`ui-inline-alert--${v}`);
  });

  it('affiche une icône personnalisée', () => {
    render(<InlineAlert icon={<span data-testid="custom-icon">!</span>}>msg</InlineAlert>);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('affiche le bouton de fermeture si dismissible + onDismiss', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<InlineAlert dismissible onDismiss={onDismiss}>msg</InlineAlert>);

    const btn = screen.getByRole('button', { name: 'Fermer' });
    await user.click(btn);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('pas de bouton fermer si dismissible=false', () => {
    render(<InlineAlert>msg</InlineAlert>);
    expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument();
  });

  it('affiche l\'action optionnelle', () => {
    render(<InlineAlert action={<button>Réessayer</button>}>msg</InlineAlert>);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<InlineAlert className="extra">msg</InlineAlert>);
    expect(container.firstChild).toHaveClass('ui-inline-alert', 'extra');
  });
});
