// ═══════════════════════════════════════════════════════════════
// MobileSonosNowPlaying — Affichage lecture en cours (mobile)
// Pochette large, swipe gauche/droite = next/prev
// ═══════════════════════════════════════════════════════════════

import { Disc, Music, Pause } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

import { InlineAlert } from '@/design-system';

import { formatTime } from '../../hooks/useSonos';

function MobileSonosNowPlaying({ displayState, onNext, onPrevious }) {
  const touchStartX = useRef(null);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    setArtFailed(false);
  }, [displayState?.albumArtURI]);

  if (!displayState) return null;

  if (displayState.error) {
    return <InlineAlert>{displayState.error}</InlineAlert>;
  }

  if (!displayState.playing && displayState.state !== 'paused') {
    return (
      <div className="mobile-sonos-stopped">
        <Music size={40} />
        <span>Aucune lecture en cours</span>
        <span style={{ fontSize: '0.75rem' }}>({displayState.state || 'arrêté'})</span>
      </div>
    );
  }

  const handleTouchStartArt = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEndArt = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 60) {
      dx < 0 ? onNext?.() : onPrevious?.();
    }
  };

  return (
    <div className="mobile-sonos-now">
      <div
        className="mobile-sonos-art-wrap"
        onTouchStart={handleTouchStartArt}
        onTouchEnd={handleTouchEndArt}
      >
        {displayState.albumArtURI && !artFailed ? (
          <img
            src={displayState.albumArtURI}
            alt="Album art"
            loading="lazy"
            className="mobile-sonos-art"
            onError={() => setArtFailed(true)}
          />
        ) : (
          <div className="mobile-sonos-art-placeholder">
            <Music size={64} />
          </div>
        )}
      </div>
      <div className="mobile-sonos-title">{displayState.title}</div>
      <div className="mobile-sonos-artist">{displayState.artist}</div>
      {displayState.album && <div className="mobile-sonos-album">{displayState.album}</div>}
      <div className="mobile-sonos-state-badge">
        {displayState.playing ? (
          <>
            <Disc size={14} className="sonos-spinning" /> En lecture
          </>
        ) : (
          <>
            <Pause size={14} /> En pause
          </>
        )}
      </div>
    </div>
  );
}

export default memo(MobileSonosNowPlaying);
