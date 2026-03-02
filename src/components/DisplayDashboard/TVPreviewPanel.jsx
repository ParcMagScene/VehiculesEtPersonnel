// ═══════════════════════════════════════════════════════════════
// TVPreviewPanel — Volet droit avec deux aperçus miniatures
// du Dashboard TV (écran actuel + aperçu modifications en cours)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Monitor, Eye, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import TVScreenMini from './TVScreenMini';

function TVPreviewPanel({ previewOverrides = {}, refreshKey }) {
  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(true);

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
      welcomeMessage: previewOverrides.welcomeMessage !== undefined
        ? previewOverrides.welcomeMessage
        : liveState.welcomeMessage,
      colorRules: previewOverrides.colorRules !== undefined
        ? previewOverrides.colorRules
        : liveState.colorRules,
      iconRules: previewOverrides.iconRules !== undefined
        ? previewOverrides.iconRules
        : liveState.iconRules,
      logoUrl: previewOverrides.logoUrl !== undefined
        ? previewOverrides.logoUrl
        : liveState.logoUrl,
    };
  }, [liveState, previewOverrides]);

  if (loading && !liveState) {
    return (
      <div className="tv-preview-panel">
        <div className="tv-preview-loading">Chargement aperçu…</div>
      </div>
    );
  }

  return (
    <div className="tv-preview-panel">
      {/* ─── Écran actuel (sauvegardé) ─── */}
      <div className="tv-preview-zone">
        <div className="tv-preview-label">
          <Monitor size={12} />
          <span>Écran actuel</span>
          <button
            className="tv-preview-refresh"
            onClick={fetchLiveState}
            title="Rafraîchir"
          >
            <RefreshCw size={10} />
          </button>
        </div>
        <div className="tv-preview-frame">
          {liveState ? (
            <TVScreenMini state={liveState} />
          ) : (
            <div className="tv-preview-empty">Aucune donnée</div>
          )}
        </div>
      </div>

      {/* ─── Aperçu modifications en cours ─── */}
      <div className="tv-preview-zone draft">
        <div className="tv-preview-label">
          <Eye size={12} />
          <span>Aperçu modifications</span>
        </div>
        <div className="tv-preview-frame">
          {draftState ? (
            <TVScreenMini state={draftState} />
          ) : (
            <div className="tv-preview-empty">Modifiez les paramètres pour voir l'aperçu</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TVPreviewPanel);
