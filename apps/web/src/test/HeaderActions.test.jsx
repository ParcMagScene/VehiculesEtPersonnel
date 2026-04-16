import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderActions from '../components/header/HeaderActions';

// Mock ProfileEditModal
vi.mock('../components/auth/ProfileEditModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="profile-modal">
      <button onClick={onClose}>Fermer</button>
    </div>
  ),
}));

const adminUser = {
  id: 1,
  name: 'Jean Admin',
  email: 'admin@test.fr',
  isAdmin: true,
  avatar: null,
};
const normalUser = {
  id: 2,
  name: 'Marie User',
  email: 'user@test.fr',
  isAdmin: false,
  avatar: null,
};

const defaultProps = {
  currentUser: adminUser,
  reportedMaintenances: [],
  immobilizedVehicles: [],
  pendingMaintenances: [],
  activeInterventions: [],
  overdueInterventions: [],
  conflictingMaintenances: [],
  pendingRequestsCounts: { interventionRequests: 0, reservationRequests: 0, total: 0 },
  pendingAccessRequests: 0,
  unreadMsgCount: 0,
  onToggleMessaging: vi.fn(),
  onToggleMailing: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenPreferences: vi.fn(),
  onLogout: vi.fn(),
  onUserUpdate: vi.fn(),
  setNotificationFilter: vi.fn(),
  setShowNotificationsPopup: vi.fn(),
};

describe('HeaderActions', () => {
  // ═══ Badges admin ═══
  it('affiche le badge pannes signalees pour admin', () => {
    const { container } = render(
      <HeaderActions {...defaultProps} reportedMaintenances={[{ id: 1 }, { id: 2 }]} />,
    );
    expect(container.querySelector('.has-reported')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('affiche le badge demandes intervention pour admin', () => {
    const { container } = render(
      <HeaderActions {...defaultProps} pendingMaintenances={[{ id: 1 }]} />,
    );
    expect(container.querySelector('.has-pending')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('affiche le badge demandes reservation pour admin', () => {
    render(
      <HeaderActions
        {...defaultProps}
        pendingRequestsCounts={{ interventionRequests: 0, reservationRequests: 3, total: 3 }}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('masque les badges admin pour utilisateur normal', () => {
    const { container } = render(
      <HeaderActions
        {...defaultProps}
        currentUser={normalUser}
        reportedMaintenances={[{ id: 1 }]}
        pendingMaintenances={[{ id: 1 }]}
      />,
    );
    expect(container.querySelector('.has-reported')).not.toBeInTheDocument();
    expect(container.querySelector('.has-pending')).not.toBeInTheDocument();
  });

  // ═══ Messages ═══
  it('appelle onToggleMessaging au clic sur Messages', async () => {
    const user = userEvent.setup();
    const onToggleMessaging = vi.fn();
    render(<HeaderActions {...defaultProps} onToggleMessaging={onToggleMessaging} />);
    await user.click(screen.getByLabelText('Messages'));
    expect(onToggleMessaging).toHaveBeenCalled();
  });

  it('affiche le badge messages non lus', () => {
    render(<HeaderActions {...defaultProps} unreadMsgCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('affiche 9+ quand plus de 9 messages', () => {
    render(<HeaderActions {...defaultProps} unreadMsgCount={15} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  // ═══ Mailing (admin seulement) ═══
  it('affiche le bouton mailing pour admin', () => {
    render(<HeaderActions {...defaultProps} />);
    expect(screen.getByLabelText('Mailing')).toBeInTheDocument();
  });

  it('masque le bouton mailing pour non-admin', () => {
    render(<HeaderActions {...defaultProps} currentUser={normalUser} />);
    expect(screen.queryByLabelText('Mailing')).not.toBeInTheDocument();
  });

  // ═══ Settings ═══
  it('appelle onOpenSettings au clic sur le bouton parametres', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(<HeaderActions {...defaultProps} onOpenSettings={onOpenSettings} />);
    await user.click(screen.getByLabelText(/param/i));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('affiche le badge pending access requests pour admin', () => {
    render(<HeaderActions {...defaultProps} pendingAccessRequests={2} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  // ═══ User menu ═══
  it('ouvre le menu utilisateur au clic sur avatar', async () => {
    const user = userEvent.setup();
    render(<HeaderActions {...defaultProps} />);
    await user.click(screen.getByLabelText(/Menu utilisateur/));
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
    expect(screen.getByText('Mon profil')).toBeInTheDocument();
  });

  it('affiche Utilisateur pour un non-admin', async () => {
    const user = userEvent.setup();
    render(<HeaderActions {...defaultProps} currentUser={normalUser} />);
    await user.click(screen.getByLabelText(/Menu utilisateur/));
    expect(screen.getByText('Utilisateur')).toBeInTheDocument();
  });

  it('appelle onLogout au clic sur Se deconnecter', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<HeaderActions {...defaultProps} onLogout={onLogout} />);
    await user.click(screen.getByLabelText(/Menu utilisateur/));
    await user.click(screen.getByText(/connecter/i));
    expect(onLogout).toHaveBeenCalled();
  });
});
