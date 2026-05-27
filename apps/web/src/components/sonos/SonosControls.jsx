// ═══════════════════════════════════════════════════════════════
// SonosControls — Transport centré (style Sonos desktop)
// Prev | Play/Pause | Next  +  Shuffle / Repeat en secondary
// ═══════════════════════════════════════════════════════════════

import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { Input } from '@/design-system';

import { formatTime } from '../../hooks/useSonos';

function SonosControls({
  state,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  shuffleActive,
  repeatMode,
  onShuffle,
  onRepeat,
  busy,
}) {
  const nextRepeatMode = () => {
    const modes = ['none', 'all', 'one'];
    const current = modes.indexOf(repeatMode || 'none');
    return modes[(current + 1) % 3];
  };

  return (
    <div className="sonos-transport">
      <button
        type="button"
        className={`sonos-tbtn sonos-tbtn-sm${shuffleActive ? ' sonos-tbtn-active' : ''}`}
        onClick={() => onShuffle(!shuffleActive)}
        disabled={busy}
        title="Aléatoire"
      >
        <Shuffle size={14} />
      </button>
      <button
        type="button"
        className="sonos-tbtn"
        onClick={onPrevious}
        disabled={busy}
        title="Précédent"
      >
        <SkipBack size={18} />
      </button>
      {state === 'playing' ? (
        <button
          type="button"
          className="sonos-tbtn sonos-tbtn-main"
          onClick={onPause}
          disabled={busy}
          title="Pause"
        >
          <Pause size={22} />
        </button>
      ) : (
        <button
          type="button"
          className="sonos-tbtn sonos-tbtn-main"
          onClick={onPlay}
          disabled={busy}
          title="Lecture"
        >
          <Play size={22} />
        </button>
      )}
      <button type="button" className="sonos-tbtn" onClick={onNext} disabled={busy} title="Suivant">
        <SkipForward size={18} />
      </button>
      <button
        type="button"
        className={`sonos-tbtn sonos-tbtn-sm${repeatMode && repeatMode !== 'none' ? ' sonos-tbtn-active' : ''}`}
        onClick={() => onRepeat(nextRepeatMode())}
        disabled={busy}
        title={`Répétition : ${repeatMode || 'off'}`}
      >
        {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
      </button>
    </div>
  );
}

// ── Progress bar séparée (placée sous la topbar comme Sonos) ──
function ProgressBar({ position, duration, onSeek }) {
  const [seekPos, setSeekPos] = useState(position ?? 0);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    if (!isSeeking && position != null) setSeekPos(position);
  }, [position, isSeeking]);

  const pct = duration > 0 ? (seekPos / duration) * 100 : 0;

  return (
    <div className="sonos-progressbar">
      <span className="sonos-ptime">{formatTime(seekPos)}</span>
      <div className="sonos-ptrack">
        <div className="sonos-pfill" style={{ width: `${pct}%` }} />
        <Input
          type="range"
          min={0}
          max={duration}
          value={seekPos}
          className="sonos-pinput"
          onChange={(e) => {
            setIsSeeking(true);
            setSeekPos(Number(e.target.value));
          }}
          onMouseUp={() => {
            setIsSeeking(false);
            onSeek(seekPos);
          }}
          onTouchEnd={() => {
            setIsSeeking(false);
            onSeek(seekPos);
          }}
        />
      </div>
      <span className="sonos-ptime">{formatTime(duration)}</span>
    </div>
  );
}

const MemoSonosControls = memo(SonosControls);
MemoSonosControls.ProgressBar = memo(ProgressBar);

export default MemoSonosControls;
