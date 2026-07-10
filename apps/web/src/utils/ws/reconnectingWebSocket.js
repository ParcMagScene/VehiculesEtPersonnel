// apps/web/src/utils/ws/reconnectingWebSocket.js
//
// Ticket : T-P1-02 (WebSocket core — client avec reconnexion exponentielle).
//
// Client WebSocket minimaliste tolerant les deconnexions reseau. Fait
// une reconnexion exponentielle (delai plafonne) et gere un jitter
// pour eviter le tempete de reconnexion cote serveur en cas de crash
// synchronise.
//
// Contrat :
//   - `new ReconnectingWebSocket(url, options?)` : cree l'instance,
//     ouvre immediatement la connexion.
//   - `.on(event, cb)` : `open`, `message`, `close`, `error`,
//     `reconnect` (delay dans le detail).
//   - `.off(event, cb)`
//   - `.send(data)` : envoi safe (queue si pas ouvert, drop apres
//     `maxQueueSize` messages).
//   - `.close()` : fermeture volontaire, plus aucune reconnexion.
//
// Pas de dependance externe. Fonctionne en Node (jsdom) et
// dans le navigateur (WebSocket global). Ne fait AUCUN parsing du
// payload (`data` reste brute — string ou ArrayBuffer selon le
// mode). C'est a l'appelant de parser.

const DEFAULT_OPTIONS = Object.freeze({
  /** Delai initial de reconnexion (ms). */
  initialRetryMs: 500,
  /** Delai max de reconnexion (ms). */
  maxRetryMs: 30_000,
  /** Facteur multiplicatif du backoff exponentiel. */
  backoffFactor: 2,
  /** Fraction (0..1) de jitter aleatoire applique au delai. */
  jitterRatio: 0.2,
  /** Taille max de la queue avant drop. */
  maxQueueSize: 100,
  /** Nombre max de tentatives (Infinity par defaut). */
  maxAttempts: Infinity,
  /**
   * Fonction pour recuperer le WebSocket constructor (utile pour
   * injecter un mock dans les tests). Par defaut : `globalThis.WebSocket`.
   */
  webSocketFactory: () => globalThis.WebSocket,
});

/**
 * Applique un jitter aleatoire symetrique au delai.
 * @param {number} baseMs
 * @param {number} ratio 0..1
 * @returns {number}
 */
export function applyJitter(baseMs, ratio) {
  if (!Number.isFinite(baseMs) || baseMs <= 0) return 0;
  const bounded = Math.max(0, Math.min(1, ratio));
  const amplitude = baseMs * bounded;
  const offset = (Math.random() * 2 - 1) * amplitude;
  return Math.max(0, Math.round(baseMs + offset));
}

/**
 * Calcule le delai de la n-ieme tentative de reconnexion.
 * @param {object} opts
 * @param {number} opts.attempt Numero de tentative (1-based).
 * @param {number} opts.initialRetryMs
 * @param {number} opts.maxRetryMs
 * @param {number} opts.backoffFactor
 * @param {number} opts.jitterRatio
 * @returns {number}
 */
export function computeBackoffDelay({
  attempt,
  initialRetryMs,
  maxRetryMs,
  backoffFactor,
  jitterRatio,
}) {
  const raw = initialRetryMs * backoffFactor ** Math.max(0, attempt - 1);
  const capped = Math.min(raw, maxRetryMs);
  return applyJitter(capped, jitterRatio);
}

export class ReconnectingWebSocket {
  /**
   * @param {string} url
   * @param {Partial<typeof DEFAULT_OPTIONS>} [options]
   */
  constructor(url, options = {}) {
    if (typeof url !== 'string' || url.length === 0) {
      throw new TypeError('ReconnectingWebSocket: url string non vide requis');
    }
    this.url = url;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.listeners = new Map(); // event -> Set<cb>
    this.queue = [];
    this.attempt = 0;
    this.closedByUser = false;
    this.ws = null;
    this._reconnectTimer = null;
    this._connect();
  }

  _emit(event, detail) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(detail);
      } catch (err) {
        // ne pas laisser un listener casser les autres
        // eslint-disable-next-line no-console
        console.error('[ReconnectingWebSocket] listener error', err);
      }
    }
  }

  /**
   * @param {'open'|'message'|'close'|'error'|'reconnect'} event
   * @param {(detail: unknown) => void} cb
   */
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
  }

  /**
   * @param {string} event
   * @param {Function} cb
   */
  off(event, cb) {
    this.listeners.get(event)?.delete(cb);
  }

  /**
   * Envoi safe. Si le socket n'est pas ouvert, met en queue (bornee).
   * @param {string|ArrayBuffer|Blob} data
   */
  send(data) {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(data);
      return;
    }
    if (this.queue.length >= this.options.maxQueueSize) {
      this.queue.shift(); // drop plus ancien
    }
    this.queue.push(data);
  }

  /**
   * Ferme volontairement le socket. Aucune reconnexion apres appel.
   * @param {number} [code]
   * @param {string} [reason]
   */
  close(code, reason) {
    this.closedByUser = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(code, reason);
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  _flushQueue() {
    while (this.queue.length > 0 && this.ws && this.ws.readyState === 1) {
      const next = this.queue.shift();
      try {
        this.ws.send(next);
      } catch {
        // remet en tete et arrete pour retenter au prochain flush
        this.queue.unshift(next);
        break;
      }
    }
  }

  _scheduleReconnect() {
    if (this.closedByUser) return;
    if (this.attempt >= this.options.maxAttempts) return;
    this.attempt += 1;
    const delay = computeBackoffDelay({
      attempt: this.attempt,
      initialRetryMs: this.options.initialRetryMs,
      maxRetryMs: this.options.maxRetryMs,
      backoffFactor: this.options.backoffFactor,
      jitterRatio: this.options.jitterRatio,
    });
    this._emit('reconnect', { attempt: this.attempt, delay });
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, delay);
  }

  _connect() {
    const WS = this.options.webSocketFactory();
    if (typeof WS !== 'function') {
      this._emit('error', new Error('WebSocket global manquant'));
      return;
    }
    try {
      this.ws = new WS(this.url);
    } catch (err) {
      this._emit('error', err);
      this._scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.attempt = 0;
      this._emit('open', null);
      this._flushQueue();
    };
    this.ws.onmessage = (event) => {
      this._emit('message', event);
    };
    this.ws.onerror = (err) => {
      this._emit('error', err);
    };
    this.ws.onclose = (event) => {
      this._emit('close', event);
      if (!this.closedByUser) this._scheduleReconnect();
    };
  }
}
