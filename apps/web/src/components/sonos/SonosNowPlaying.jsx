// ═══════════════════════════════════════════════════════════════
// SonosNowPlaying — Grande pochette + infos (style Sonos desktop)
// ═══════════════════════════════════════════════════════════════

import { Info, Music } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { InlineAlert } from '@/design-system';

function SonosNowPlaying({ displayState }) {
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    setArtFailed(false);
  }, [displayState?.albumArtURI]);

  if (!displayState) return null;

  if (displayState.error) {
    return (
      <div className="sonos-np">
        <InlineAlert>{displayState.error}</InlineAlert>
      </div>
    );
  }

  if (!displayState.playing && displayState.state !== 'paused') {
    return (
      <div className="sonos-np sonos-np-empty">
        <Music size={40} />
        <span>Aucune lecture en cours</span>
      </div>
    );
  }

  return (
    <div className="sonos-np">
      {/* Grande pochette */}
      <div className="sonos-np-art-wrap">
        {displayState.albumArtURI && !artFailed ? (
          <img
            src={displayState.albumArtURI}
            alt="Album art"
            loading="lazy"
            className="sonos-np-art"
            onError={() => setArtFailed(true)}
          />
        ) : (
          <div className="sonos-np-art sonos-np-art-placeholder">
            <Music size={48} />
          </div>
        )}
      </div>

      {/* Titre + artiste + album */}
      <div className="sonos-np-info">
        <div className="sonos-np-title">{displayState.title || 'Titre inconnu'}</div>
        {displayState.artist && <div className="sonos-np-artist">{displayState.artist}</div>}
        {displayState.album && <div className="sonos-np-album">{displayState.album}</div>}
      </div>
    </div>
  );
}

export default memo(SonosNowPlaying);
