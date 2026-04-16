// ═══════════════════════════════════════════════════════════════
// MobileSonos — Shell principal Sonos mobile
// Réutilise le hook useSonos (zéro duplication logique)
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react';
import { ArrowLeft, Music, RefreshCw } from 'lucide-react';
import useSonos from '../../hooks/useSonos';
import MobileSonosNowPlaying from './MobileSonosNowPlaying';
import MobileSonosControls from './MobileSonosControls';
import MobileSonosVolume from './MobileSonosVolume';
import MobileSonosFavorites from './MobileSonosFavorites';
import { Button, Spinner } from '@/design-system';
import './MobileSonos.css';

function MobileSonos({ currentUser, onBack }) {
  const isAdmin = !!currentUser?.isAdmin || currentUser?.role === 'admin';
  const sonos = useSonos({ autoPolling: true, pollInterval: 5000 });

  return (
    <div className="mobile-screen">
      {/* Header */}
      <div className="mobile-screen-header">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2 className="mobile-screen-title">
          <Music size={18} /> Sonos
        </h2>
        <Button variant="ghost" size="sm" onClick={sonos.refresh} aria-label="Rafraîchir">
          <RefreshCw size={18} />
        </Button>
      </div>

      {sonos.configLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Spinner />
        </div>
      ) : !sonos.sonosIP ? (
        <div className="mobile-sonos-stopped">
          <Music size={40} />
          <span>Sonos non configuré</span>
          <span style={{ fontSize: '0.75rem' }}>Configurez l'IP Sonos depuis le bureau</span>
        </div>
      ) : (
        <div className="mobile-sonos">
          {/* Sélecteur de zones (pills horizontales) */}
          {sonos.zones.length > 1 && (
            <div className="mobile-sonos-zones">
              {sonos.zones.map((z, i) => (
                <button
                  key={i}
                  className={`mobile-sonos-zone-pill${sonos.activeZone === z.coordinator ? ' mobile-sonos-zone-pill-active' : ''}`}
                  onClick={() => sonos.setActiveZone(z.coordinator)}
                >
                  {z.name}
                </button>
              ))}
            </div>
          )}

          {/* Now Playing avec swipe */}
          <MobileSonosNowPlaying
            displayState={sonos.displayState}
            onNext={sonos.next}
            onPrevious={sonos.previous}
          />

          {/* Contrôles + Volume */}
          {sonos.displayState &&
            (sonos.displayState.playing || sonos.displayState.state === 'paused') && (
              <>
                <MobileSonosControls
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
                  isAdmin={isAdmin}
                />
                <MobileSonosVolume
                  volume={sonos.displayState.volume ?? sonos.zoneState?.volume}
                  muted={sonos.displayState.muted ?? sonos.zoneState?.muted}
                  onSetVolume={sonos.setVolume}
                  onMute={sonos.mute}
                  onUnmute={sonos.unmute}
                  busy={sonos.busy}
                  isAdmin={isAdmin}
                />
              </>
            )}

          {/* Favoris */}
          <MobileSonosFavorites
            favorites={sonos.favorites}
            favoritesLoading={sonos.favoritesLoading}
            loadFavorites={sonos.loadFavorites}
            playFavorite={sonos.playFavorite}
            nowPlaying={sonos.nowPlaying}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
}

export default memo(MobileSonos);
