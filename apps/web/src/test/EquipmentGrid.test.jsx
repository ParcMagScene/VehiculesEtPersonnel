import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import EquipmentGrid from '../components/equipment/EquipmentGrid';

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

  it('affiche plusieurs equipements', () => {
    const list = [
      makeEquipment({ id: 1, name: 'Projecteur LED' }),
      makeEquipment({ id: 2, name: 'Enceinte JBL', uid: 'EMAG-002' }),
    ];
    render(<EquipmentGrid {...defaultProps} equipment={list} />);
    expect(screen.getByText('Projecteur LED')).toBeInTheDocument();
    expect(screen.getByText('Enceinte JBL')).toBeInTheDocument();
  });

  it('affiche le placeholder photo quand pas de photo', () => {
    const { container } = render(<EquipmentGrid {...defaultProps} equipment={[makeEquipment()]} />);
    expect(container.querySelector('.eq-table-photo-placeholder')).toBeInTheDocument();
  });
});
