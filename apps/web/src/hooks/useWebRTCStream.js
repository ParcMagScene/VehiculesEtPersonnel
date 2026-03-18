// Hook — Flux WebRTC pour une caméra
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
      // 1. Obtenir l'offre SDP du serveur (via MediaMTX proxy)
      const offer = await api.getWebRTCOffer(camera.id);
      if (!offer?.sdp) {
        throw new Error('Proxy vidéo indisponible');
      }
      sessionTokenRef.current = offer.sessionToken;

      // 2. Créer la connexion WebRTC
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

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

      // 3. Négociation SDP WHEP (WebRTC HTTP Egress Protocol)
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });

      // Ajouter un transceiver en réception
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

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
        // Timeout fallback
        setTimeout(resolve, 3000);
      });

      // 4. Envoyer la réponse SDP
      await api.sendWebRTCAnswer(camera.id, pc.localDescription.sdp, offer.sessionToken);
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
