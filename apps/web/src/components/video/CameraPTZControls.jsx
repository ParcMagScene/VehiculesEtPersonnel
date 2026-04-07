// ═══════════════════════════════════════════════════════════════
// CameraPTZControls.jsx — Contrôle PTZ (Pan/Tilt/Zoom)
// ═══════════════════════════════════════════════════════════════

import { usePTZ } from '../../hooks/usePTZ';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button, Tooltip } from '@/design-system';

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
        <Tooltip content="Haut">
          <Button variant="ghost" className="ptz-controls__btn ptz-controls__btn--up" {...makeHandlers('up')}>
            <ChevronUp size={20} />
          </Button>
        </Tooltip>
        <div className="ptz-controls__row">
          <Tooltip content="Gauche">
            <Button variant="ghost" className="ptz-controls__btn ptz-controls__btn--left" {...makeHandlers('left')}>
              <ChevronLeft size={20} />
            </Button>
          </Tooltip>
          <div className="ptz-controls__center" />
          <Tooltip content="Droite">
            <Button variant="ghost" className="ptz-controls__btn ptz-controls__btn--right" {...makeHandlers('right')}>
              <ChevronRight size={20} />
            </Button>
          </Tooltip>
        </div>
        <Tooltip content="Bas">
          <Button variant="ghost" className="ptz-controls__btn ptz-controls__btn--down" {...makeHandlers('down')}>
            <ChevronDown size={20} />
          </Button>
        </Tooltip>
      </div>
      <div className="ptz-controls__zoom">
        <Tooltip content="Zoom +">
          <Button variant="ghost" className="ptz-controls__btn" {...makeHandlers('zoomin')}>
            <ZoomIn size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="Zoom −">
          <Button variant="ghost" className="ptz-controls__btn" {...makeHandlers('zoomout')}>
            <ZoomOut size={18} />
          </Button>
        </Tooltip>
      </div>
      {moving && <div className="ptz-controls__indicator">PTZ actif</div>}
    </div>
  );
};

export default CameraPTZControls;
