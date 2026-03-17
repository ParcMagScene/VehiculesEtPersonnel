// Logger unifié pour le backend — respecte NODE_ENV
// En production : seuls warn/error/info essentiels (pas de debug)
// En développement : tout est affiché avec timestamps

const isDev = process.env.NODE_ENV !== 'production';

const timestamp = () => new Date().toISOString().slice(11, 23);

const logger = {
  // Infos opérationnelles essentielles — toujours affiché
  info: (...args) => console.log(isDev ? `[${timestamp()}] ℹ️` : '[INFO]', ...args),

  // Avertissements — toujours affiché
  warn: (...args) => console.warn(isDev ? `[${timestamp()}] ⚠️` : '[WARN]', ...args),

  // Erreurs — toujours affiché
  error: (...args) => console.error(isDev ? `[${timestamp()}] ❌` : '[ERROR]', ...args),

  // Debug — uniquement en développement
  debug: (...args) => {
    if (isDev) console.log(`[${timestamp()}] 🔍`, ...args);
  },

  // Succès — toujours affiché (startup, migrations)
  success: (...args) => console.log(isDev ? `[${timestamp()}] ✅` : '[OK]', ...args),
};

export default logger;
