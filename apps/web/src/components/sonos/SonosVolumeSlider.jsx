// ═══════════════════════════════════════════════════════════════
// SonosVolumeSlider — Volume inline (style Sonos topbar)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, memo } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

function SonosVolumeSlider({ volume, muted, onSetVolume, onMute, onUnmute, busy }) {
  const [vol, setVol] = useState(volume ?? 50);
  const [isMuted, setIsMuted] = useState(muted ?? false);

  useEffect(() => { if (volume != null) setVol(volume); }, [volume]);
  useEffect(() => { if (muted != null) setIsMuted(muted); }, [muted]);

  const VolumeIcon = isMuted ? VolumeX : vol < 40 ? Volume1 : Volume2;

  return (
    <div className="sonos-vol">
      <button
        className={`sonos-icon-btn${isMuted ? ' sonos-vol-muted' : ''}`}
        onClick={() => {
          setIsMuted(!isMuted);
          isMuted ? onUnmute() : onMute();
        }}
        disabled={busy}
        title={isMuted ? 'Réactiver le son' : 'Couper le son'}
      >
        <VolumeIcon size={16} />
      </button>
      <input
        type="range" min={0} max={100} value={isMuted ? 0 : vol}
        className="sonos-vol-slider"
        onChange={e => setVol(Number(e.target.value))}
        onMouseUp={() => onSetVolume(vol)}
        onTouchEnd={() => onSetVolume(vol)}
        disabled={busy}
      />
    </div>
  );
}

export default memo(SonosVolumeSlider);
