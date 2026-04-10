// Logger unifié pour le backend — respecte NODE_ENV
// En production : seuls warn/error/info essentiels (pas de debug)
// En développement : tout est affiché avec timestamps

// [PHASE 5] Aligné avec env.js — seul 'development' explicite active le mode debug
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

const timestamp = () => new Date().toISOString().slice(11, 23);

const logger = {
  // Infos opérationnelles essentielles — toujours affiché
  info: (...args) => console.log(`[${timestamp()}]`, isDev ? 'ℹ️' : '[INFO]', ...args),

  // Avertissements — toujours affiché
  warn: (...args) => console.warn(`[${timestamp()}]`, isDev ? '⚠️' : '[WARN]', ...args),

  // Erreurs — toujours affiché
  error: (...args) => console.error(`[${timestamp()}]`, isDev ? '❌' : '[ERROR]', ...args),

  // Debug — uniquement en développement
  debug: (...args) => {
    if (isDev) console.log(`[${timestamp()}] 🔍`, ...args);
  },

  // Succès — toujours affiché (startup, migrations)
  success: (...args) => console.log(`[${timestamp()}]`, isDev ? '✅' : '[OK]', ...args),
};

export default logger;
