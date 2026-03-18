// ═══════════════════════════════════════════════════════════════
// CameraPTZControls.jsx — Contrôle PTZ (Pan/Tilt/Zoom)
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { usePTZ } from '../../hooks/usePTZ';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

const CameraPTZControls = ({ camera }) => {
  const { moving, startMove, stopMove } = usePTZ(camera);

  if (!camera?.ptzSupported) return null;

  const makeHandlers = (cmd) => ({
    onPointerDown: () => startMove(cmd),
    onPointerUp: stopMove,
    onPointerLeave: stopMove,
  });

  return (
    <div className="ptz-controls">
      <div className="ptz-controls__dpad">
        <button className="ptz-controls__btn ptz-controls__btn--up" {...makeHandlers('up')} title="Haut">
          <ChevronUp size={20} />
        </button>
        <div className="ptz-controls__row">
          <button className="ptz-controls__btn ptz-controls__btn--left" {...makeHandlers('left')} title="Gauche">
            <ChevronLeft size={20} />
          </button>
          <div className="ptz-controls__center" />
          <button className="ptz-controls__btn ptz-controls__btn--right" {...makeHandlers('right')} title="Droite">
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="ptz-controls__btn ptz-controls__btn--down" {...makeHandlers('down')} title="Bas">
          <ChevronDown size={20} />
        </button>
      </div>
      <div className="ptz-controls__zoom">
        <button className="ptz-controls__btn" {...makeHandlers('zoomin')} title="Zoom +">
          <ZoomIn size={18} />
        </button>
        <button className="ptz-controls__btn" {...makeHandlers('zoomout')} title="Zoom −">
          <ZoomOut size={18} />
        </button>
      </div>
      {moving && <div className="ptz-controls__indicator">PTZ actif</div>}
    </div>
  );
};

export default CameraPTZControls;
