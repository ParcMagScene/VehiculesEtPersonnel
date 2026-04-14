// ═══════════════════════════════════════════════════════════════
// SonosPanel — Lecteur Sonos inspiré de l'interface Sonos desktop
// Layout 3 colonnes : Système | Lecture + Queue | Sources
// ═══════════════════════════════════════════════════════════════

import { memo, useState } from 'react';
import { Music, Wifi, Settings, RefreshCw, Search } from 'lucide-react';
import useSonos from '../../hooks/useSonos';
import SonosZoneSelector from './SonosZoneSelector';
import SonosNowPlaying from './SonosNowPlaying';
import SonosControls from './SonosControls';
import SonosVolumeSlider from './SonosVolumeSlider';
import SonosQueue from './SonosQueue';
import SonosSources from './SonosSources';
import { Button, Input, Checkbox } from '@/design-system';
import './SonosPanel.css';

function SonosPanel({ currentUser, _currentUser }) {
  const isAdmin = !!currentUser?.isAdmin || !!_currentUser?.isAdmin;
  const sonos = useSonos({ autoPolling: true, pollInterval: 5000 });
  const [configOpen, setConfigOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');

  if (sonos.configLoading) {
    return <div className="sonos-loading">Chargement Sonos…</div>;
  }

  const isActive = sonos.displayState && (sonos.displayState.playing || sonos.displayState.state === 'paused');

  return (
    <div className="sonos-app">
      {/* ─── Top bar : Volume + Transport + Search + Config ─── */}
      <div className="sonos-topbar">
        <SonosVolumeSlider
          volume={sonos.displayState?.volume ?? sonos.zoneState?.volume}
          muted={sonos.displayState?.muted ?? sonos.zoneState?.muted}
          onSetVolume={sonos.setVolume}
          onMute={sonos.mute}
          onUnmute={sonos.unmute}
          busy={sonos.busy}
        />

        {isActive && (
          <SonosControls
            state={sonos.displayState.state}
            position={sonos.displayState.position}
            duration={sonos.displayState.duration}
            shuffleActive={sonos.displayState.shuffle}
            repeatMode={sonos.displayState.repeat}
            onPlay={sonos.play}
            onPause={sonos.pause}
            onNext={sonos.next}
            onPrevious={sonos.previous}
            onSeek={sonos.seek}
            onShuffle={sonos.setShuffle}
            onRepeat={sonos.setRepeat}
            busy={sonos.busy}
          />
        )}

        <div className="sonos-topbar-actions">
          <div className="sonos-topbar-search">
            <Search size={13} />
            <input
              type="text"
              placeholder="Rechercher…"
              value={sourceSearch}
              onChange={e => setSourceSearch(e.target.value)}
            />
          </div>
          <button className="sonos-icon-btn" onClick={sonos.refresh} title="Rafraîchir">
            <RefreshCw size={15} />
          </button>
          <button
            className={`sonos-icon-btn${configOpen ? ' sonos-icon-active' : ''}`}
            onClick={() => setConfigOpen(o => !o)}
            title="Configuration"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ─── Config panel (collapsible) ─── */}
      {configOpen && (
        <div className="sonos-config-panel">
          <div className="sonos-config-row">
            <Wifi size={14} />
            <label>IP Sonos</label>
            <Input type="text" value={sonos.sonosIP} onChange={e => sonos.setSonosIP(e.target.value)} placeholder="192.168.1.xxx" />
            <Button variant="primary" size="sm" onClick={sonos.saveConfig}>Enregistrer</Button>
          </div>
          <div className="sonos-config-row">
            <Checkbox checked={sonos.polling} onChange={e => sonos.setPolling(e.target.checked)} />
            <label>Monitoring temps réel (5s)</label>
          </div>
        </div>
      )}

      {/* ─── Seek / progress bar ─── */}
      {isActive && sonos.displayState.duration > 0 && (
        <SonosControls.ProgressBar
          position={sonos.displayState.position}
          duration={sonos.displayState.duration}
          onSeek={sonos.seek}
        />
      )}

      {/* ─── Main content: 3 columns ─── */}
      <div className="sonos-main">
        {/* Col 1 : Système (zones) */}
        <div className="sonos-col-system">
          <SonosZoneSelector
            zones={sonos.zones}
            activeZone={sonos.activeZone}
            onZoneSelect={sonos.setActiveZone}
            zonesOpen={sonos.zonesOpen}
            setZonesOpen={sonos.setZonesOpen}
          />
        </div>

        {/* Col 2 : Lecture en cours + Queue */}
        <div className="sonos-col-player">
          <SonosNowPlaying displayState={sonos.displayState} />
          {sonos.sonosIP && (
            <SonosQueue
              queue={sonos.queue}
              queueLoading={sonos.queueLoading}
              nowPlaying={sonos.nowPlaying}
            />
          )}
        </div>

        {/* Col 3 : Sources (includes Favoris) */}
        {sonos.sonosIP && (
          <div className="sonos-col-sources">
            <SonosSources
              musicServices={sonos.musicServices}
              loadMusicServices={sonos.loadMusicServices}
              browseSource={sonos.browseSource}
              browseBack={sonos.browseBack}
              browseReset={sonos.browseReset}
              browseStack={sonos.browseStack}
              browseData={sonos.browseData}
              browseLoading={sonos.browseLoading}
              favorites={sonos.favorites}
              favoritesLoading={sonos.favoritesLoading}
              loadFavorites={sonos.loadFavorites}
              playFavorite={sonos.playFavorite}
              nowPlaying={sonos.nowPlaying}
              isAdmin={isAdmin}
              search={sourceSearch}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(SonosPanel);
