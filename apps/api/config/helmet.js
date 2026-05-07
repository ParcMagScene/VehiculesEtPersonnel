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
// Préfixé `_` : conservé à titre documentaire (sources Google potentielles à
// réinjecter dans la CSP si besoin), non utilisé actuellement.
const _GOOGLE_SOURCES = [
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
  // [SEC PHASE 1] HSTS activé en prod (forcé HTTPS, 1 an, sous-domaines).
  // En dev/preview Vite HTTP : désactivé pour ne pas casser le proxy local.
  // Kill switch via HSTS_DISABLED=true au cas où (rollback rapide).
  hsts:
    process.env.NODE_ENV === 'production' && process.env.HSTS_DISABLED !== 'true'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
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
      // [SEC PHASE 2] imgSrc restreint : suppression du wildcard '*'.
      // - 'self', data:, blob: pour les assets locaux et générés.
      // - 'https:' autorise les pochettes/jaquettes externes mais bloque le HTTP (mixed content).
      // - Les artworks Sonos locaux (IP privée:1400 en HTTP) passent déjà par le proxy /api/sonos/artwork (same-origin).
      imgSrc: ["'self'", 'data:', 'blob:', 'https:', ...MAP_TILE_SOURCES],
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
 *
 * [SEC PHASE 3] Pose en plus un header `Content-Security-Policy-Report-Only`
 * sans `'unsafe-inline'` pour collecter les violations qui nous bloqueraient
 * une migration nonce-based, SANS impacter la production.
 * Activable via env CSP_REPORT_ONLY=true. Les rapports sont POSTés sur
 * /api/security/csp-report (defini dans server.js → securityLog).
 */
const REPORT_ONLY_DIRECTIVE =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
  "img-src 'self' data: blob: https: https://*.googleapis.com https://*.gstatic.com; " +
  "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org https://*.googleapis.com https://accounts.google.com; " +
  "frame-src 'self' blob: https://accounts.google.com; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; " +
  'report-uri /api/security/csp-report';

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
  if (process.env.CSP_REPORT_ONLY === 'true') {
    res.setHeader('Content-Security-Policy-Report-Only', REPORT_ONLY_DIRECTIVE);
  }
  return helmetMiddleware(req, res, next);
}
