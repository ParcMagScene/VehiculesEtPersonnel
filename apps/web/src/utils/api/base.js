// API Client — Base class + auth methods
// Détection automatique de l'URL du backend

import { clearAllIndexedDB, loadAuthFromIDB, saveAuthToIDB } from '../indexedDB.js';

const NETWORK_BACKOFF_BASE_MS = 2000;
const NETWORK_BACKOFF_MAX_MS = 60000;
const NETWORK_NOTICE_MIN_INTERVAL_MS = 15000;

const networkStatusListeners = new Set();
const networkState = {
  unavailable: false,
  consecutiveFailures: 0,
  backoffMs: 0,
  retryAt: 0,
  outageStartedAt: null,
  lastError: '',
  lastNoticeAt: 0,
};

export function getApiNetworkStatus() {
  return {
    unavailable: networkState.unavailable,
    consecutiveFailures: networkState.consecutiveFailures,
    backoffMs: networkState.backoffMs,
    retryAt: networkState.retryAt,
    retryInMs: Math.max(0, networkState.retryAt - Date.now()),
    outageStartedAt: networkState.outageStartedAt,
    lastError: networkState.lastError,
  };
}

export function subscribeApiNetworkStatus(listener) {
  networkStatusListeners.add(listener);
  listener(getApiNetworkStatus());
  return () => networkStatusListeners.delete(listener);
}

export function isApiCoolingDown() {
  return networkState.unavailable && Date.now() < networkState.retryAt;
}

function emitNetworkStatus() {
  const snapshot = getApiNetworkStatus();
  networkStatusListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // silencieux
    }
  });
}

function markNetworkFailure(message = 'Service indisponible') {
  const now = Date.now();
  networkState.consecutiveFailures += 1;
  networkState.backoffMs = Math.min(
    NETWORK_BACKOFF_MAX_MS,
    NETWORK_BACKOFF_BASE_MS * 2 ** (networkState.consecutiveFailures - 1),
  );
  networkState.retryAt = now + networkState.backoffMs;
  networkState.lastError = message;
  if (!networkState.unavailable) {
    networkState.outageStartedAt = now;
  }
  networkState.unavailable = true;

  if (
    now - networkState.lastNoticeAt >=
    Math.max(NETWORK_NOTICE_MIN_INTERVAL_MS, networkState.backoffMs)
  ) {
    const retrySec = Math.ceil(networkState.backoffMs / 1000);
    console.warn(
      `[API] Service local indisponible (${message}). Backoff ${retrySec}s avant nouvelle tentative.`,
    );
    networkState.lastNoticeAt = now;
  }

  emitNetworkStatus();
}

function markNetworkSuccess() {
  if (!networkState.unavailable && networkState.consecutiveFailures === 0) {
    return;
  }

  const hadOutage = networkState.unavailable;
  networkState.unavailable = false;
  networkState.consecutiveFailures = 0;
  networkState.backoffMs = 0;
  networkState.retryAt = 0;
  networkState.outageStartedAt = null;
  networkState.lastError = '';
  networkState.lastNoticeAt = 0;

  if (hadOutage) {
    console.warn('[API] Service local de nouveau disponible');
  }

  emitNetworkStatus();
}

function shouldShortCircuitRequest(endpoint, options = {}) {
  if (!isApiCoolingDown()) return false;
  const method = (options.method || 'GET').toUpperCase();
  // Évite le bruit des sondes périodiques pendant la fenêtre de backoff.
  return method === 'GET' || endpoint === '/auth/refresh';
}

function createServiceUnavailableError() {
  const retryInMs = Math.max(0, networkState.retryAt - Date.now());
  const retrySec = Math.ceil(retryInMs / 1000);
  const error = new Error(
    `Service local indisponible. Nouvelle tentative automatique dans ${retrySec}s.`,
  );
  error.isNetworkError = true;
  error.isServiceUnavailable = true;
  error.retryAfterMs = retryInMs;
  return error;
}

export const getApiUrl = () => {
  const port = window.location.port;

  // En dev (Vite) ou preview (Vite preview), le proxy gère /api
  if (port === '5174' || port === '5175' || port === '4173') {
    return '/api';
  }

  // Sinon, requêtes same-origin (ex: accès direct au backend sur :3002 ou :3443)
  // Utiliser le même protocole/host/port que la page courante
  return `${window.location.origin}/api`;
};

export const API_URL = getApiUrl();

// Convertir snake_case en camelCase
export function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item));
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const camelObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = toCamelCase(obj[key]);
  }
  return camelObj;
}

// Convertir camelCase en snake_case
export function toSnakeCase(obj) {
  if (Array.isArray(obj)) {
    if (obj.every((item) => typeof item !== 'object' || item === null)) {
      return obj;
    }
    return obj.map((item) => toSnakeCase(item));
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const snakeObj = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = toSnakeCase(obj[key]);
  }
  return snakeObj;
}

export class ApiClient {
  constructor() {
    // [AUDIT Phase 3] Le token JWT est désormais dans un cookie httpOnly (inaccessible au JS)
    // On ne stocke que les infos utilisateur pour l'affichage
    this.user = JSON.parse(localStorage.getItem('auth_user') || 'null');
    this.hasAuthHint = localStorage.getItem('auth_hint') === '1';
    // Migration: nettoyer l'ancien token si présent
    localStorage.removeItem('auth_token');
    // Récupération async depuis IndexedDB si localStorage vidé
    // → _initReady est résolu quand l'auth est stabilisée (IDB recovery OU refresh silencieux)
    this._initReady = this.user ? Promise.resolve() : this._recoverAuth();
    // Mutex : une seule tentative de refresh à la fois
    this._refreshPromise = null;
  }

  /**
   * Tente de récupérer l'auth : d'abord depuis IndexedDB, puis via refresh silencieux (cookie httpOnly)
   * Résout _initReady une fois l'auth stabilisée.
   */
  async _recoverAuth() {
    // 1. Essayer IndexedDB
    try {
      const user = await loadAuthFromIDB();
      if (user && !this.user) {
        this.user = user;
        localStorage.setItem('auth_user', JSON.stringify(user));
        console.warn('[Auth] Récupération depuis IndexedDB OK');
        return;
      }
    } catch {
      /* silencieux */
    }

    // 2. Si toujours pas d'user, tenter un refresh silencieux uniquement si une session existait deja
    // (evite un 401 attendu au demarrage pour les visiteurs non connectes)
    if (!this.hasAuthHint) {
      return;
    }

    // Le cookie httpOnly peut encore etre valide
    try {
      const refreshed = await this._tryRefreshToken();
      if (refreshed) {
        console.warn('[Auth] Récupération par refresh silencieux OK');
      } else {
        console.warn('[Auth] Pas de session récupérable (cookie absent ou expiré)');
      }
    } catch {
      console.warn('[Auth] Échec de la tentative de refresh au démarrage');
    }
  }

  /**
   * Attendre que l'initialisation auth soit terminée (IDB / refresh silencieux)
   * @returns {Promise<void>}
   */
  async waitReady() {
    return this._initReady;
  }

  setAuth(user) {
    this.user = user;
    this.hasAuthHint = true;
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('auth_hint', '1');
    saveAuthToIDB(user).catch(() => {});
  }

  clearAuth() {
    console.warn('[Auth] clearAuth() appelé —', new Error().stack?.split('\n')[2]?.trim());
    this.user = null;
    this.hasAuthHint = false;
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_hint');
    localStorage.removeItem('auth_token'); // nettoyage migration
    // [AUDIT FIX MED-F4] Vider tous les stores IndexedDB (PII)
    clearAllIndexedDB().catch(() => {});
  }

  /**
   * Tente un refresh silencieux du token.
   * Mutualisé : si un refresh est déjà en cours, on attend le même résultat.
   * Inclut 1 retry avec délai si erreur réseau (ex: restart PM2).
   * @returns {Promise<boolean>} true si le refresh a réussi
   */
  async _tryRefreshToken() {
    if (isApiCoolingDown()) {
      return false;
    }

    // Si un refresh est déjà en cours, attendre son résultat
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          if (!response.ok) {
            markNetworkSuccess();
            console.warn(
              `[Auth] Refresh échoué: HTTP ${response.status} (tentative ${attempt + 1})`,
            );
            if (response.status === 401 || response.status === 403) {
              // Session non recuperable: eviter de retenter a chaque chargement
              this.hasAuthHint = false;
              localStorage.removeItem('auth_hint');
            }
            return false;
          }
          markNetworkSuccess();
          const data = await response.json();
          if (data?.user) {
            this.setAuth(data.user);
            console.warn('[Auth] Refresh réussi — session prolongée');
            return true;
          }
          console.warn('[Auth] Refresh: réponse OK mais pas de user dans la réponse');
          return false;
        } catch (err) {
          markNetworkFailure(err?.name === 'AbortError' ? 'délai dépassé' : 'erreur réseau');
          // Erreur réseau : retry 1 fois après 2s (le serveur redémarre peut-être)
          console.warn(`[Auth] Refresh erreur réseau (tentative ${attempt + 1}):`, err.message);
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          return false;
        }
      }
      return false;
    })();

    return this._refreshPromise.finally(() => {
      this._refreshPromise = null;
    });
  }

  /**
   * Gestion commune 401/403 : tente refresh silencieux avant de forcer un reload.
   * @returns {boolean} true si la requête peut être rejouée (refresh OK)
   */
  async _handle401(endpoint) {
    const isAuthEndpoint =
      endpoint === '/auth/login' ||
      endpoint === '/auth/register' ||
      endpoint === '/auth/force-login' ||
      endpoint === '/auth/refresh' ||
      endpoint === '/auth/forgot-password' ||
      endpoint === '/auth/self-reset-password' ||
      endpoint === '/auth/check-reset' ||
      endpoint === '/auth/set-new-password' ||
      endpoint === '/auth/change-password' ||
      endpoint === '/admin/reset-password' ||
      endpoint.match(/^\/users\/[^/]+\/reset-password$/);
    if (isAuthEndpoint) return false;

    console.warn(`[Auth] 401 reçu sur ${endpoint} — tentative de refresh silencieux`);
    const refreshed = await this._tryRefreshToken();
    if (refreshed) return true; // le caller doit relancer la requête

    // Refresh échoué → déconnexion définitive
    console.warn('[Auth] Refresh échoué après 401 → déconnexion forcée');
    this.clearAuth();
    window.location.reload();
    throw new Error('Session expirée');
  }

  async request(endpoint, options = {}, _isRetry = false) {
    if (shouldShortCircuitRequest(endpoint, options)) {
      throw createServiceUnavailableError();
    }

    const skipCamelCase = options.skipCamelCase;
    if (skipCamelCase) delete options.skipCamelCase;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Timeout 30s pour éviter les requêtes bloquées indéfiniment
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // [AUDIT Phase 3] Envoie le cookie httpOnly automatiquement
        signal: controller.signal,
      });
      markNetworkSuccess();
    } catch (networkError) {
      clearTimeout(timeoutId);
      markNetworkFailure(networkError?.name === 'AbortError' ? 'délai dépassé' : 'erreur réseau');
      if (networkError.name === 'AbortError') {
        const error = createServiceUnavailableError();
        error.message = 'Service local indisponible (délai dépassé)';
        error.isTimeoutError = true;
        throw error;
      }
      throw createServiceUnavailableError();
    }
    clearTimeout(timeoutId);

    const isAuthEndpoint =
      endpoint === '/auth/login' ||
      endpoint === '/auth/register' ||
      endpoint === '/auth/force-login' ||
      endpoint === '/auth/refresh' ||
      endpoint === '/auth/forgot-password' ||
      endpoint === '/auth/self-reset-password' ||
      endpoint === '/auth/check-reset' ||
      endpoint === '/auth/set-new-password' ||
      endpoint === '/auth/change-password' ||
      endpoint === '/admin/reset-password' ||
      endpoint.match(/^\/users\/[^/]+\/reset-password$/);

    // 401 : tenter refresh silencieux puis retry (une seule fois)
    if (response.status === 401 && !isAuthEndpoint && !_isRetry) {
      const canRetry = await this._handle401(endpoint);
      if (canRetry) {
        return this.request(endpoint, { ...options, skipCamelCase }, true);
      }
    }
    // 401 après retry → déconnexion
    if (response.status === 401 && !isAuthEndpoint && _isRetry) {
      this.clearAuth();
      window.location.reload();
      throw new Error('Session expirée');
    }

    if (response.status === 403 && !isAuthEndpoint) {
      const data = await response.json().catch(() => ({}));
      // Token invalide = JWT corrompu ou secret changé → forcer re-login
      if (data.error === 'Token invalide') {
        this.clearAuth();
        window.location.reload();
        throw new Error('Token invalide — reconnexion requise');
      }
      const error = new Error(data.error || 'Accès refusé');
      error.response = { status: 403, data };
      throw error;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      // Aucune réponse JSON (ex: 500 sans corps) → utile pour débogage en dev
      console.warn('API: impossible de parser la réponse JSON', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        parseError,
      });

      if (!response.ok) {
        const error = new Error(`Erreur serveur (${response.status})`);
        error.response = { status: response.status, data: null };
        throw error;
      }
      return null;
    }

    if (!response.ok) {
      const error = new Error(data.error || 'Erreur serveur');
      error.response = { status: response.status, data };
      throw error;
    }

    return skipCamelCase ? data : toCamelCase(data);
  }

  // Authentification
  async register(email, name, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    });
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // [AUDIT Phase 3] Le token est dans le cookie httpOnly, on stocke juste le user
    this.setAuth(data.user);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('❌ Erreur lors de la déconnexion côté serveur:', err);
    }

    this.clearAuth();
  }

  async getUsersPublic() {
    return this.request('/auth/users-public');
  }

  async forceLogin(email, password) {
    const data = await this.request('/auth/force-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setAuth(data.user);
    return data;
  }

  async loginPin(email, pin) {
    const data = await this.request('/auth/login-pin', {
      method: 'POST',
      body: JSON.stringify({ email, pin }),
    });
    this.setAuth(data.user);
    return data;
  }

  async setPin(pin, currentPassword, currentPin) {
    return this.request('/auth/me/pin', {
      method: 'PUT',
      body: JSON.stringify({ pin, currentPassword, currentPin }),
    });
  }

  async deletePin() {
    return this.request('/auth/me/pin', { method: 'DELETE' });
  }

  async getPinStatus() {
    return this.request('/auth/me/pin-status');
  }

  async suiviPersonalAuth(personId, pin, password) {
    return this.request('/suivi/personal-auth', {
      method: 'POST',
      body: JSON.stringify({ personId, pin, password }),
    });
  }

  async selfResetPassword(email, name) {
    return this.request('/auth/self-reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  }

  async setNewPassword(email, resetToken, newPassword) {
    const data = await this.request('/auth/set-new-password', {
      method: 'POST',
      body: JSON.stringify({ email, resetToken, newPassword }),
    });
    this.setAuth(data.user);
    return data;
  }

  async uploadAvatar(file, userId = null) {
    const formData = new FormData();
    formData.append('avatar', file);
    const endpoint = userId ? `/users/${userId}/avatar` : '/users/me/avatar';
    return this.requestFormData(endpoint, formData);
  }

  async deleteAvatar(userId = null) {
    const endpoint = userId ? `/users/${userId}/avatar` : '/users/me/avatar';
    return this.request(endpoint, { method: 'DELETE' });
  }

  isAuthenticated() {
    // [AUDIT Phase 3] On vérifie la présence de l'info user (le token est dans le cookie httpOnly)
    return !!this.user;
  }

  getCurrentUser() {
    return this.user;
  }

  // ── Helpers pour fetch directs (uploads FormData, downloads blob) ──

  /**
   * Gestion commune des erreurs auth sur fetch directs (FormData, Blob).
   * Tente refresh silencieux avant déconnexion.
   * @private
   * @returns {Promise<boolean>} true si refresh réussi (caller doit retry)
   */
  async _handleAuthError(response, endpoint) {
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    if (response.status === 401 && !isAuthEndpoint) {
      const canRetry = await this._handle401(endpoint);
      if (canRetry) return true; // indique au caller de retry
      // _handle401 fait déjà clearAuth + reload si refresh échoue
    }
    if (response.status === 403 && !isAuthEndpoint) {
      const data = await response.json().catch(() => ({}));
      if (data.error === 'Token invalide') {
        const canRetry = await this._handle401(endpoint);
        if (canRetry) return true;
      }
      this.clearAuth();
      window.location.reload();
      throw new Error('Accès refusé');
    }
    return false;
  }

  /**
   * Upload FormData (pas de Content-Type JSON, le navigateur met multipart).
   * Centralise credentials, timeout 60s et gestion 401/403.
   */
  async requestFormData(endpoint, formData, options = {}, _isRetry = false) {
    if (shouldShortCircuitRequest(endpoint, options)) {
      throw createServiceUnavailableError();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal: controller.signal,
        ...options,
      });
      markNetworkSuccess();
    } catch (err) {
      clearTimeout(timeoutId);
      markNetworkFailure(err?.name === 'AbortError' ? 'délai dépassé' : 'erreur réseau');
      if (err.name === 'AbortError') {
        const error = createServiceUnavailableError();
        error.message = 'Upload impossible — service local indisponible (délai dépassé)';
        error.isTimeoutError = true;
        throw error;
      }
      throw createServiceUnavailableError();
    }
    clearTimeout(timeoutId);
    if (!_isRetry) {
      const shouldRetry = await this._handleAuthError(response, endpoint);
      if (shouldRetry) return this.requestFormData(endpoint, formData, options, true);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Erreur upload (${response.status})`);
    }
    return response.json();
  }

  /**
   * Téléchargement binaire (PDF, CSV, image…).
   * Centralise credentials, timeout 30s et gestion 401/403.
   * @returns {Promise<Blob>}
   */
  async requestBlob(endpoint, options = {}, _isRetry = false) {
    if (shouldShortCircuitRequest(endpoint, options)) {
      throw createServiceUnavailableError();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        credentials: 'include',
        signal: controller.signal,
        ...options,
      });
      markNetworkSuccess();
    } catch (err) {
      clearTimeout(timeoutId);
      markNetworkFailure(err?.name === 'AbortError' ? 'délai dépassé' : 'erreur réseau');
      if (err.name === 'AbortError') {
        const error = createServiceUnavailableError();
        error.message = 'Téléchargement impossible — service local indisponible (délai dépassé)';
        error.isTimeoutError = true;
        throw error;
      }
      throw createServiceUnavailableError();
    }
    clearTimeout(timeoutId);
    if (!_isRetry) {
      const shouldRetry = await this._handleAuthError(response, endpoint);
      if (shouldRetry) return this.requestBlob(endpoint, options, true);
    }
    if (!response.ok) {
      throw new Error(`Erreur téléchargement (${response.status})`);
    }
    return response.blob();
  }
}
