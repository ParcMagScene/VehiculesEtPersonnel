// API Client — Base class + auth methods
// Détection automatique de l'URL du backend

export const getApiUrl = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;

  if (port === '5174' || port === '5175' || port === '4173') {
    return '/api';
  }

  if (hostname === 'magsav.duckdns.org') {
    return 'http://magsav.duckdns.org:3002/api';
  }

  return `http://${hostname}:3002/api`;
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
    this.token = localStorage.getItem('auth_token');
    this.user = JSON.parse(localStorage.getItem('auth_user') || 'null');
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  async request(endpoint, options = {}) {
    const skipCamelCase = options.skipCamelCase;
    if (skipCamelCase) delete options.skipCamelCase;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
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
    this.setAuth(data.token, data.user);
    return data;
  }

  async logout() {
    if (this.token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (err) {
        console.error('❌ Erreur lors de la déconnexion côté serveur:', err);
      }
    }

    this.clearAuth();
  }

  isAuthenticated() {
    return !!this.token;
  }

  getCurrentUser() {
    return this.user;
  }
}
