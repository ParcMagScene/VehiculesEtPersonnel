// ═══════════════════════════════════════════════════════════════
// PlaybackPanel.jsx — Relecture des enregistrements NVR
// ═══════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Calendar, Play, Square, Loader, Clock, Film, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { Button, Select } from '@/design-system';
import { TIMING } from '../../constants';

import './PlaybackPanel.css';

const PlaybackPanel = ({ cameras, initialCameraId }) => {
  const [selectedCameraId, setSelectedCameraId] = useState(() => initialCameraId || '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordings, setRecordings] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  const [currentSegment, setCurrentSegment] = useState(null);

  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const connectingRef = useRef(false);

  // Filtrer les caméras qui supportent le playback (NVR avec enregistrement)
  const nvrCameras = cameras.filter(c => c.enabled && c.supportsPlayback);

  // Rechercher les enregistrements
  const handleSearch = useCallback(async () => {
    if (!selectedCameraId || !date) return;
    setSearching(true);
    setSearchError(null);
    setRecordings([]);
    try {
      const result = await api.getRecordings(selectedCameraId, date);
      setRecordings(result.recordings || []);
      if ((result.recordings || []).length === 0) {
        setSearchError('Aucun enregistrement trouvé pour cette date');
      }
    } catch (e) {
      const detail = e.response?.data?.detail;
      setSearchError(detail ? `${e.message} : ${detail}` : (e.message || 'Erreur de recherche'));
    } finally {
      setSearching(false);
    }
  }, [selectedCameraId, date]);

  // Arrêter le playback en cours
  const stopPlayback = useCallback(async () => {
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
    setPlaying(false);
    setConnecting(false);
    setCurrentSegment(null);
  }, []);

  // Démarrer le playback d'un segment
  const startPlayback = useCallback(async (startTime, endTime) => {
    if (connectingRef.current) return; // Empêcher les clics multiples (ref = pas de stale closure)
    connectingRef.current = true;
    await stopPlayback();
    setConnecting(true);
    setPlaybackError(null);
    setCurrentSegment({ startTime, endTime });

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
          setPlaying(true);
          setConnecting(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'failed' || state === 'disconnected') {
          setPlaybackError('Connexion perdue');
          setPlaying(false);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Attendre ICE gathering
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

      const result = await api.startPlayback(
        selectedCameraId,
        pc.localDescription.sdp,
        startTime,
        endTime
      );

      if (!result?.answerSdp) {
        throw new Error('Flux de relecture indisponible');
      }
      sessionTokenRef.current = result.sessionToken;

      await pc.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });
    } catch (e) {
      setPlaybackError(e.message || 'Erreur de connexion');
      setConnecting(false);
      setPlaying(false);
    } finally {
      connectingRef.current = false;
    }
  }, [selectedCameraId, stopPlayback]);

  // Recherche automatique dès qu'une caméra et une date sont sélectionnées
  useEffect(() => {
    if (selectedCameraId && date) {
      handleSearch();
    }
  }, [selectedCameraId, date, handleSearch]);

  // Cleanup au démontage
  useEffect(() => {
    return () => { stopPlayback(); };
  }, [stopPlayback]);

  // Construire la timeline à partir des enregistrements
  const timelineSegments = recordings.map(r => {
    const start = parseTime(r.startTime);
    const end = parseTime(r.endTime);
    return { ...r, startMinutes: start, endMinutes: end };
  });

  return (
    <div className="playback-panel">
      {/* Contrôles de recherche */}
      <div className="playback-panel__controls">
        <div className="playback-panel__field">
          <label><Film size={14} /> Caméra</label>
          <Select
            value={selectedCameraId}
            onChange={e => setSelectedCameraId(e.target.value)}
          >
            <option value="">Sélectionner une caméra…</option>
            {nvrCameras.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="playback-panel__field">
          <label><Calendar size={14} /> Date</label>
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        {searching && <Loader size={16} className="spin" style={{ color: 'var(--accent)', marginLeft: 8 }} />}
      </div>

      {searchError && (
        <div className="playback-panel__info">
          <AlertCircle size={16} /> {searchError}
        </div>
      )}

      {/* Timeline */}
      {recordings.length > 0 && (
        <div className="playback-panel__timeline-wrap">
          <div className="playback-panel__timeline-header">
            <Clock size={14} />
            <span>{recordings.length} segment{recordings.length > 1 ? 's' : ''} trouvé{recordings.length > 1 ? 's' : ''}</span>
          </div>
          <div className="playback-panel__timeline">
            <div className="playback-panel__timeline-bar">
              {/* Marqueurs d'heures */}
              {Array.from({ length: 25 }, (_, h) => (
                <div
                  key={h}
                  className="playback-panel__timeline-tick"
                  style={{ left: `${(h / 24) * 100}%` }}
                >
                  <span>{String(h).padStart(2, '0')}h</span>
                </div>
              ))}
              {/* Segments */}
              {timelineSegments.map((seg, i) => {
                const left = (seg.startMinutes / 1440) * 100;
                const width = Math.max(((seg.endMinutes - seg.startMinutes) / 1440) * 100, 0.5);
                const isActive = currentSegment?.startTime === seg.startTime;
                return (
                  <div
                    key={i}
                    className={`playback-panel__timeline-segment ${isActive ? 'active' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={() => startPlayback(seg.startTime, seg.endTime)}
                    title={`${seg.startTime.slice(11, 16)} → ${seg.endTime.slice(11, 16)} (${formatSize(seg.size)})`}
                  />
                );
              })}
            </div>
          </div>
          {/* Liste segments cliquables */}
          <div className="playback-panel__segments">
            {recordings.map((rec, i) => {
              const isActive = currentSegment?.startTime === rec.startTime;
              return (
                <button
                  key={i}
                  className={`playback-panel__segment-btn ${isActive ? 'active' : ''}`}
                  onClick={() => startPlayback(rec.startTime, rec.endTime)}
                >
                  <Play size={12} />
                  <span>{rec.startTime.slice(11, 16)} → {rec.endTime.slice(11, 16)}</span>
                  <span className="playback-panel__segment-size">{formatSize(rec.size)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lecteur vidéo */}
      <div className="playback-panel__player">
        {!playing && !connecting && !currentSegment && (
          <div className="playback-panel__placeholder">
            <Film size={48} style={{ opacity: 0.2 }} />
            <p>Sélectionnez une date, puis cliquez sur un segment pour lancer la relecture</p>
          </div>
        )}
        {connecting && (
          <div className="playback-panel__overlay">
            <Loader size={32} className="spin" />
            <span>Connexion au flux de relecture…</span>
          </div>
        )}
        {playbackError && (
          <div className="playback-panel__overlay playback-panel__overlay--error">
            <AlertCircle size={32} />
            <span>{playbackError}</span>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="playback-panel__video"
        />
        {(playing || connecting) && (
          <div className="playback-panel__player-controls">
            <Button variant="secondary" size="sm" onClick={stopPlayback} title="Arrêter">
              <Square size={16} /> Arrêter
            </Button>
            {currentSegment && (
              <span className="playback-panel__now-playing">
                🎬 {currentSegment.startTime.slice(11, 16)} → {currentSegment.endTime.slice(11, 16)}
              </span>
            )}
          </div>
        )}
      </div>

      {nvrCameras.length === 0 && (
        <div className="playback-panel__empty">
          <AlertCircle size={32} style={{ opacity: 0.3 }} />
          <p>Aucune caméra NVR configurée pour la relecture</p>
        </div>
      )}
    </div>
  );
};

// Helpers

function parseTime(dateStr) {
  // "2026-03-25 14:30:00" → minutes depuis minuit (870)
  const match = dateStr.match(/(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} Go`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} Mo`;
  return `${(bytes / 1e3).toFixed(0)} Ko`;
}

export default PlaybackPanel;
