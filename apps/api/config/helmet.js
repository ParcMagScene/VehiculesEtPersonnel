import helmet from 'helmet';

/**
 * Configuration Helmet — headers de sécurité HTTP
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // Pas de upgrade-insecure-requests : le frontend Vite est servi en HTTP,
      // le proxy transmet les headers API au navigateur → upgrade casserait tout
    },
  },
  crossOriginEmbedderPolicy: false,
  // HSTS désactivé — le frontend est HTTP (Vite preview), HTTPS uniquement sur l'API directe
  hsts: false,
});

/**
 * CSP allégée pour le client TV / display (pas de bypass total)
 * imgSrc: '*' nécessaire pour les pochettes Sonos (URLs dynamiques)
 */
const tvHelmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', '*'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: false,
});

/**
 * Middleware conditionnel : CSP allégée pour TV/display (au lieu de bypass total)
 */
export function helmetConditional(req, res, next) {
  const port = req.socket.localPort;
  if (
    port === 3001 ||
    req.path.startsWith('/tv-client') ||
    req.path.startsWith('/display-') ||
    req.path === '/tv' ||
    req.path === '/SNCF.wav' ||
    (req.path.startsWith('/api/display/tv') && !req.headers.authorization)
  ) {
    return tvHelmetMiddleware(req, res, next);
  }
  return helmetMiddleware(req, res, next);
}
