// API Client — Base class + auth methods
// Détection automatique de l'URL du backend

import { saveAuthToIDB, loadAuthFromIDB, clearAllIndexedDB } from '../indexedDB.js';

export const getApiUrl = () => {
  const port = window.location.port;

  // En dev (Vite) ou preview (Vite preview), le proxy gère /api
  if (port === '5174' || port === '5175' || port === '4173') {
    return '/api';
  }

  // Sinon, construire l'URL du backend à partir du hostname courant
  return `http://${window.location.hostname}:3002/api`;
};

export const API_URL = getApiUrl();

// Convertir snake_case en camelCase
export function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
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
    if (obj.every(item => typeof item !== 'object' || item === null)) {
      return obj;
    }
    return obj.map(item => toSnakeCase(item));
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const snakeObj = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
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
    if (!this.user) {
      this._recoverFromIDB();
    }
  }

  async _recoverFromIDB() {
    try {
      const user = await loadAuthFromIDB();
      if (user && !this.user) {
        this.user = user;
        localStorage.setItem('auth_user', JSON.stringify(user));
      }
    } catch { /* silencieux */ }
  }

  setAuth(user) {
    this.user = user;
    localStorage.setItem('auth_user', JSON.stringify(user));
    saveAuthToIDB(user).catch(() => {});
  }

  clearAuth() {
    this.user = null;
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token'); // nettoyage migration
    // [AUDIT FIX MED-F4] Vider tous les stores IndexedDB (PII)
    clearAllIndexedDB().catch(() => {});
  }

  async request(endpoint, options = {}) {
    const skipCamelCase = options.skipCamelCase;
    if (skipCamelCase) delete options.skipCamelCase;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // [AUDIT Phase 3] Envoie le cookie httpOnly automatiquement
      });
    } catch (networkError) {
      const error = new Error('Erreur réseau — vérifiez votre connexion');
      error.isNetworkError = true;
      throw error;
    }

    const isAuthEndpoint = endpoint === '/auth/login' || endpoint === '/auth/register' || endpoint === '/auth/force-login';

    if (response.status === 401 && !isAuthEndpoint) {
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
        parseError
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
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // [AUDIT Phase 3] Cookie httpOnly envoyé automatiquement
        headers: { 'Content-Type': 'application/json' }
      });
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
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Erreur upload');
    }
    return response.json();
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
}
