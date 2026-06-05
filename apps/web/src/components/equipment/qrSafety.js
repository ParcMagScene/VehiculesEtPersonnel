/**
 * qrSafety — vérifications sur l'URL que les QR codes vont encoder.
 *
 * Contexte : un QR gravé au laser sur Raven XIP est PERMANENT et coûte cher.
 * Si le code génère un QR pointant vers `http://localhost:...` ou une IP
 * privée (192.168.x.x, 10.x.x.x), tous les téléphones en dehors de ce LAN
 * scanneront du vide → étiquette inutilisable.
 *
 * Ce module fournit une analyse partagée par les composants de génération.
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./, // link-local
  /\.local$/i, // mDNS
  /\.lan$/i,
  /\.mag$/i, // domaines AdGuard internes (sav.mag, dashboard.mag…)
];

/**
 * Analyse une URL de base destinée à être encodée dans des QR.
 * @param {string} baseUrl ex: 'https://magsav.duckdns.org'
 * @returns {{ safe: boolean, reason: string|null, hostname: string, protocol: string }}
 */
export function analyzeQrBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    return { safe: false, reason: 'URL absente', hostname: '', protocol: '' };
  }
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { safe: false, reason: 'URL invalide', hostname: '', protocol: '' };
  }

  const hostname = parsed.hostname;
  const protocol = parsed.protocol;

  if (PRIVATE_HOST_PATTERNS.some((rx) => rx.test(hostname))) {
    return {
      safe: false,
      reason: `L'URL pointe vers un hôte local/privé (${hostname}). Les QR seront illisibles depuis l'extérieur du LAN.`,
      hostname,
      protocol,
    };
  }

  if (protocol !== 'https:') {
    return {
      safe: false,
      reason: `L'URL utilise ${protocol} au lieu de HTTPS. Les téléphones avec HSTS échoueront.`,
      hostname,
      protocol,
    };
  }

  return { safe: true, reason: null, hostname, protocol };
}
