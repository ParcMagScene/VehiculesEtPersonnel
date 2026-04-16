// ═══════════════════════════════════════════════════════════════
// TVPreviewPanel — Volet droit avec deux moniteurs
// « Direct » (diffusion en cours) + « Preview » (après validation)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Eye, RefreshCw, Radio, Bell } from 'lucide-react';
import api from '../../utils/api';
import TVScreenMini from './TVScreenMini';

import { Button } from '@/design-system';
function TVPreviewPanel({ previewOverrides = {}, refreshKey, style }) {
  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alarmSending, setAlarmSending] = useState(false);

  const fetchLiveState = useCallback(async () => {
    try {
      const data = await api.getDisplayTVState();
      setLiveState(data);
    } catch {
      // Silent — preview non critique
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTestAlarm = useCallback(async () => {
    setAlarmSending(true);
    try {
      await api.triggerTVAlarmTest();
    } catch (err) {
      console.error('Erreur test alarme:', err);
    } finally {
      setTimeout(() => setAlarmSending(false), 2000);
    }
  }, []);

  // Chargement initial + polling toutes les 15s
  useEffect(() => {
    fetchLiveState();
    const timer = setInterval(fetchLiveState, 15000);
    return () => clearInterval(timer);
  }, [fetchLiveState, refreshKey]);

  // Fusion état sauvé + overrides du formulaire pour l'aperçu brouillon
  const draftState = useMemo(() => {
    if (!liveState) return null;
    return {
      ...liveState,
      config: { ...(liveState.config || {}), ...(previewOverrides.config || {}) },
      welcomeMessage:
        previewOverrides.welcomeMessage !== undefined
          ? previewOverrides.welcomeMessage
          : liveState.welcomeMessage,
      colorRules:
        previewOverrides.colorRules !== undefined
          ? previewOverrides.colorRules
          : liveState.colorRules,
      iconRules:
        previewOverrides.iconRules !== undefined ? previewOverrides.iconRules : liveState.iconRules,
      logoUrl:
        previewOverrides.logoUrl !== undefined ? previewOverrides.logoUrl : liveState.logoUrl,
    };
  }, [liveState, previewOverrides]);

  if (loading && !liveState) {
    return (
      <div className="tv-preview-panel" style={style}>
        <div className="tv-preview-loading">Chargement aperçu…</div>
      </div>
    );
  }

  return (
    <div className="tv-preview-panel" style={style}>
      {/* ─── Direct (diffusion en cours) ─── */}
      <div className="tv-preview-zone live">
        <div className="tv-preview-label">
          <Radio size={12} />
          <span>Direct</span>
          <Button
            variant="ghost"
            className="tv-preview-refresh"
            onClick={fetchLiveState}
            title="Rafraîchir"
          >
            <RefreshCw size={10} />
          </Button>
          <Button
            variant="ghost"
            className={`tv-preview-alarm-test${alarmSending ? ' sending' : ''}`}
            onClick={handleTestAlarm}
            title="Tester le signal sonore sur l'écran distant"
            disabled={alarmSending}
          >
            <Bell size={10} />
            <span>{alarmSending ? 'Envoyé !' : 'Test son'}</span>
          </Button>
        </div>
        <div className="tv-preview-frame">
          {liveState ? (
            <TVScreenMini state={liveState} />
          ) : (
            <div className="tv-preview-empty">Aucune donnée</div>
          )}
        </div>
      </div>

      {/* ─── Preview (après validation des changements) ─── */}
      <div className="tv-preview-zone draft">
        <div className="tv-preview-label">
          <Eye size={12} />
          <span>Preview</span>
        </div>
        <div className="tv-preview-frame">
          {draftState ? (
            <TVScreenMini state={draftState} />
          ) : (
            <div className="tv-preview-empty">Modifiez la configuration pour prévisualiser</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TVPreviewPanel);
