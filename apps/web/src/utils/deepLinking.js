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

// buildEmagReservationUrl et buildEmagCatalogUrl — retirés (non utilisés)

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

// parseIncomingDeepLink — retirée (non utilisée)

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

// calculateVolume — retirée (non utilisée)
