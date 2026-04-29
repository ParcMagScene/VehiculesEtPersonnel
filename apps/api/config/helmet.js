import helmet from 'helmet';

const MAP_TILE_SOURCES = [
  // OSM tiles can be served from subdomains (a/b/c) and occasionally root host.
  'https://*.tile.openstreetmap.org',
  'https://tile.openstreetmap.org',
  // Carto tiles can also vary between subdomains and root host.
  'https://*.basemaps.cartocdn.com',
  'https://basemaps.cartocdn.com',
];
const MAP_API_SOURCES = ['https://nominatim.openstreetmap.org', 'https://router.project-osrm.org'];
const GOOGLE_SOURCES = [
  'https://*.googleapis.com',
  'https://*.gstatic.com',
  'https://accounts.google.com',
];

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
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        ...MAP_TILE_SOURCES,
        'https://*.googleapis.com',
        'https://*.gstatic.com',
      ],
      connectSrc: [
        "'self'",
        ...MAP_API_SOURCES,
        'https://*.googleapis.com',
        'https://accounts.google.com',
      ],
      frameSrc: ["'self'", 'blob:', 'https://accounts.google.com'],
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
      imgSrc: ["'self'", 'data:', 'blob:', '*', ...MAP_TILE_SOURCES],
      connectSrc: ["'self'", ...MAP_API_SOURCES],
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
