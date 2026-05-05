// Middleware de logging HTTP structuré
// Loggue method, path, status, duration pour chaque requête
import logger from '../logger.js';

export function httpLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl;

    // Skip les health checks et assets statiques pour éviter le bruit
    if (url === '/api/health' || url.startsWith('/assets/') || url.startsWith('/icons/')) {
      return;
    }

    if (status >= 500) {
      logger.error(`${method} ${url} ${status} ${duration}ms`);
    } else if (status >= 400) {
      logger.warn(`${method} ${url} ${status} ${duration}ms`);
    } else {
      logger.debug(`${method} ${url} ${status} ${duration}ms`);
    }
  });

  next();
}
