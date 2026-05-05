// Hook — Flux WebRTC pour une caméra (WHEP : client envoie l'offre, serveur répond)
import { useCallback, useEffect, useRef, useState } from 'react';

import { STATUS, TIMING } from '../constants';
import api from '../utils/api';

export function useWebRTCStream(camera) {
  const [status, setStatus] = useState('idle'); // idle | connecting | streaming | error
  const [error, setError] = useState(null);
  const pcRef = useRef(null);
  const videoRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const connectRef = useRef(null); // Ref pour éviter les closures stale
  const MAX_RECONNECT = 2;

  const doReconnect = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT) {
      setStatus('error');
      setError('Connexion perdue');
      return;
    }
    reconnectAttempts.current++;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (sessionTokenRef.current) {
      api.closeVideoSession(sessionTokenRef.current).catch(() => {});
      sessionTokenRef.current = null;
    }
    // Appeler connect via ref pour avoir la version courante
    connectRef.current?.();
  }, []);

  const connect = useCallback(async () => {
    if (!camera?.id || !camera.enabled) return;

    setStatus('connecting');
    setError(null);

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams?.[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStatus('streaming');
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected' || state === STATUS.COMPLETED) {
          reconnectAttempts.current = 0;
          clearTimeout(reconnectTimer.current);
        } else if (state === 'disconnected') {
          // Temporaire — attendre 5s avant de reconnecter
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = setTimeout(() => {
            if (pcRef.current?.iceConnectionState === 'disconnected') {
              doReconnect();
            }
          }, 5000);
        } else if (state === 'failed') {
          doReconnect();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(resolve, TIMING.STATUS_CLEAR);
      });

      const result = await api.whepNegotiate(camera.id, pc.localDescription.sdp);
      if (!result?.answerSdp) {
        throw new Error('Proxy vidéo indisponible');
      }
      sessionTokenRef.current = result.sessionToken;

      await pc.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Erreur de connexion WebRTC');
    }
  }, [camera?.id, camera?.enabled, doReconnect]);

  // Garder connect à jour dans la ref
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(async () => {
    clearTimeout(reconnectTimer.current);
    reconnectAttempts.current = 0;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (sessionTokenRef.current) {
      api.closeVideoSession(sessionTokenRef.current).catch(() => {});
      sessionTokenRef.current = null;
    }
    setStatus('idle');
    setError(null);
  }, []);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { videoRef, status, error, connect, disconnect };
}
