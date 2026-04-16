// ═══════════════════════════════════════════════════════════════
// SonosZoneSelector — Liste de zones compacte (style Sonos)
// ═══════════════════════════════════════════════════════════════

import { ChevronDown, ChevronUp, Speaker } from 'lucide-react';
import { memo } from 'react';

function SonosZoneSelector({ zones, activeZone, onZoneSelect, zonesOpen, setZonesOpen }) {
  if (!zones.length) return null;

  return (
    <div className="sonos-zones">
      <button
        className="sonos-zones-toggle"
        onClick={() => setZonesOpen((o) => !o)}
        aria-expanded={zonesOpen}
      >
        <Speaker size={14} />
        <span className="sonos-zones-label">
          Système
          <span className="sonos-zones-count">{zones.length}</span>
        </span>
        {zonesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {zonesOpen && (
        <div className="sonos-zones-list">
          {zones.map((z, i) => (
            <button
              key={i}
              className={`sonos-zones-item${activeZone === z.coordinator ? ' sonos-zones-active' : ''}`}
              onClick={() => onZoneSelect(z.coordinator)}
            >
              <Speaker size={13} />
              <span className="sonos-zones-name">{z.name}</span>
              {z.members?.length > 1 && (
                <span className="sonos-zones-members">+{z.members.length - 1}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(SonosZoneSelector);
