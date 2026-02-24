// ============================================================
// DEEP LINKING — eM@g ↔ Chargement 3D
// ============================================================

const CHARGEMENT_BASE_URL = 'chargement://load';
const EMAG_BASE_URL = 'https://magsav.duckdns.org';

/**
 * Génère un lien pour ouvrir Chargement 3D avec une réservation
 */
export function buildChargementUrlForReservation(reservationId) {
  return `${CHARGEMENT_BASE_URL}?reservation_id=${encodeURIComponent(reservationId)}`;
}

/**
 * Génère un lien pour ouvrir Chargement 3D avec une liste d'équipements
 */
export function buildChargementUrlForEquipment(equipmentList) {
  const json = JSON.stringify(equipmentList);
  return `${CHARGEMENT_BASE_URL}?equipment=${encodeURIComponent(json)}`;
}

/**
 * Génère un lien pour ouvrir Chargement 3D avec un modèle de camion
 */
export function buildChargementUrlForTruck(truckModelCode) {
  return `${CHARGEMENT_BASE_URL}?truck_model=${encodeURIComponent(truckModelCode)}`;
}

/**
 * Génère un lien eM@g pour une réservation (deeplink retour depuis Chargement)
 */
export function buildEmagReservationUrl(reservationId) {
  return `${EMAG_BASE_URL}/reservation/${encodeURIComponent(reservationId)}`;
}

/**
 * Génère un lien eM@g pour un équipement catalogue
 */
export function buildEmagCatalogUrl(reference) {
  return `${EMAG_BASE_URL}/catalog/${encodeURIComponent(reference)}`;
}

/**
 * Ouvre le lien Chargement 3D
 * Utilise window.open avec fallback si le protocole n'est pas enregistré
 */
export function openInChargement(url) {
  // Tenter d'ouvrir via le protocole custom
  const link = document.createElement('a');
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);

  // Timeout pour détecter si l'app n'est pas installée
  let opened = false;
  const timer = setTimeout(() => {
    if (!opened) {
      // Fallback: proposer le téléchargement ou afficher un message
      console.warn('Application Chargement 3D non détectée');
      alert(
        'L\'application Chargement 3D ne semble pas installée.\n\n' +
        'URL générée :\n' + url + '\n\n' +
        'Copiez cette URL et ouvrez-la dans l\'application Chargement.'
      );
    }
    document.body.removeChild(link);
  }, 2000);

  // Écouter le blur (l'app s'est ouverte)
  const handleBlur = () => {
    opened = true;
    clearTimeout(timer);
    window.removeEventListener('blur', handleBlur);
  };
  window.addEventListener('blur', handleBlur);

  link.click();
}

/**
 * Parse les paramètres de deep link entrant (depuis Chargement → eM@g)
 * Retourne { type: 'reservation'|'catalog', id: string } ou null
 */
export function parseIncomingDeepLink() {
  const path = window.location.pathname;
  const hash = window.location.hash;

  // /reservation/:id
  const resMatch = path.match(/\/reservation\/([^/]+)/);
  if (resMatch) {
    return { type: 'reservation', id: decodeURIComponent(resMatch[1]) };
  }

  // /catalog/:reference
  const catMatch = path.match(/\/catalog\/([^/]+)/);
  if (catMatch) {
    return { type: 'catalog', reference: decodeURIComponent(catMatch[1]) };
  }

  // Hash-based fallback: #/reservation/:id or #/catalog/:ref
  const hashResMatch = hash.match(/#\/reservation\/([^/]+)/);
  if (hashResMatch) {
    return { type: 'reservation', id: decodeURIComponent(hashResMatch[1]) };
  }

  const hashCatMatch = hash.match(/#\/catalog\/([^/]+)/);
  if (hashCatMatch) {
    return { type: 'catalog', reference: decodeURIComponent(hashCatMatch[1]) };
  }

  return null;
}

/**
 * Formatter les dimensions (JSON) en string lisible
 */
export function formatDimensions(dimensionsJson) {
  if (!dimensionsJson) return '—';
  try {
    const dims = typeof dimensionsJson === 'string' ? JSON.parse(dimensionsJson) : dimensionsJson;
    if (dims.w && dims.h && dims.d) {
      return `${dims.w} × ${dims.h} × ${dims.d} cm`;
    }
    if (dims.length && dims.width && dims.height) {
      return `${dims.length} × ${dims.width} × ${dims.height} cm`;
    }
    return JSON.stringify(dims);
  } catch {
    return '—';
  }
}

/**
 * Calculer le volume en m³ à partir de dimensions JSON
 */
export function calculateVolume(dimensionsJson) {
  if (!dimensionsJson) return 0;
  try {
    const dims = typeof dimensionsJson === 'string' ? JSON.parse(dimensionsJson) : dimensionsJson;
    const w = dims.w || dims.length || 0;
    const h = dims.h || dims.height || 0;
    const d = dims.d || dims.width || 0;
    return (w * h * d) / 1000000; // cm³ → m³
  } catch {
    return 0;
  }
}
