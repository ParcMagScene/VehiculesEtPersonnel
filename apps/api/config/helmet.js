import helmet from 'helmet';

/**
 * Configuration Helmet — headers de sécurité HTTP
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // HSTS désactivé — le serveur est HTTP uniquement, pas de terminaison SSL.
  // Activer HSTS sans HTTPS force les navigateurs à upgrader en https:// → ERR_SSL_PROTOCOL_ERROR
  hsts: false,
});

/**
 * Middleware conditionnel : bypass helmet pour le client TV (port 3001)
 * et les requêtes non authentifiées sur les chemins display/TV
 */
export function helmetConditional(req, res, next) {
  const port = req.socket.localPort;
  if (port === 3001
      || req.path.startsWith('/tv-client')
      || req.path.startsWith('/display-')
      || req.path === '/tv'
      || req.path === '/SNCF.wav'
      || (req.path.startsWith('/api/display/tv') && !req.headers.authorization)) {
    return next();
  }
  return helmetMiddleware(req, res, next);
}
