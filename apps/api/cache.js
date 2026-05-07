/**
 * ═══════════════════════════════════════════════════════
 * Cache LRU/TTL — Module de cache en mémoire pour eM@g
 * ═══════════════════════════════════════════════════════
 *
 * Usage :
 *   import { createCache, authCache, statsCache, listCache, icalCache } from './cache.js';
 *
 *   // Direct
 *   const cache = createCache({ maxSize: 200, ttl: 30_000, name: 'my-cache' });
 *   cache.set('key', value);
 *   const hit = cache.get('key'); // null si expiré/absent
 *
 *   // Express middleware
 *   app.get('/api/stats', cacheMiddleware(statsCache, (req) => 'stats'), handler);
 *
 *   // Invalidation
 *   listCache.invalidate('affaires');          // une clé
 *   listCache.invalidatePattern(/^affaires/);  // par pattern
 *   statsCache.clear();                        // tout vider
 */

class LRUCache {
  /**
   * @param {Object} opts
   * @param {number} opts.maxSize  Nombre max d'entrées (défaut 500)
   * @param {number} opts.ttl      TTL en ms (défaut 30 000 = 30s)
   * @param {string} opts.name     Nom pour le debug
   */
  constructor({ maxSize = 500, ttl = 30_000, name = 'cache' } = {}) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.name = name;
    /** @type {Map<string, {value: any, expiry: number}>} */
    this._map = new Map();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Récupère une valeur du cache
   * @param {string} key
   * @returns {any|null} Valeur ou null si absent/expiré
   */
  get(key) {
    const entry = this._map.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }
    if (Date.now() > entry.expiry) {
      this._map.delete(key);
      this._misses++;
      return null;
    }
    // LRU : remonter en fin de Map (le plus récemment utilisé)
    this._map.delete(key);
    this._map.set(key, entry);
    this._hits++;
    return entry.value;
  }

  /**
   * Stocke une valeur dans le cache
   * @param {string} key
   * @param {any} value
   * @param {number} [customTTL] TTL custom en ms (optionnel)
   */
  set(key, value, customTTL) {
    // Si la clé existe déjà, la supprimer pour la remettre en fin
    if (this._map.has(key)) {
      this._map.delete(key);
    }
    // Éviction LRU si plein
    if (this._map.size >= this.maxSize) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
    this._map.set(key, {
      value,
      expiry: Date.now() + (customTTL || this.ttl),
    });
  }

  /**
   * Vérifie si une clé existe et n'est pas expirée
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiry) {
      this._map.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Invalide une clé spécifique
   * @param {string} key
   */
  invalidate(key) {
    this._map.delete(key);
  }

  /**
   * Invalide toutes les clés matchant un pattern RegExp
   * @param {RegExp} pattern
   */
  invalidatePattern(pattern) {
    for (const key of this._map.keys()) {
      if (pattern.test(key)) {
        this._map.delete(key);
      }
    }
  }

  /** Vide complètement le cache */
  clear() {
    this._map.clear();
  }

  /** @returns {{ name: string, size: number, maxSize: number, hits: number, misses: number, hitRate: string }} */
  stats() {
    const total = this._hits + this._misses;
    return {
      name: this.name,
      size: this._map.size,
      maxSize: this.maxSize,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? `${((this._hits / total) * 100).toFixed(1)}%` : '0%',
    };
  }
}

// ─── Instances pré-configurées ───

/** Cache pour authenticateToken : TTL court, taille large */
const authCache = new LRUCache({ maxSize: 1000, ttl: 30_000, name: 'auth' });

/** Cache pour les endpoints /stats : TTL 20s */
const statsCache = new LRUCache({ maxSize: 100, ttl: 20_000, name: 'stats' });

/** Cache pour les listes (vehicles, persons, affaires…) : TTL 30s */
const listCache = new LRUCache({ maxSize: 200, ttl: 30_000, name: 'lists' });

/** Cache pour les données iCal externes : TTL 5 min */
const icalCache = new LRUCache({ maxSize: 50, ttl: 5 * 60_000, name: 'ical' });

/** Cache pour la config (Google keys, etc.) : TTL 10 min */
const configCache = new LRUCache({ maxSize: 50, ttl: 10 * 60_000, name: 'config' });

// ─── [S2-3] Caches dédiés par endpoint chaud ───
/** Tree des catégories d'équipement : peu de mutations → TTL 5 min */
const equipmentTreeCache = new LRUCache({ maxSize: 5, ttl: 5 * 60_000, name: 'equipment-tree' });
/** Liste équipement (filtres dans la clé) : TTL 60s */
const equipmentListCache = new LRUCache({ maxSize: 100, ttl: 60_000, name: 'equipment-list' });
/** Lookup tables annuaire : très peu de mutations → TTL 5 min */
const annuaireRefCache = new LRUCache({ maxSize: 5, ttl: 5 * 60_000, name: 'annuaire-ref' });
/** Planning personnel : TTL 30s */
const personnelPlanningCache = new LRUCache({
  maxSize: 200,
  ttl: 30_000,
  name: 'personnel-planning',
});
/** Liste personnel suivi (avec stats sheets) : TTL 60s */
const suiviPersonnelCache = new LRUCache({ maxSize: 5, ttl: 60_000, name: 'suivi-personnel' });

// ─── Registre global (pour le endpoint /api/cache/stats) ───
const ALL_CACHES = [
  authCache,
  statsCache,
  listCache,
  icalCache,
  configCache,
  equipmentTreeCache,
  equipmentListCache,
  annuaireRefCache,
  personnelPlanningCache,
  suiviPersonnelCache,
];

/**
 * Middleware Express de cache automatique
 *
 * @param {LRUCache} cache  Instance de cache à utiliser
 * @param {function(req): string} keyFn  Fonction qui retourne la clé de cache depuis la requête
 * @param {number} [customTTL]  TTL override en ms
 * @returns {function} Express middleware
 *
 * Usage :
 *   app.get('/api/stats', cacheMiddleware(statsCache, () => 'comm-stats'), handler);
 *   app.get('/api/items', cacheMiddleware(listCache, req => `items-${req.query.page}`), handler);
 */
function cacheMiddleware(cache, keyFn, customTTL) {
  return (req, res, next) => {
    // Bypass : méthode autre que GET, header no-cache, ou keyFn renvoie null/undefined
    if (req.method !== 'GET') return next();
    const cc = req.headers['cache-control'];
    if (cc && /no-cache/i.test(cc)) return next();

    const key = keyFn(req);
    if (key == null) return next();

    const cached = cache.get(key);
    if (cached !== null) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    res.set('X-Cache', 'MISS');

    // Intercepter res.json pour capturer la réponse
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // Ne cacher que les réponses réussies
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data, customTTL);
      }
      return originalJson(data);
    };
    next();
  };
}

/**
 * Helper pour invalider les caches liés à une entité après mutation
 *
 * @param {string} entity  Nom de l'entité ('affaires', 'vehicles', 'personnel', etc.)
 */
function invalidateEntity(entity) {
  listCache.invalidatePattern(new RegExp(`^${entity}`));
  statsCache.clear(); // Les stats dépendent souvent des listes
}

/**
 * [S2-3] Middleware Express : après une réponse 2xx, invalide les caches passés
 * en paramètres. Évite d'oublier `cache.clear()` à la fin de chaque handler.
 *
 * Usage : app.post('/x', auth, invalidateOnSuccess(equipmentListCache), handler)
 *
 * @param {...LRUCache} caches  Instances à vider après succès
 */
function invalidateOnSuccess(...caches) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const c of caches) c.clear();
      }
      return originalJson(data);
    };
    next();
  };
}

/**
 * Factory pour créer un cache personnalisé
 * @param {Object} opts  Options du LRUCache
 * @returns {LRUCache}
 */
function createCache(opts) {
  const cache = new LRUCache(opts);
  ALL_CACHES.push(cache);
  return cache;
}

/**
 * Retourne les stats de tous les caches enregistrés
 * @returns {Array<Object>}
 */
function getAllCacheStats() {
  return ALL_CACHES.map((c) => c.stats());
}

export {
  ALL_CACHES,
  annuaireRefCache,
  authCache,
  cacheMiddleware,
  configCache,
  createCache,
  equipmentListCache,
  equipmentTreeCache,
  getAllCacheStats,
  icalCache,
  invalidateEntity,
  invalidateOnSuccess,
  listCache,
  LRUCache,
  personnelPlanningCache,
  statsCache,
  suiviPersonnelCache,
};
