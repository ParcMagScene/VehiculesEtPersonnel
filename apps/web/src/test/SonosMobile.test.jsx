import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mock useSonos ──
const defaultSonos = {
  configLoading: false,
  sonosIP: '192.168.1.50',
  setSonosIP: vi.fn(),
  saveConfig: vi.fn(),
  zones: [],
  activeZone: null,
  setActiveZone: vi.fn(),
  zoneState: null,
  zonesOpen: false,
  setZonesOpen: vi.fn(),
  displayState: { playing: true, title: 'Test', artist: 'Art', position: 10, duration: 100 },
  controlZone: '192.168.1.50',
  nowPlaying: { playing: true, title: 'Test' },
  favorites: [],
  favoritesLoading: false,
  loadFavorites: vi.fn(),
  playFavorite: vi.fn(),
  busy: false,
  play: vi.fn(),
  pause: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  setVolume: vi.fn(),
  mute: vi.fn(),
  unmute: vi.fn(),
  seek: vi.fn(),
  setShuffle: vi.fn(),
  setRepeat: vi.fn(),
  refresh: vi.fn(),
  polling: false,
  setPolling: vi.fn(),
  musicServices: [],
  loadMusicServices: vi.fn(),
  browseSource: vi.fn(),
  browseBack: vi.fn(),
  browseReset: vi.fn(),
  browseStack: [],
  browseData: null,
  browseLoading: false,
  queue: [],
  queueLoading: false,
  loadQueue: vi.fn(),
};

let mockSonos = { ...defaultSonos };

vi.mock('../hooks/useSonos', () => ({
  default: () => mockSonos,
  formatTime: (s) => {
    if (!s) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  },
}));

vi.mock('@/design-system', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Input: (props) => <input {...props} />,
  InlineAlert: ({ children }) => <div role="alert">{children}</div>,
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

// ── Import AFTER mocks ──
import MobileSonos from '../components/mobile/MobileSonos';
import MobileSonosNowPlaying from '../components/mobile/MobileSonosNowPlaying';
import MobileSonosControls from '../components/mobile/MobileSonosControls';
import MobileSonosVolume from '../components/mobile/MobileSonosVolume';
import MobileSonosFavorites from '../components/mobile/MobileSonosFavorites';

describe('MobileSonosNowPlaying', () => {
  it('renders nothing when displayState is null', () => {
    const { container } = render(
      <MobileSonosNowPlaying displayState={null} onNext={vi.fn()} onPrevious={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows error alert', () => {
    render(
      <MobileSonosNowPlaying displayState={{ error: 'Nope' }} onNext={vi.fn()} onPrevious={vi.fn()} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Nope');
  });

  it('shows stopped state', () => {
    render(
      <MobileSonosNowPlaying
        displayState={{ playing: false, state: 'stopped' }}
        onNext={vi.fn()} onPrevious={vi.fn()}
      />
    );
    expect(screen.getByText(/Aucune lecture en cours/)).toBeInTheDocument();
  });

  it('shows track info when playing', () => {
    render(
      <MobileSonosNowPlaying
        displayState={{
          playing: true, title: 'Mobile Song', artist: 'Art',
          position: 10, duration: 60, albumArtURI: 'http://img.jpg',
        }}
        onNext={vi.fn()} onPrevious={vi.fn()}
      />
    );
    expect(screen.getByText('Mobile Song')).toBeInTheDocument();
    expect(screen.getByText('Art')).toBeInTheDocument();
  });
});

describe('MobileSonosControls', () => {
  const baseProps = {
    state: 'playing', position: 0, duration: 120,
    shuffleActive: false, repeatMode: 'none',
    onPlay: vi.fn(), onPause: vi.fn(), onNext: vi.fn(), onPrevious: vi.fn(),
    onSeek: vi.fn(), onShuffle: vi.fn(), onRepeat: vi.fn(),
    busy: false, isAdmin: true,
  };

  it('returns null for non-admin', () => {
    const { container } = render(<MobileSonosControls {...baseProps} isAdmin={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders play/pause controls for admin', () => {
    render(<MobileSonosControls {...baseProps} />);
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });
});

describe('MobileSonosVolume', () => {
  const baseProps = {
    volume: 50, muted: false,
    onSetVolume: vi.fn(), onMute: vi.fn(), onUnmute: vi.fn(),
    busy: false, isAdmin: true,
  };

  it('returns null for non-admin', () => {
    const { container } = render(<MobileSonosVolume {...baseProps} isAdmin={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders mute button', () => {
    render(<MobileSonosVolume {...baseProps} />);
    expect(screen.getByLabelText('Couper le son')).toBeInTheDocument();
  });
});

describe('MobileSonosFavorites', () => {
  const baseProps = {
    favorites: [{ title: 'Fav1', uri: 'x' }],
    favoritesLoading: false,
    loadFavorites: vi.fn(),
    playFavorite: vi.fn(),
    nowPlaying: null,
    isAdmin: true,
  };

  it('returns null for non-admin', () => {
    const { container } = render(<MobileSonosFavorites {...baseProps} isAdmin={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders favorites list for admin', () => {
    render(<MobileSonosFavorites {...baseProps} />);
    expect(screen.getByText('Fav1')).toBeInTheDocument();
  });
});

describe('MobileSonos', () => {
  beforeEach(() => { mockSonos = { ...defaultSonos }; });

  it('renders header with title', () => {
    render(<MobileSonos currentUser={{ isAdmin: true }} onBack={vi.fn()} />);
    expect(screen.getByText('Sonos')).toBeInTheDocument();
  });

  it('shows loading spinner when configLoading', () => {
    mockSonos = { ...defaultSonos, configLoading: true };
    render(<MobileSonos currentUser={{ isAdmin: true }} onBack={vi.fn()} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    render(<MobileSonos currentUser={{ isAdmin: true }} onBack={onBack} />);
    fireEvent.click(screen.getByLabelText('Retour'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
