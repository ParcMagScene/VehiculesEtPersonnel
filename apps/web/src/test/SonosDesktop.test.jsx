import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  displayState: null,
  controlZone: '192.168.1.50',
  nowPlaying: null,
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
  Checkbox: (props) => <input type="checkbox" {...props} />,
  SectionHeader: ({ children, ...props }) => <h3 {...props}>{children}</h3>,
  InlineAlert: ({ children }) => <div role="alert">{children}</div>,
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

// ── Import components after mocks ──
import SonosNowPlaying from '../components/sonos/SonosNowPlaying';
import SonosControls from '../components/sonos/SonosControls';
import SonosVolumeSlider from '../components/sonos/SonosVolumeSlider';
import SonosFavorites from '../components/sonos/SonosFavorites';
import SonosZoneSelector from '../components/sonos/SonosZoneSelector';
import SonosPanel from '../components/sonos/SonosPanel';

describe('SonosNowPlaying', () => {
  it('renders nothing when displayState is null', () => {
    const { container } = render(<SonosNowPlaying displayState={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows error via InlineAlert', () => {
    render(<SonosNowPlaying displayState={{ error: 'Erreur réseau' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Erreur réseau');
  });

  it('shows no playback message when stopped', () => {
    render(<SonosNowPlaying displayState={{ playing: false, state: 'stopped' }} />);
    expect(screen.getByText(/Aucune lecture en cours/)).toBeInTheDocument();
  });

  it('shows track info when playing', () => {
    render(
      <SonosNowPlaying displayState={{
        playing: true, title: 'My Song', artist: 'Artist', album: 'Album',
        position: 65, duration: 200, albumArtURI: 'http://img/art.jpg',
      }} />
    );
    expect(screen.getByText('My Song')).toBeInTheDocument();
    expect(screen.getByText('Artist')).toBeInTheDocument();
    expect(screen.getByText('Album')).toBeInTheDocument();
  });
});

describe('SonosControls', () => {
  const baseProps = {
    state: 'playing',
    shuffleActive: false, repeatMode: 'none',
    onPlay: vi.fn(), onPause: vi.fn(), onNext: vi.fn(), onPrevious: vi.fn(),
    onShuffle: vi.fn(), onRepeat: vi.fn(),
    busy: false,
  };

  it('renders transport buttons for all users', () => {
    render(<SonosControls {...baseProps} />);
    expect(screen.getByTitle('Aléatoire')).toBeInTheDocument();
  });
});

describe('SonosVolumeSlider', () => {
  const baseProps = {
    volume: 50, muted: false,
    onSetVolume: vi.fn(), onMute: vi.fn(), onUnmute: vi.fn(),
    busy: false,
  };

  it('renders mute button for all users', () => {
    render(<SonosVolumeSlider {...baseProps} />);
    expect(screen.getByTitle('Couper le son')).toBeInTheDocument();
  });
});

describe('SonosFavorites', () => {
  const baseProps = {
    favorites: [{ title: 'Radio 1', uri: 'x-1' }, { title: 'Jazz FM', uri: 'x-2' }],
    favoritesLoading: false, loadFavorites: vi.fn(), playFavorite: vi.fn(),
    nowPlaying: null,
  };

  it('renders favorites heading', () => {
    render(<SonosFavorites {...baseProps} />);
    expect(screen.getByText('Favoris Sonos')).toBeInTheDocument();
  });
});

describe('SonosZoneSelector', () => {
  it('returns null when no zones', () => {
    const { container } = render(
      <SonosZoneSelector zones={[]} activeZone={null} onZoneSelect={vi.fn()} zonesOpen={false} setZonesOpen={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders zones when provided', () => {
    render(
      <SonosZoneSelector
        zones={[{ name: 'Salon', coordinator: '10.0.0.1', members: ['a'] }]}
        activeZone={null} onZoneSelect={vi.fn()} zonesOpen={true} setZonesOpen={vi.fn()}
      />
    );
    expect(screen.getByText('Salon')).toBeInTheDocument();
  });
});

describe('SonosPanel', () => {
  beforeEach(() => { mockSonos = { ...defaultSonos }; });

  it('shows loading state', () => {
    mockSonos = { ...defaultSonos, configLoading: true };
    render(<SonosPanel currentUser={{ isAdmin: true }} />);
    expect(screen.getByText(/Chargement Sonos/)).toBeInTheDocument();
  });

  it('renders main container when loaded', () => {
    render(<SonosPanel currentUser={{ isAdmin: true }} />);
    expect(document.querySelector('.sonos-app')).toBeInTheDocument();
  });
});
