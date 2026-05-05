// ═══════════════════════════════════════════════════════════════
// SonosNowPlaying — Grande pochette + infos (style Sonos desktop)
// ═══════════════════════════════════════════════════════════════

import { Info, Music } from 'lucide-react';
import { memo } from 'react';

import { InlineAlert } from '@/design-system';
import RadioLogo from './RadioLogo';

function SonosNowPlaying({ displayState }) {
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
        <RadioLogo
          src={displayState.albumArtURI}
          alt="Album art"
          className="sonos-np-art"
          placeholderClassName="sonos-np-art sonos-np-art-placeholder"
          placeholder={<Music size={48} />}
        />
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
