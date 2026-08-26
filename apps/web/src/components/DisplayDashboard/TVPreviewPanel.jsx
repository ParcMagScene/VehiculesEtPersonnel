// ═══════════════════════════════════════════════════════════════
// TVPreviewPanel — Volet droit avec deux moniteurs
// « Direct » (diffusion en cours) + « Preview » (après validation)
// ═══════════════════════════════════════════════════════════════

import { Bell, Eye, Radio, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/design-system';

import api from '../../utils/api';
function TVPreviewPanel({ previewOverrides = {}, refreshKey, style }) {
  const iframeRef = useRef(null);
  const previewIframeRef = useRef(null);
  const [_adminState, setAdminState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alarmSending, setAlarmSending] = useState(false);

  const fetchAdminState = useCallback(async () => {
    try {
      const data = await api.getDisplayTVState();
      setAdminState(data);
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

  const reloadIframe = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.location.reload();
    }
    if (previewIframeRef.current?.contentWindow) {
      previewIframeRef.current.contentWindow.location.reload();
    }
  }, []);

  // Chargement initial + polling toutes les 15s (état admin pour Preview)
  useEffect(() => {
    fetchAdminState();
    const timer = setInterval(fetchAdminState, 15000);
    return () => clearInterval(timer);
  }, [fetchAdminState, refreshKey]);

  // Envoie les overrides du formulaire a l'iframe Preview via postMessage
  // pour qu'elle rende le meme layout que Direct mais avec les modifs en cours.
  useEffect(() => {
    const target = previewIframeRef.current?.contentWindow;
    if (!target) return;
    // Petit delai pour laisser l'iframe se charger a froid.
    const send = () => {
      target.postMessage({ type: 'tv-preview:overrides', overrides: previewOverrides || {} }, '*');
    };
    send();
    // Rebouclage court : si l'iframe n'etait pas prete, redemander apres 500ms.
    const t = setTimeout(send, 500);
    return () => clearTimeout(t);
  }, [previewOverrides, refreshKey]);

  if (loading) {
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
            onClick={reloadIframe}
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
          <iframe
            ref={iframeRef}
            src="/tv-client/index.html?tvScale=1"
            className="tv-preview-iframe"
            title="Dashboard TV — Direct"
          />
        </div>
      </div>

      {/* ─── Preview (apres validation des changements) ─── */}
      <div className="tv-preview-zone draft">
        <div className="tv-preview-label">
          <Eye size={12} />
          <span>Preview</span>
        </div>
        <div className="tv-preview-frame">
          <iframe
            ref={previewIframeRef}
            src="/tv-client/index.html?tvScale=1&preview=1"
            className="tv-preview-iframe"
            title="Dashboard TV — Preview (brouillon)"
          />
        </div>
      </div>
    </div>
  );
}

export default memo(TVPreviewPanel);
