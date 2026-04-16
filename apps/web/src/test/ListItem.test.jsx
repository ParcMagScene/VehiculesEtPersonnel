import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListItem from '../components/ui/ListItem';

describe('ListItem', () => {
  it('rend le titre', () => {
    render(<ListItem title="Équipement #1" />);
    expect(screen.getByText('Équipement #1')).toBeInTheDocument();
  });

  it('rend description et meta', () => {
    render(<ListItem title="A" description="Desc" meta="Il y a 2h" />);
    expect(screen.getByText('Desc')).toHaveClass('ui-list-item__desc');
    expect(screen.getByText('Il y a 2h')).toHaveClass('ui-list-item__meta');
  });

  it('rend un div sans onClick', () => {
    const { container } = render(<ListItem title="A" />);
    expect(container.firstChild.tagName).toBe('DIV');
  });

  it('rend un button avec onClick', () => {
    const { container } = render(<ListItem title="A" onClick={() => {}} />);
    expect(container.firstChild.tagName).toBe('BUTTON');
    expect(container.firstChild).toHaveAttribute('type', 'button');
  });

  it('appelle onClick au clic', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ListItem title="A" onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('selected ajoute la classe', () => {
    const { container } = render(<ListItem title="A" selected />);
    expect(container.firstChild).toHaveClass('ui-list-item--selected');
  });

  it('clickable ajoute la classe', () => {
    const { container } = render(<ListItem title="A" onClick={() => {}} />);
    expect(container.firstChild).toHaveClass('ui-list-item--clickable');
  });

  it("affiche l'icône", () => {
    render(<ListItem title="A" icon={<span data-testid="ico">★</span>} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('affiche les actions', () => {
    render(<ListItem title="A" actions={<button>Supprimer</button>} />);
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
  });

  it('applique className supplémentaire', () => {
    const { container } = render(<ListItem title="A" className="extra" />);
    expect(container.firstChild.className).toContain('extra');
  });
});
