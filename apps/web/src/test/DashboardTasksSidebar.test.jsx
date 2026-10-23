import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/design-system', () => ({
  Accordion: ({ children }) => <div>{children}</div>,
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Tooltip: ({ children }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Bell: () => null,
  BellOff: () => null,
  Briefcase: () => null,
  Check: () => null,
  ClipboardList: () => null,
  Clock: () => null,
  Disc: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Music: () => null,
  RefreshCw: () => null,
  Save: () => null,
  Settings: () => null,
  Truck: () => null,
}));

vi.mock('../hooks/useAffairesList', () => ({
  useAffairesList: () => ({ affairesMap: new Map() }),
}));

vi.mock('../hooks/useRefreshSubscription', () => ({
  useRefreshSubscription: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ error: vi.fn() }),
}));

vi.mock('../utils/api', () => ({
  default: {
    getTasks: vi.fn(),
    getDisplaySidebarConfig: vi.fn().mockResolvedValue({ sections: null }),
    getDisplayPendingAlerts: vi.fn().mockResolvedValue({ activeAlerts: [] }),
    getSonosNowPlaying: vi.fn().mockResolvedValue(null),
  },
}));

import DashboardTasksSidebar from '../components/DisplayDashboard/DashboardTasksSidebar';
import api from '../utils/api';

describe('DashboardTasksSidebar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le véhicule d’une tâche lorsque son nom est en camelCase', async () => {
    api.getTasks.mockResolvedValue([
      {
        id: 1,
        title: 'Course du jour',
        section: 'courses',
        status: 'pending',
        visible: 1,
        reservationVehicleName: 'Camion Atego',
      },
    ]);

    render(<DashboardTasksSidebar />);

    expect(await screen.findByText('Camion Atego')).toBeInTheDocument();
    expect(screen.getByText('Camion Atego').closest('.dash-task-vehicle')).toBeInTheDocument();
  });
});
