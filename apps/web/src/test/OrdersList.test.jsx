import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrdersList } from '../components/orders/OrdersListViews';

// Mock AffaireBadge
vi.mock('../components/AffaireBadge', () => ({
  default: ({ numero }) => <span data-testid="affaire-badge">{numero}</span>,
}));

const makeOrder = (overrides = {}) => ({
  id: 1,
  reference: 'CMD-2026-001',
  supplier_name: 'Fournisseur A',
  affaire_id: null,
  order_date: '2026-04-10',
  status: 'draft',
  item_count: 3,
  total_ht: 1500.5,
  ...overrides,
});

const defaultProps = {
  orders: [],
  onView: vi.fn(),
  onDoubleClick: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  selectedId: null,
};

describe('OrdersList', () => {
  it('affiche le message vide quand pas de commandes', () => {
    render(<OrdersList {...defaultProps} />);
    expect(screen.getByText('Aucune commande')).toBeInTheDocument();
  });

  it('affiche les en-tetes du tableau', () => {
    render(<OrdersList {...defaultProps} orders={[makeOrder()]} />);
    expect(screen.getByText('Fournisseur')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('Articles')).toBeInTheDocument();
    expect(screen.getByText('Total HT')).toBeInTheDocument();
  });

  it('affiche les donnees de la commande', () => {
    render(<OrdersList {...defaultProps} orders={[makeOrder()]} />);
    expect(screen.getByText(/CMD-2026-001/)).toBeInTheDocument();
    expect(screen.getByText('Fournisseur A')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('affiche le statut brouillon', () => {
    render(<OrdersList {...defaultProps} orders={[makeOrder()]} />);
    expect(screen.getByText(/Brouillon/)).toBeInTheDocument();
  });

  it('appelle onView au clic sur la ligne', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const order = makeOrder();
    render(<OrdersList {...defaultProps} orders={[order]} onView={onView} />);
    await user.click(screen.getByText('Fournisseur A'));
    expect(onView).toHaveBeenCalledWith(order);
  });

  it('appelle onEdit au clic sur le bouton modifier', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const order = makeOrder();
    render(<OrdersList {...defaultProps} orders={[order]} onEdit={onEdit} />);
    const editBtns = screen.getAllByRole('button');
    // Le premier bouton dans actions-cell est Modifier
    await user.click(editBtns[0]);
    expect(onEdit).toHaveBeenCalledWith(order);
  });

  it('appelle onDelete au clic sur le bouton supprimer', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const order = makeOrder();
    render(<OrdersList {...defaultProps} orders={[order]} onDelete={onDelete} />);
    const btns = screen.getAllByRole('button');
    // Le 2e bouton est Supprimer
    await user.click(btns[1]);
    expect(onDelete).toHaveBeenCalledWith(order);
  });

  it('applique la classe selected', () => {
    const order = makeOrder();
    const { container } = render(<OrdersList {...defaultProps} orders={[order]} selectedId={1} />);
    expect(container.querySelector('.clickable-row.selected')).toBeInTheDocument();
  });

  it('affiche plusieurs commandes', () => {
    const orders = [
      makeOrder({ id: 1, reference: 'CMD-001' }),
      makeOrder({ id: 2, reference: 'CMD-002', supplier_name: 'Fournisseur B' }),
    ];
    render(<OrdersList {...defaultProps} orders={orders} />);
    expect(screen.getByText(/CMD-001/)).toBeInTheDocument();
    expect(screen.getByText(/CMD-002/)).toBeInTheDocument();
  });

  it('affiche AffaireBadge quand affaire_id est present', () => {
    render(<OrdersList {...defaultProps} orders={[makeOrder({ affaire_id: 'AF1234' })]} />);
    expect(screen.getByTestId('affaire-badge')).toHaveTextContent('AF1234');
  });
});
