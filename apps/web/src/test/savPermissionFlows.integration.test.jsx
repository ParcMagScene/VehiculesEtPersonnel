import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EquipmentPanel from '../components/equipment/EquipmentPanel.jsx';
import MobileEquipmentQR from '../components/mobile/MobileEquipmentQR.jsx';
import { useEquipment } from '../components/equipment/useEquipment';

const { apiMock, toastMock, refreshPublishMock } = vi.hoisted(() => ({
  apiMock: {
    getEquipmentByUid: vi.fn(),
    createSavTicket: vi.fn(),
    createSavRequest: vi.fn(),
  },
  toastMock: {
    warning: vi.fn(),
    error: vi.fn(),
  },
  refreshPublishMock: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  __esModule: true,
  default: apiMock,
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => toastMock,
}));

vi.mock('../utils/refresh-bus', () => ({
  refreshBus: {
    publish: refreshPublishMock,
  },
}));

vi.mock('../components/mobile/MobileControlsScreen', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../components/ui/PrintPreviewProvider', () => ({
  usePrintPreview: () => ({ showHtml: vi.fn() }),
}));

vi.mock('../components/equipment/EquipmentDetail', () => ({
  EquipmentDetailDialog: () => null,
  EquipmentSlidePanel: () => null,
}));
vi.mock('../components/equipment/EquipmentGrid', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/EquipmentFormModal', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/CategoryCascadeFilter', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/EquipmentCategoriesTree', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/EquipmentBatchLabels', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/EquipmentFlightCaseLabels', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/EquipmentLabelPrint', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/EquipmentMediaManager', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/equipment/import/LocmatImportModal', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/vehicles/DepotMap', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../components/vehicles/MaintenanceReportModal', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../components/equipment/EquipmentSAV', () => ({
  SavDetailDialog: () => null,
  SavSlidePanel: () => null,
  SavTicketFormModal: () => null,
  SavTicketsList: () => null,
  MobileSavRequestForm: ({ onSubmit }) => (
    <button
      type="button"
      onClick={() => onSubmit({ equipment_id: 1, title: 'Test SAV from panel' })}
    >
      submit-mobile-sav-request
    </button>
  ),
}));

vi.mock('../components/equipment/useEquipment', () => ({
  useEquipment: vi.fn(),
}));

function buildUseEquipmentMock(overrides = {}) {
  return {
    equipment: [],
    categories: [],
    savTickets: [],
    persons: [],
    brandsList: [],
    loading: false,
    photosList: [],
    logosList: [],
    depotZones: null,
    allDepotZones: null,
    locationStats: null,
    families: [],
    subfamilies: [],
    leafCategories: [],
    filteredEquipment: [],
    filteredTickets: [],
    stats: {
      total: 0,
      available: 0,
      in_use: 0,
      maintenance: 0,
      openTickets: 0,
    },
    favoriteIds: new Set(),
    watchIds: new Set(),
    subTab: 'sav',
    setSubTab: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    filterStatus: '',
    setFilterStatus: vi.fn(),
    filterCatTree: null,
    setFilterCatTree: vi.fn(),
    savFilterStatus: '',
    setSavFilterStatus: vi.fn(),
    savSearch: '',
    setSavSearch: vi.fn(),
    filterZone: '',
    setFilterZone: vi.fn(),
    filterSerialized: false,
    setFilterSerialized: vi.fn(),
    listFilter: '',
    setListFilter: vi.fn(),
    showEquipmentModal: false,
    setShowEquipmentModal: vi.fn(),
    editingEquipment: null,
    setEditingEquipment: vi.fn(),
    selectedEquipment: null,
    setSelectedEquipment: vi.fn(),
    dialogEquipment: null,
    setDialogEquipment: vi.fn(),
    clickTimerRef: { current: null },
    showSavModal: false,
    setShowSavModal: vi.fn(),
    editingSavTicket: null,
    setEditingSavTicket: vi.fn(),
    savTicketEquipment: null,
    setSavTicketEquipment: vi.fn(),
    selectedTicket: null,
    setSelectedTicket: vi.fn(),
    dialogTicket: null,
    setDialogTicket: vi.fn(),
    ticketClickTimerRef: { current: null },
    showImportModal: false,
    setShowImportModal: vi.fn(),
    showReportModal: false,
    setShowReportModal: vi.fn(),
    exportingSavPdf: false,
    exportingEquipmentInventoryPdf: false,
    showMobileSavRequest: true,
    setShowMobileSavRequest: vi.fn(),
    labelPrintEquipment: null,
    setLabelPrintEquipment: vi.fn(),
    mgmtTab: 'imports',
    setMgmtTab: vi.fn(),
    showDepotMap: false,
    setShowDepotMap: vi.fn(),
    depotMapModalZone: null,
    setDepotMapModalZone: vi.fn(),
    modalDepotData: null,
    isAdmin: false,
    canManageEquipmentMaintenance: false,
    loadData: vi.fn(),
    handleSaveEquipment: vi.fn(),
    handleDeleteEquipment: vi.fn(),
    handleSerializeEquipment: vi.fn(),
    handleSaveSavTicket: vi.fn(),
    toggleList: vi.fn(),
    handleExportSavPdf: vi.fn(),
    handleExportEquipmentInventoryPdf: vi.fn(),
    confirm: vi.fn(),
    ConfirmDialogRenderer: () => null,
    ...overrides,
  };
}

describe('SAV permissions integration flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getEquipmentByUid.mockResolvedValue({
      id: 123,
      uid: 'EMAG-123',
      name: 'Projecteur Test',
      status: 'available',
      savTickets: [],
    });
    apiMock.createSavTicket.mockResolvedValue({ id: 1 });
    apiMock.createSavRequest.mockResolvedValue({ id: 2 });
  });

  it('mobile QR: compte maintenance crée un ticket SAV', async () => {
    const user = userEvent.setup();

    render(
      <MobileEquipmentQR
        uid="EMAG-123"
        currentUser={{ permissions: { can_manage_equipment_maintenance: true } }}
      />,
    );

    await screen.findByText('Équipement scanné');
    const savMenuBtn = document.querySelector('.m-eq-qr-menu-btn.sav');
    expect(savMenuBtn).toBeTruthy();
    await user.click(savMenuBtn);
    const savTitleInput = await screen.findByPlaceholderText('Ex: Batterie ne charge plus');
    await user.type(savTitleInput, 'Batterie HS');
    await user.click(screen.getByText(/créer le ticket sav/i));

    await waitFor(() => expect(apiMock.createSavTicket).toHaveBeenCalledTimes(1));
    expect(apiMock.createSavRequest).not.toHaveBeenCalled();
    expect(refreshPublishMock).toHaveBeenCalledWith('sav');
  });

  it('mobile QR: compte sans maintenance crée une demande SAV', async () => {
    const user = userEvent.setup();

    render(<MobileEquipmentQR uid="EMAG-123" currentUser={{ permissions: {} }} />);

    await screen.findByText('Équipement scanné');
    const savMenuBtn = document.querySelector('.m-eq-qr-menu-btn.sav');
    expect(savMenuBtn).toBeTruthy();
    await user.click(savMenuBtn);
    const savTitleInput = await screen.findByPlaceholderText('Ex: Batterie ne charge plus');
    await user.type(savTitleInput, 'Test demande');
    await user.click(screen.getByText(/créer la demande sav/i));

    await waitFor(() => expect(apiMock.createSavRequest).toHaveBeenCalledTimes(1));
    expect(apiMock.createSavTicket).not.toHaveBeenCalled();
    expect(refreshPublishMock).toHaveBeenCalledWith('sav');
  });

  it('equipment panel: formulaire demande SAV mobile route vers createSavRequest sans droit maintenance', async () => {
    const user = userEvent.setup();
    const useEquipmentState = buildUseEquipmentMock({
      canManageEquipmentMaintenance: false,
    });
    useEquipment.mockReturnValue(useEquipmentState);

    render(<EquipmentPanel currentUser={{}} initialTab="sav" isMobile />);

    await user.click(screen.getByRole('button', { name: /submit-mobile-sav-request/i }));

    await waitFor(() => expect(apiMock.createSavRequest).toHaveBeenCalledTimes(1));
    expect(apiMock.createSavTicket).not.toHaveBeenCalled();
    expect(useEquipmentState.setShowMobileSavRequest).toHaveBeenCalledWith(false);
    expect(useEquipmentState.loadData).toHaveBeenCalledTimes(1);
  });

  it('equipment panel: formulaire demande SAV mobile route vers createSavTicket avec droit maintenance', async () => {
    const user = userEvent.setup();
    const useEquipmentState = buildUseEquipmentMock({
      canManageEquipmentMaintenance: true,
    });
    useEquipment.mockReturnValue(useEquipmentState);

    render(<EquipmentPanel currentUser={{}} initialTab="sav" isMobile />);

    await user.click(screen.getByRole('button', { name: /submit-mobile-sav-request/i }));

    await waitFor(() => expect(apiMock.createSavTicket).toHaveBeenCalledTimes(1));
    expect(apiMock.createSavRequest).not.toHaveBeenCalled();
    expect(useEquipmentState.setShowMobileSavRequest).toHaveBeenCalledWith(false);
    expect(useEquipmentState.loadData).toHaveBeenCalledTimes(1);
  });
});
