// API Client — Base class + auth methods
// Détection automatique de l'URL du backend

import { saveAuthToIDB, loadAuthFromIDB, clearAllIndexedDB } from '../indexedDB.js';

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

    // 2. Si toujours pas d'user, tenter un refresh silencieux (le cookie httpOnly peut encore être valide)
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
    localStorage.setItem('auth_user', JSON.stringify(user));
    saveAuthToIDB(user).catch(() => {});
  }

  clearAuth() {
    console.warn('[Auth] clearAuth() appelé —', new Error().stack?.split('\n')[2]?.trim());
    this.user = null;
    localStorage.removeItem('auth_user');
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
            console.warn(
              `[Auth] Refresh échoué: HTTP ${response.status} (tentative ${attempt + 1})`,
            );
            return false;
          }
          const data = await response.json();
          if (data?.user) {
            this.setAuth(data.user);
            console.warn('[Auth] Refresh réussi — session prolongée');
            return true;
          }
          console.warn('[Auth] Refresh: réponse OK mais pas de user dans la réponse');
          return false;
        } catch (err) {
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
      endpoint === '/auth/refresh';
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
    } catch (networkError) {
      clearTimeout(timeoutId);
      if (networkError.name === 'AbortError') {
        const error = new Error('Délai dépassé — le serveur ne répond pas');
        error.isTimeoutError = true;
        throw error;
      }
      const error = new Error('Erreur réseau — vérifiez votre connexion');
      error.isNetworkError = true;
      throw error;
    }
    clearTimeout(timeoutId);

    const isAuthEndpoint =
      endpoint === '/auth/login' ||
      endpoint === '/auth/register' ||
      endpoint === '/auth/force-login' ||
      endpoint === '/auth/refresh';

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

  async selfResetPassword(email, name) {
    return this.request('/auth/self-reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  }

  async selfResetPasswordWithNewPassword(email, name, newPassword) {
    return this.request('/auth/self-reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, name, newPassword }),
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
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const error = new Error('Upload — délai dépassé (60s)');
        error.isTimeoutError = true;
        throw error;
      }
      const error = new Error('Erreur réseau — vérifiez votre connexion');
      error.isNetworkError = true;
      throw error;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        credentials: 'include',
        signal: controller.signal,
        ...options,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const error = new Error('Téléchargement — délai dépassé (30s)');
        error.isTimeoutError = true;
        throw error;
      }
      const error = new Error('Erreur réseau — vérifiez votre connexion');
      error.isNetworkError = true;
      throw error;
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
