// ═══════════════════════════════════════════════════════════════
// SonosQueue — File de lecture actuelle (colonne centrale)
// ═══════════════════════════════════════════════════════════════

import { ListMusic, Music } from 'lucide-react';
import { memo } from 'react';

function SonosQueue({ queue, queueLoading, nowPlaying }) {
  const currentTitle = nowPlaying?.title;

  return (
    <div className="sonos-queue">
      <div className="sonos-queue-head">
        <ListMusic size={15} />
        <span className="sonos-queue-title">File de lecture</span>
        {queue.length > 0 && <span className="sonos-queue-count">{queue.length}</span>}
      </div>

      <div className="sonos-queue-list">
        {queueLoading && queue.length === 0 ? (
          <div className="sonos-queue-empty">Chargement…</div>
        ) : queue.length === 0 ? (
          <div className="sonos-queue-empty">File de lecture vide</div>
        ) : (
          queue.map((item, i) => (
            <div
              key={i}
              className={`sonos-queue-item${currentTitle === item.title ? ' sonos-queue-active' : ''}`}
            >
              <span className="sonos-queue-num">{i + 1}</span>
              {item.albumArtURI ? (
                <img src={item.albumArtURI} alt="" className="sonos-queue-art" loading="lazy" />
              ) : (
                <span className="sonos-queue-art sonos-queue-art-ph">
                  <Music size={14} />
                </span>
              )}
              <div className="sonos-queue-meta">
                <span className="sonos-queue-name">{item.title || 'Sans titre'}</span>
                {item.artist && <span className="sonos-queue-artist">{item.artist}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(SonosQueue);
