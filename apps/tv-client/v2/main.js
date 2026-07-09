/**
 * TV-client v2 — Client vanilla JS (T-P0-16).
 *
 * Sequence :
 *   1. GET /api/v2/display/protocol         — discovery + capabilities.
 *   2. GET /api/v2/display/config?screen_id — bootstrap ecran + playlist + appearance.
 *   3. GET /api/v2/display/content?playlist_id — items ordonnes.
 *   4. EventSource /api/v2/display/signals/stream?screen_id — SSE push
 *      des snapshots (messages actifs + welcome message).
 *
 * Le client identifie l'ecran via `?screen_id=<id>` dans l'URL, ou 1
 * par defaut si absent. Le TV-token (X-TV-Token) est utilise pour les
 * endpoints /config et /content si present dans l'URL ou localStorage.
 *
 * Ce client N'ecrit RIEN cote backend ni cote localStorage a part le
 * TV-token. Aucune degradation ne casse l'affichage : les erreurs
 * reseau sont affichees dans la banniere rouge et le client tente une
 * reconnexion SSE apres 3s.
 */

(function tvClientV2() {
  const API_BASE = window.location.origin;
  const params = new URLSearchParams(window.location.search);
  const SCREEN_ID = params.get('screen_id') || '1';

  // ─── TV-Token (compat avec le client v1) ─────────────────────
  const TV_TOKEN = (() => {
    const urlToken = params.get('token');
    if (urlToken) {
      try {
        localStorage.setItem('tv-token', urlToken);
      } catch {
        /* private mode */
      }
      return urlToken;
    }
    try {
      return localStorage.getItem('tv-token') || '';
    } catch {
      return '';
    }
  })();

  /** Fetch v2 avec X-TV-Token. */
  function apiFetch(path) {
    const headers = { Accept: 'application/json' };
    if (TV_TOKEN) headers['X-TV-Token'] = TV_TOKEN;
    return fetch(`${API_BASE}${path}`, { credentials: 'include', headers });
  }

  /** Extrait le payload data.data d'une reponse v2 { success, data, meta }. */
  async function unwrapV2(res) {
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new Error(body?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = body?.code || 'HTTP_ERROR';
      err.meta = body?.meta;
      throw err;
    }
    const body = await res.json();
    if (body?.success === false) {
      const err = new Error(body.error || 'Erreur inconnue');
      err.status = res.status;
      err.code = body.code || 'API_ERROR';
      throw err;
    }
    return body.data;
  }

  // ─── UI helpers ──────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const errorBanner = $('tvv2-error');
  const statusEl = $('tvv2-status');
  const statusLabel = statusEl.querySelector('.label');
  const protoEl = $('tvv2-proto');
  const screenNameEl = $('tvv2-screen-name');
  const welcomeEl = $('tvv2-welcome');
  const messagesEl = $('tvv2-messages');
  const playlistEl = $('tvv2-playlist');
  const lastSnapshotEl = $('tvv2-last-snapshot');

  function setStatus(state, label) {
    statusEl.classList.remove('connected', 'error');
    if (state === 'connected') statusEl.classList.add('connected');
    if (state === 'error') statusEl.classList.add('error');
    statusLabel.textContent = label;
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.add('visible');
  }

  function hideError() {
    errorBanner.classList.remove('visible');
    errorBanner.textContent = '';
  }

  function applyAppearance(appearance) {
    if (!appearance) return;
    const root = document.documentElement.style;
    if (appearance.primaryColor) root.setProperty('--tvv2-accent', appearance.primaryColor);
    if (appearance.secondaryColor) root.setProperty('--tvv2-bg', appearance.secondaryColor);
    if (appearance.eventTextColor) root.setProperty('--tvv2-fg', appearance.eventTextColor);
    if (appearance.fontFamily) root.setProperty('--tvv2-font', appearance.fontFamily);
  }

  function renderPlaylist(content) {
    if (!content || !content.items || content.items.length === 0) {
      playlistEl.innerHTML = '<em>Aucun item dans la playlist</em>';
      return;
    }
    const rows = content.items
      .map((it) => {
        const dur = it.duration ? `${it.duration}s` : '—';
        const typeBadge = it.item_type || '—';
        const name = it.item_name || `#${it.item_id}`;
        return `
          <div class="tvv2-msg">
            <div class="title">${escapeHtml(name)}</div>
            <div class="body">${escapeHtml(typeBadge)} · ${dur}</div>
          </div>`;
      })
      .join('');
    playlistEl.innerHTML = rows;
  }

  function renderSignals(snapshot) {
    if (!snapshot) return;
    welcomeEl.textContent = snapshot.welcome_message ? snapshot.welcome_message.message : '';
    const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
    if (messages.length === 0) {
      messagesEl.innerHTML = '<em>Aucun message actif</em>';
    } else {
      messagesEl.innerHTML = messages
        .map((m) => {
          const cls = ['low', 'normal', 'high', 'urgent'].includes(m.priority) ? m.priority : 'normal';
          return `
            <div class="tvv2-msg ${cls}">
              <div class="title">${escapeHtml(m.title || 'Sans titre')}</div>
              ${m.body ? `<div class="body">${escapeHtml(m.body)}</div>` : ''}
            </div>`;
        })
        .join('');
    }
    lastSnapshotEl.textContent = `Snapshot: ${snapshot.generated_at || new Date().toISOString()}`;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  // ─── Boot ────────────────────────────────────────────────────
  async function boot() {
    hideError();
    setStatus('pending', 'Discovery du protocole…');

    let protocol;
    try {
      protocol = await unwrapV2(await apiFetch('/api/v2/display/protocol'));
    } catch (err) {
      if (err.status === 404 && err.code === 'FEATURE_DISABLED') {
        showError(
          "Le protocole v2 (FEATURE_V2_DISPLAY) est desactive cote serveur. Repli sur le client v1 : /tv-client/index.html",
        );
      } else {
        showError(`Impossible de decouvrir le protocole v2 : ${err.message}`);
      }
      setStatus('error', 'Discovery echouee');
      return;
    }

    protoEl.textContent = `Protocol ${protocol.protocol_version} · caps: ${protocol.capabilities.length}`;
    const caps = new Set(protocol.capabilities);

    setStatus('pending', "Chargement config ecran…");
    let config;
    try {
      config = await unwrapV2(await apiFetch(`/api/v2/display/config?screen_id=${encodeURIComponent(SCREEN_ID)}`));
    } catch (err) {
      showError(`Config ecran (${SCREEN_ID}) : ${err.message}`);
      setStatus('error', 'Config echouee');
      return;
    }

    screenNameEl.textContent = config.screen?.name || `Ecran ${SCREEN_ID}`;
    applyAppearance(config.appearance);

    if (config.playlist && caps.has('playlist-content-v1')) {
      setStatus('pending', 'Chargement playlist…');
      try {
        const content = await unwrapV2(
          await apiFetch(`/api/v2/display/content?playlist_id=${encodeURIComponent(config.playlist.id)}`),
        );
        renderPlaylist(content);
      } catch (err) {
        playlistEl.innerHTML = `<em>Erreur playlist : ${escapeHtml(err.message)}</em>`;
      }
    } else {
      playlistEl.innerHTML = '<em>Aucune playlist affectee a cet ecran</em>';
    }

    // ─── Signaux : SSE si dispo, sinon polling ─────────────────
    if (caps.has('screen-signals-stream-v1')) {
      openSseSignals(SCREEN_ID);
    } else if (caps.has('screen-signals-v1')) {
      openPollingSignals(SCREEN_ID);
    } else {
      showError('Aucune capability de signaux disponible (v1/v2)');
      setStatus('error', 'Sans signaux');
    }
  }

  function openSseSignals(screenId) {
    setStatus('pending', 'Connexion SSE…');
    const es = new EventSource(`/api/v2/display/signals/stream?screen_id=${encodeURIComponent(screenId)}`);
    es.addEventListener('snapshot', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        renderSignals(data);
        setStatus('connected', 'Flux temps-reel actif');
        hideError();
      } catch (parseErr) {
        console.warn('SSE snapshot parse error', parseErr);
      }
    });
    es.addEventListener('ping', () => {
      /* keep-alive noop, UI reste connected */
    });
    es.onerror = () => {
      setStatus('error', 'SSE deconnecte — reconnexion…');
      showError('Connexion SSE interrompue. Nouvelle tentative dans 3s.');
      es.close();
      setTimeout(() => openSseSignals(screenId), 3000);
    };
  }

  function openPollingSignals(screenId) {
    setStatus('pending', 'Polling signaux…');
    async function tick() {
      try {
        const snap = await unwrapV2(
          await apiFetch(`/api/v2/display/signals?screen_id=${encodeURIComponent(screenId)}`),
        );
        renderSignals(snap);
        setStatus('connected', 'Polling actif (10s)');
        hideError();
      } catch (err) {
        setStatus('error', 'Polling echoue');
        showError(`Erreur polling signaux : ${err.message}`);
      }
    }
    tick();
    setInterval(tick, 10_000);
  }

  boot();
})();
