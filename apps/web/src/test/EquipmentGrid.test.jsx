import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import EquipmentGrid from '../components/equipment/EquipmentGrid';

// react-virtuoso ne peut pas mesurer sa hauteur dans jsdom (offsetHeight=0).
// On mocke TableVirtuoso pour rendre toutes les lignes de maniere synchrone.
vi.mock('react-virtuoso', () => ({
  TableVirtuoso: ({ data, fixedHeaderContent, itemContent, components, context }) => {
    const Table = components?.Table || 'table';
    const TableHead = components?.TableHead || 'thead';
    const TableBody = components?.TableBody || 'tbody';
    const TableRow =
      components?.TableRow || (({ children, ...props }) => <tr {...props}>{children}</tr>);
    return (
      <Table>
        <TableHead>{fixedHeaderContent()}</TableHead>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={item.id ?? index} item={item} context={context}>
              {itemContent(index, item)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  },
}));

// Mock des utilitaires et constants
vi.mock('../components/equipment/equipmentUtils', () => ({
  matchPhotoToEquipment: () => null,
  findZone: () => null,
  getCategoryHierarchy: () => null,
}));
vi.mock('../utils/genericImages', () => ({
  resolveGenericImage: () => null,
}));

const makeEquipment = (overrides = {}) => ({
  id: 1,
  name: 'Projecteur LED',
  uid: 'EMAG-001',
  reference: 'REF-100',
  categoryName: 'Eclairage',
  categoryIcon: '💡',
  categoryColor: '#3b82f6',
  brand: 'Martin',
  serialNumber: 'SN-12345',
  stockQuantity: 2,
  status: 'available',
  location: 'Entrepot A',
  ...overrides,
});

const defaultProps = {
  equipment: [],
  depotZones: null,
  allDepotZones: null,
  selectedId: null,
  photosList: [],
  _logosList: [],
  favoriteIds: new Set(),
  watchIds: new Set(),
  _onToggleList: vi.fn(),
  onSelect: vi.fn(),
  onDoubleClick: vi.fn(),
  onOpenDepotMap: vi.fn(),
  categories: null,
};

describe('EquipmentGrid', () => {
  it('affiche EmptyState quand la liste est vide', () => {
    render(<EquipmentGrid {...defaultProps} />);
    expect(screen.getByText('Aucun matériel trouvé')).toBeInTheDocument();
  });

  it('affiche un tableau avec les en-tetes', () => {
    render(<EquipmentGrid {...defaultProps} equipment={[makeEquipment()]} />);
    expect(screen.getByText('Nom')).toBeInTheDocument();
    expect(screen.getByText('UID')).toBeInTheDocument();
    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('Zone')).toBeInTheDocument();
  });

  it('affiche les donnees de chaque equipement', () => {
    const eq = makeEquipment();
    render(<EquipmentGrid {...defaultProps} equipment={[eq]} />);
    expect(screen.getByText('Projecteur LED')).toBeInTheDocument();
    expect(screen.getByText('EMAG-001')).toBeInTheDocument();
    expect(screen.getByText('REF-100')).toBeInTheDocument();
    expect(screen.getByText('Martin')).toBeInTheDocument();
    expect(screen.getByText('SN-12345')).toBeInTheDocument();
  });

  it('affiche le statut disponible', () => {
    render(<EquipmentGrid {...defaultProps} equipment={[makeEquipment()]} />);
    expect(screen.getByText(/Disponible/)).toBeInTheDocument();
  });

  it('appelle onSelect au clic sur une ligne', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const eq = makeEquipment();
    render(<EquipmentGrid {...defaultProps} equipment={[eq]} onSelect={onSelect} />);
    await user.click(screen.getByText('Projecteur LED'));
    expect(onSelect).toHaveBeenCalledWith(eq);
  });

  it('appelle onDoubleClick au double-clic', async () => {
    const user = userEvent.setup();
    const onDoubleClick = vi.fn();
    const eq = makeEquipment();
    render(<EquipmentGrid {...defaultProps} equipment={[eq]} onDoubleClick={onDoubleClick} />);
    await user.dblClick(screen.getByText('Projecteur LED'));
    expect(onDoubleClick).toHaveBeenCalledWith(eq);
  });

  it('applique la classe selected sur la ligne selectionnee', () => {
    const eq = makeEquipment();
    const { container } = render(
      <EquipmentGrid {...defaultProps} equipment={[eq]} selectedId={1} />,
    );
    expect(container.querySelector('.eq-table-row.selected')).toBeInTheDocument();
  });

  it('affiche les icones favori et surveillance', () => {
    const eq = makeEquipment();
    const { container } = render(
      <EquipmentGrid
        {...defaultProps}
        equipment={[eq]}
        favoriteIds={new Set([1])}
        watchIds={new Set([1])}
      />,
    );
    expect(container.querySelector('.eq-list-star.active')).toBeInTheDocument();
    expect(container.querySelector('.eq-list-eye.active')).toBeInTheDocument();
  });

  it('affiche la quantite en stock', () => {
    render(<EquipmentGrid {...defaultProps} equipment={[makeEquipment({ stockQuantity: 5 })]} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('regroupe plusieurs unités d une meme reference sous une ligne generique expandable', async () => {
    const user = userEvent.setup();
    const rows = [
      makeEquipment({
        id: 1,
        name: 'RAVEN XIP',
        reference: 'RAVEN XIP',
        serialNumber: 'SN-001',
        uid: 'EMAG-001',
        numeroMag: 'MAG-001',
        stockQuantity: 1,
      }),
      makeEquipment({
        id: 2,
        name: 'RAVEN XIP',
        reference: 'RAVEN XIP',
        serialNumber: 'SN-002',
        uid: 'EMAG-002',
        numeroMag: 'MAG-002',
        stockQuantity: 1,
      }),
      makeEquipment({
        id: 3,
        name: 'RAVEN XIP',
        reference: 'RAVEN XIP',
        serialNumber: 'SN-003',
        uid: 'EMAG-003',
        numeroMag: 'MAG-003',
        stockQuantity: 1,
      }),
    ];

    render(<EquipmentGrid {...defaultProps} equipment={rows} />);

    expect(screen.getAllByText('RAVEN XIP')).toHaveLength(2);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('SN-001')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ouvrir la ligne/i }));

    expect(screen.getByText('SN-001')).toBeInTheDocument();
    expect(screen.getByText('SN-002')).toBeInTheDocument();
    expect(screen.getByText('SN-003')).toBeInTheDocument();
  });

  it('affiche plusieurs equipements', () => {
    const list = [
      makeEquipment({ id: 1, name: 'Projecteur LED' }),
      makeEquipment({ id: 2, name: 'Enceinte JBL', uid: 'EMAG-002', reference: 'REF-200' }),
    ];
    render(<EquipmentGrid {...defaultProps} equipment={list} />);
    expect(screen.getByText('Projecteur LED')).toBeInTheDocument();
    expect(screen.getByText('Enceinte JBL')).toBeInTheDocument();
  });

  it('affiche 1 par unité sérialisée et le reliquat non sérialisé', async () => {
    const user = userEvent.setup();
    const rows = [
      makeEquipment({
        id: 1,
        name: 'DXS15 SUB',
        reference: 'DXS15 SUB',
        serialNumber: null,
        uid: null,
        stockQuantity: 4,
      }),
      makeEquipment({
        id: 2,
        name: 'DXS15 SUB',
        reference: 'DXS15 SUB',
        serialNumber: 'DXS15 SUB_1_1',
        uid: 'EMAG-101',
        stockQuantity: 1,
      }),
      makeEquipment({
        id: 3,
        name: 'DXS15 SUB',
        reference: 'DXS15 SUB',
        serialNumber: 'DXS15 SUB_1_4',
        uid: 'EMAG-104',
        stockQuantity: 7,
      }),
    ];

    const { container } = render(<EquipmentGrid {...defaultProps} equipment={rows} />);
    expect(container.querySelector('.eq-table-qty')?.textContent).toBe('4');

    await user.click(screen.getByRole('button', { name: /ouvrir la ligne/i }));

    const quantities = [...container.querySelectorAll('.eq-table-qty')].map((cell) =>
      cell.textContent.trim(),
    );
    expect(quantities).toEqual(['4', '1', '1', '2']);
    expect(screen.getByText('DXS15 SUB_1_4')).toBeInTheDocument();
  });

  it('rend une référence uniquement non sérialisée déployable', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EquipmentGrid
        {...defaultProps}
        equipment={[
          makeEquipment({
            id: 10,
            name: 'K2',
            reference: 'K2-',
            serialNumber: null,
            uid: null,
            stockQuantity: 8,
          }),
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: /ouvrir la ligne K2-/i })).toBeInTheDocument();
    expect(container.querySelector('.eq-table-qty')?.textContent).toBe('8');

    await user.click(screen.getByRole('button', { name: /ouvrir la ligne K2-/i }));

    expect(
      [...container.querySelectorAll('.eq-table-qty')].map((cell) => cell.textContent.trim()),
    ).toEqual(['8', '8']);
  });

  it('affiche le placeholder photo quand pas de photo', () => {
    const { container } = render(<EquipmentGrid {...defaultProps} equipment={[makeEquipment()]} />);
    expect(container.querySelector('.eq-table-photo-placeholder')).toBeInTheDocument();
  });
});
