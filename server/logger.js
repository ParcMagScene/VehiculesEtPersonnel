// Logger simple pour le backend — respecte NODE_ENV
// En production : seuls les warn/error/info essentiels
// En développement : tout est affiché

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  // Toujours affiché (infos opérationnelles essentielles)
  info: (...args) => console.log(...args),
  
  // Toujours affiché
  warn: (...args) => console.warn(...args),
  
  // Toujours affiché
  error: (...args) => console.error(...args),
  
  // Debug — uniquement en développement
  debug: (...args) => {
    if (isDev) console.log(...args);
  },
};

export default logger;
