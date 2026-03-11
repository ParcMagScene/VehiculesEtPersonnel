import helmet from 'helmet';

/**
 * Configuration Helmet — headers de sécurité HTTP
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
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
      || (req.path.startsWith('/api/display/tv') && !req.headers.authorization)
      || (req.path.startsWith('/api/') && !req.path.startsWith('/api/display/') && !req.headers.authorization)) {
    res.removeHeader('Strict-Transport-Security');
    res.setHeader('Strict-Transport-Security', 'max-age=0');
    return next();
  }
  return helmetMiddleware(req, res, next);
}
