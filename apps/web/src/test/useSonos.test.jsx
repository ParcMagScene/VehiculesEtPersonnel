import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted) ──
const { mockToast, mockApi } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  mockApi: {
    getSonosConfig: vi.fn(),
    saveSonosConfig: vi.fn(),
    getSonosNowPlaying: vi.fn(),
    getSonosZones: vi.fn(),
    getSonosState: vi.fn(),
    getSonosFavorites: vi.fn(),
    sonosPlay: vi.fn(),
    sonosPause: vi.fn(),
    sonosNext: vi.fn(),
    sonosPrevious: vi.fn(),
    sonosSetVolume: vi.fn(),
    sonosMute: vi.fn(),
    sonosUnmute: vi.fn(),
    sonosSeek: vi.fn(),
    sonosShuffle: vi.fn(),
    sonosRepeat: vi.fn(),
    sonosPlayFavorite: vi.fn(),
    getSonosMusicServices: vi.fn(),
    browseSonos: vi.fn(),
    getSonosQueue: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => mockToast,
}));

vi.mock('../utils/api', () => ({ default: mockApi }));

import useSonos, { formatTime } from '../hooks/useSonos';

describe('formatTime', () => {
  it('formats 0 as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats null/undefined as 0:00', () => {
    expect(formatTime(null)).toBe('0:00');
    expect(formatTime(undefined)).toBe('0:00');
  });

  it('formats 65 seconds as 1:05', () => {
    expect(formatTime(65)).toBe('1:05');
  });

  it('formats 3661 seconds as 61:01', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('formats 9 seconds as 0:09', () => {
    expect(formatTime(9)).toBe('0:09');
  });
});

describe('useSonos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '' });
    mockApi.getSonosNowPlaying.mockResolvedValue({ playing: false });
    mockApi.getSonosZones.mockResolvedValue({ zones: [] });
    mockApi.getSonosState.mockResolvedValue({});
    mockApi.getSonosFavorites.mockResolvedValue({ favorites: [] });
    mockApi.getSonosMusicServices.mockResolvedValue({ sources: [] });
    mockApi.browseSonos.mockResolvedValue({ containers: [], items: [] });
    mockApi.getSonosQueue.mockResolvedValue({ items: [] });
  });

  it('loads config on mount', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '192.168.1.50' });

    const { result } = renderHook(() => useSonos({ autoPolling: false }));

    await waitFor(() => {
      expect(result.current.configLoading).toBe(false);
    });
    expect(result.current.sonosIP).toBe('192.168.1.50');
    expect(mockApi.getSonosConfig).toHaveBeenCalledOnce();
  });

  it('starts with configLoading true', () => {
    mockApi.getSonosConfig.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    expect(result.current.configLoading).toBe(true);
  });

  it('shows error toast on config load failure', async () => {
    mockApi.getSonosConfig.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSonos({ autoPolling: false }));

    await waitFor(() => {
      expect(result.current.configLoading).toBe(false);
    });
    expect(mockToast.error).toHaveBeenCalledWith('Erreur chargement config Sonos');
  });

  it('loads zones when sonosIP is set', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '192.168.1.50' });
    mockApi.getSonosZones.mockResolvedValue({
      zones: [{ name: 'Salon', coordinator: '192.168.1.50', members: ['a'] }],
    });

    const { result } = renderHook(() => useSonos({ autoPolling: false }));

    await waitFor(() => {
      expect(result.current.zones).toHaveLength(1);
    });
    expect(result.current.zones[0].name).toBe('Salon');
  });

  it('saveConfig calls API and shows success toast', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '' });
    mockApi.saveSonosConfig.mockResolvedValue({});

    const { result } = renderHook(() => useSonos({ autoPolling: false }));

    await waitFor(() => expect(result.current.configLoading).toBe(false));

    act(() => {
      result.current.setSonosIP('192.168.1.99');
    });
    await act(async () => {
      await result.current.saveConfig();
    });

    expect(mockApi.saveSonosConfig).toHaveBeenCalledWith('192.168.1.99');
    expect(mockToast.success).toHaveBeenCalledWith('Configuration Sonos enregistrée');
  });

  it('saveConfig shows error toast on failure', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '' });
    mockApi.saveSonosConfig.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      await result.current.saveConfig();
    });
    expect(mockToast.error).toHaveBeenCalledWith('Erreur enregistrement');
  });

  it('play calls API with controlZone', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '192.168.1.50' });
    mockApi.sonosPlay.mockResolvedValue({});

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      await result.current.play();
    });
    expect(mockApi.sonosPlay).toHaveBeenCalledWith('192.168.1.50');
  });

  it('pause calls API correctly', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '192.168.1.50' });
    mockApi.sonosPause.mockResolvedValue({});

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      await result.current.pause();
    });
    expect(mockApi.sonosPause).toHaveBeenCalledWith('192.168.1.50');
  });

  it('next/previous call API', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '10.0.0.1' });
    mockApi.sonosNext.mockResolvedValue({});
    mockApi.sonosPrevious.mockResolvedValue({});

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      await result.current.next();
    });
    expect(mockApi.sonosNext).toHaveBeenCalledWith('10.0.0.1');

    await act(async () => {
      await result.current.previous();
    });
    expect(mockApi.sonosPrevious).toHaveBeenCalledWith('10.0.0.1');
  });

  it('setVolume calls API with value', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '10.0.0.1' });
    mockApi.sonosSetVolume.mockResolvedValue({});

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      await result.current.setVolume(75);
    });
    expect(mockApi.sonosSetVolume).toHaveBeenCalledWith('10.0.0.1', 75);
  });

  it('mute/unmute call API', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '10.0.0.1' });
    mockApi.sonosMute.mockResolvedValue({});
    mockApi.sonosUnmute.mockResolvedValue({});

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      await result.current.mute();
    });
    expect(mockApi.sonosMute).toHaveBeenCalledWith('10.0.0.1');

    await act(async () => {
      await result.current.unmute();
    });
    expect(mockApi.sonosUnmute).toHaveBeenCalledWith('10.0.0.1');
  });

  it('loadFavorites fetches and stores favorites', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '' });
    mockApi.getSonosFavorites.mockResolvedValue({
      favorites: [{ title: 'Radio 1', uri: 'x-rincon://1' }],
    });

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      await result.current.loadFavorites();
    });
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.favorites[0].title).toBe('Radio 1');
  });

  it('playFavorite calls API and shows toast', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '10.0.0.1' });
    mockApi.sonosPlayFavorite.mockResolvedValue({});

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    const fav = { title: 'Jazz FM', uri: 'x-rincon://jazz' };
    await act(async () => {
      await result.current.playFavorite(fav);
    });
    expect(mockApi.sonosPlayFavorite).toHaveBeenCalledWith(
      '10.0.0.1',
      'x-rincon://jazz',
      'Jazz FM',
    );
    expect(mockToast.success).toHaveBeenCalledWith('Lecture : Jazz FM');
  });

  it('displayState falls back to nowPlaying when no activeZone', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '10.0.0.1' });
    mockApi.getSonosNowPlaying.mockResolvedValue({ playing: true, title: 'Test Song' });

    const { result } = renderHook(() => useSonos({ autoPolling: true }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await waitFor(() => {
      expect(result.current.displayState).toBeTruthy();
    });
    expect(result.current.displayState.title).toBe('Test Song');
  });

  it('controlZone defaults to sonosIP', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '192.168.1.50' });

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    expect(result.current.controlZone).toBe('192.168.1.50');
  });

  it('setActiveZone updates activeZone and loads zoneState', async () => {
    mockApi.getSonosConfig.mockResolvedValue({ sonosIP: '10.0.0.1' });
    mockApi.getSonosState.mockResolvedValue({ playing: true, title: 'Zone Track', volume: 60 });

    const { result } = renderHook(() => useSonos({ autoPolling: false }));
    await waitFor(() => expect(result.current.configLoading).toBe(false));

    await act(async () => {
      result.current.setActiveZone('10.0.0.2');
    });
    await waitFor(() => {
      expect(result.current.zoneState).toBeTruthy();
    });
    expect(mockApi.getSonosState).toHaveBeenCalledWith('10.0.0.2');
  });
});
