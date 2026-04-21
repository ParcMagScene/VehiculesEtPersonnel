// ═══════════════════════════════════════════════════════════════
// MobileSonosVolume — Slider volume tactile pleine largeur
// ═══════════════════════════════════════════════════════════════

import { Volume2, VolumeX } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

function MobileSonosVolume({ volume, muted, onSetVolume, onMute, onUnmute, busy, isAdmin }) {
  const [vol, setVol] = useState(volume ?? 50);
  const [isMuted, setIsMuted] = useState(muted ?? false);

  useEffect(() => {
    if (volume != null) setVol(volume);
  }, [volume]);
  useEffect(() => {
    if (muted != null) setIsMuted(muted);
  }, [muted]);

  if (!isAdmin) return null;

  return (
    <div className="mobile-sonos-volume">
      <button
        type="button"
        className={`mobile-sonos-transport-btn mobile-sonos-transport-sm${isMuted ? ' mobile-sonos-muted' : ''}`}
        onClick={() => {
          setIsMuted(!isMuted);
          isMuted ? onUnmute() : onMute();
        }}
        disabled={busy}
        aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={vol}
        className="mobile-sonos-volume-slider"
        onChange={(e) => setVol(Number(e.target.value))}
        onTouchEnd={() => onSetVolume(vol)}
        onMouseUp={() => onSetVolume(vol)}
      />
      <span className="mobile-sonos-vol-label">{vol}%</span>
    </div>
  );
}

export default memo(MobileSonosVolume);
