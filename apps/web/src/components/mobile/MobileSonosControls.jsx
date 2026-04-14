// ═══════════════════════════════════════════════════════════════
// MobileSonosControls — Transport tactile + seek bar
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, memo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { formatTime } from '../../hooks/useSonos';

function MobileSonosControls({
  state, position, duration, shuffleActive, repeatMode,
  onPlay, onPause, onNext, onPrevious, onSeek, onShuffle, onRepeat,
  busy, isAdmin,
}) {
  const [seekPos, setSeekPos] = useState(position ?? 0);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => { if (!isSeeking && position != null) setSeekPos(position); }, [position, isSeeking]);

  const nextRepeatMode = () => {
    const modes = ['none', 'all', 'one'];
    const current = modes.indexOf(repeatMode || 'none');
    return modes[(current + 1) % 3];
  };

  if (!isAdmin) return null;

  return (
    <>
      {/* Barre de progression / seek */}
      {duration > 0 && (
        <div className="mobile-sonos-progress">
          <span className="mobile-sonos-progress-time">{formatTime(seekPos)}</span>
          <input
            type="range" min={0} max={duration} value={seekPos}
            className="mobile-sonos-seek"
            onChange={e => { setIsSeeking(true); setSeekPos(Number(e.target.value)); }}
            onTouchEnd={() => { setIsSeeking(false); onSeek(seekPos); }}
            onMouseUp={() => { setIsSeeking(false); onSeek(seekPos); }}
          />
          <span className="mobile-sonos-progress-time">{formatTime(duration)}</span>
        </div>
      )}

      {/* Transport */}
      <div className="mobile-sonos-transport">
        <button
          className={`mobile-sonos-transport-btn mobile-sonos-transport-sm${shuffleActive ? ' mobile-sonos-active' : ''}`}
          onClick={() => onShuffle(!shuffleActive)}
          disabled={busy} aria-label="Aléatoire"
        >
          <Shuffle size={16} />
        </button>
        <button className="mobile-sonos-transport-btn" onClick={onPrevious} disabled={busy} aria-label="Précédent">
          <SkipBack size={22} />
        </button>
        {state === 'playing' ? (
          <button className="mobile-sonos-transport-btn mobile-sonos-transport-main" onClick={onPause} disabled={busy} aria-label="Pause">
            <Pause size={28} />
          </button>
        ) : (
          <button className="mobile-sonos-transport-btn mobile-sonos-transport-main" onClick={onPlay} disabled={busy} aria-label="Lecture">
            <Play size={28} />
          </button>
        )}
        <button className="mobile-sonos-transport-btn" onClick={onNext} disabled={busy} aria-label="Suivant">
          <SkipForward size={22} />
        </button>
        <button
          className={`mobile-sonos-transport-btn mobile-sonos-transport-sm${repeatMode && repeatMode !== 'none' ? ' mobile-sonos-active' : ''}`}
          onClick={() => onRepeat(nextRepeatMode())}
          disabled={busy} aria-label={`Répétition : ${repeatMode || 'off'}`}
        >
          {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
        </button>
      </div>
    </>
  );
}

export default memo(MobileSonosControls);
