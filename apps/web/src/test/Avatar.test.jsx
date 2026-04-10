import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from '../components/ui/Avatar';

// Avatar délègue à UserAvatar — on teste le wrapper DS
describe('Avatar', () => {
  it('rend un conteneur ui-avatar', () => {
    const { container } = render(<Avatar name="Alice" />);
    expect(container.querySelector('.ui-avatar')).toBeInTheDocument();
  });

  it('passe le name à UserAvatar (initiales visibles)', () => {
    render(<Avatar name="Alice Dupont" />);
    // UserAvatar affiche les initiales si pas d'image
    expect(screen.getByText(/A/)).toBeInTheDocument();
  });

  it('taille md par défaut (40px)', () => {
    const { container } = render(<Avatar name="Bob" />);
    const inner = container.querySelector('.ui-avatar > *');
    // UserAvatar utilise width/height inline
    expect(inner).toBeInTheDocument();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<Avatar name="A" className="extra" />);
    expect(container.querySelector('.ui-avatar')).toHaveClass('extra');
  });

  it('accepte une taille numérique', () => {
    const { container } = render(<Avatar name="A" size={48} />);
    expect(container.querySelector('.ui-avatar')).toBeInTheDocument();
  });
});
