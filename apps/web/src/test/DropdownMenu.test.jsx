import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu, DropdownItem, DropdownDivider } from '../components/ui/DropdownMenu';

describe('DropdownMenu', () => {
  it('rend le trigger avec aria-haspopup', () => {
    render(<DropdownMenu trigger={<span>Menu</span>}><DropdownItem>A</DropdownItem></DropdownMenu>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'true');
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('ouvre le menu au clic', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<span>Menu</span>}><DropdownItem>Action</DropdownItem></DropdownMenu>);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Action' })).toBeInTheDocument();
  });

  it('ferme le menu au clic sur un item', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<span>Menu</span>}><DropdownItem>Action</DropdownItem></DropdownMenu>);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: 'Action' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('aria-expanded reflète l\'état', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<span>Menu</span>}><DropdownItem>A</DropdownItem></DropdownMenu>);
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('DropdownItem', () => {
  it('rend avec role="menuitem"', () => {
    render(<DropdownItem>Modifier</DropdownItem>);
    expect(screen.getByRole('menuitem')).toHaveTextContent('Modifier');
  });

  it('danger ajoute la classe', () => {
    render(<DropdownItem danger>Supprimer</DropdownItem>);
    expect(screen.getByRole('menuitem')).toHaveClass('ui-dropdown-item--danger');
  });

  it('disabled', () => {
    render(<DropdownItem disabled>Nope</DropdownItem>);
    expect(screen.getByRole('menuitem')).toBeDisabled();
  });

  it('affiche l\'icône', () => {
    render(<DropdownItem icon={<span data-testid="ico">★</span>}>Go</DropdownItem>);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });
});

describe('DropdownDivider', () => {
  it('rend un séparateur', () => {
    render(<DropdownDivider />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });
});
