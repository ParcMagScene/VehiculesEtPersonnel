// Hook — Contrôle PTZ d'une caméra
import { useState, useCallback, useRef } from 'react';
import api from '../utils/api';

export function usePTZ(camera) {
  const [moving, setMoving] = useState(false);
  const stopTimer = useRef(null);

  const sendCommand = useCallback(async (command, speed = 1) => {
    if (!camera?.id || !camera.ptzSupported) return;
    try {
      setMoving(command !== 'stop');
      await api.sendPTZCommand(camera.id, command, speed);
    } catch (e) {
      console.error('PTZ error:', e);
    }
  }, [camera?.id, camera?.ptzSupported]);

  // Envoyer la commande pendant le press, stopper au release
  const startMove = useCallback((command, speed = 1) => {
    sendCommand(command, speed);
    // Auto-stop après 5s de sécurité
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => sendCommand('stop'), 5000);
  }, [sendCommand]);

  const stopMove = useCallback(() => {
    clearTimeout(stopTimer.current);
    sendCommand('stop');
  }, [sendCommand]);

  return { moving, sendCommand, startMove, stopMove };
}
