// Hook — Flux WebRTC pour une caméra (WHEP : client envoie l'offre, serveur répond)
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

export function useWebRTCStream(camera) {
  const [status, setStatus] = useState('idle'); // idle | connecting | streaming | error
  const [error, setError] = useState(null);
  const pcRef = useRef(null);
  const videoRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const connect = useCallback(async () => {
    if (!camera?.id || !camera.enabled) return;

    setStatus('connecting');
    setError(null);

    try {
      // 0. Vérifier que le proxy vidéo (MediaMTX) est en ligne avant toute négociation
      const proxyStatus = await api.getVideoProxyStatus().catch(() => null);
      if (!proxyStatus?.running) {
        setStatus('error');
        setError('Proxy vidéo (MediaMTX) hors-ligne');
        return;
      }

      // 1. Créer la connexion WebRTC et générer l'offre SDP
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Transceivers en réception seulement
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Track distant → élément vidéo
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams?.[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStatus('streaming');
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setStatus('error');
          setError('Connexion perdue');
        }
      };

      // Créer l'offre SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Attendre fin ICE gathering
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(resolve, 3000);
      });

      // 2. Envoyer l'offre au backend, qui la transmet à MediaMTX WHEP
      const result = await api.whepNegotiate(camera.id, pc.localDescription.sdp);
      if (!result?.answerSdp) {
        throw new Error('Proxy vidéo indisponible');
      }
      sessionTokenRef.current = result.sessionToken;

      // 3. Appliquer la réponse SDP
      await pc.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Erreur de connexion WebRTC');
    }
  }, [camera?.id, camera?.enabled]);

  const disconnect = useCallback(async () => {
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
    return () => { disconnect(); };
  }, [disconnect]);

  return { videoRef, status, error, connect, disconnect };
}
