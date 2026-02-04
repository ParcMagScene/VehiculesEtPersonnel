/**
 * Logger conditionnel pour environnement de développement/production
 * 
 * En production, seules les erreurs sont loggées dans la console.
 * En développement, tous les logs sont affichés.
 * 
 * Pour activer le mode debug en production:
 * localStorage.setItem('debug_mode', 'true')
 */

// Fonction pour vérifier si on est en mode développement
const isDev = () => {
  try {
    return import.meta.env.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('debug_mode') === 'true');
  } catch (e) {
    return false;
  }
};

/**
 * Système de logging intelligent avec émojis et groupes
 */
export const logger = {
  /**
   * Log normal - uniquement en développement
   */
  log: (...args) => {
    if (isDev()) {
      console.log(...args);
    }
  },

  /**
   * Warning - uniquement en développement
   */
  warn: (...args) => {
    if (isDev()) {
      console.warn(...args);
    }
  },

  /**
   * Erreur - toujours loggée (important pour le monitoring)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Info - uniquement en développement
   */
  info: (...args) => {
    if (isDev()) {
      console.info(...args);
    }
  },

  /**
   * Debug - uniquement en développement
   */
  debug: (...args) => {
    if (isDev()) {
      console.debug(...args);
    }
  },

  /**
   * Groupe - pour structurer les logs complexes
   */
  group: (label) => {
    if (isDev()) {
      console.group(label);
    }
  },

  /**
   * Fin de groupe
   */
  groupEnd: () => {
    if (isDev()) {
      console.groupEnd();
    }
  },

  /**
   * Groupe collapsed - pour logs secondaires
   */
  groupCollapsed: (label) => {
    if (isDev()) {
      console.groupCollapsed(label);
    }
  },

  /**
   * Table - pour afficher des données structurées
   */
  table: (data) => {
    if (isDev()) {
      console.table(data);
    }
  },

  /**
   * Mesure de performance
   */
  time: (label) => {
    if (isDev()) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (isDev()) {
      console.timeEnd(label);
    }
  }
};

/**
 * Helper pour les logs OAuth/API (souvent verbeux)
 */
export const oauthLogger = {
  log: (...args) => logger.log('🔐', ...args),
  warn: (...args) => logger.warn('⚠️', ...args),
  error: (...args) => logger.error('❌ OAuth:', ...args),
  success: (...args) => logger.log('✅', ...args),
};

/**
 * Helper pour les logs API
 */
export const apiLogger = {
  request: (method, url, data) => {
    logger.groupCollapsed(`📡 ${method} ${url}`);
    if (data) logger.log('Données:', data);
    logger.groupEnd();
  },
  response: (status, data) => {
    logger.log(`✅ ${status}`, data);
  },
  error: (error) => {
    logger.error('❌ Erreur API:', error);
  }
};

/**
 * Helper pour les logs de données
 */
export const dataLogger = {
  save: (type, data) => logger.log(`💾 Sauvegarde ${type}:`, data),
  load: (type, count) => logger.log(`📥 Chargement ${type}:`, count, 'éléments'),
  update: (type, id) => logger.log(`🔄 Mise à jour ${type}:`, id),
  delete: (type, id) => logger.log(`🗑️ Suppression ${type}:`, id),
};

export default logger;
