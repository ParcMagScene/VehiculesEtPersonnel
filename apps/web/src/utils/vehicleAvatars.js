/**
 * Retourne le chemin de l'avatar SVG correspondant au type de véhicule.
 * Utilisé comme fallback quand le véhicule n'a pas de photo.
 */
export function getVehicleAvatar(vehicleType) {
  if (!vehicleType) return '/avatars/default.svg';

  const t = vehicleType.toUpperCase().trim();

  // Semi-remorque
  if (t.includes('SEMI')) return '/avatars/semi-remorque.svg';

  // Tracteur PL
  if (t.includes('TRACTEUR')) return '/avatars/tracteur.svg';

  // Porteur PL
  if (t.includes('PORTEUR') || t.includes('CAMION') || t.includes('PL'))
    return '/avatars/porteur.svg';

  // Scène mobile / remorque scène
  if (t.includes('SCEN') || t.includes('SCÈN')) return '/avatars/scene-mobile.svg';

  // Remorque (après scène pour ne pas capter les scènes mobiles)
  if (t.includes('REMORQUE')) return '/avatars/remorque.svg';

  // Voiture / camionnette
  if (t === 'VOITURE' || t === 'CAMIONNETTE' || t === 'VP') return '/avatars/voiture.svg';

  // VL (utilitaire léger : VL, VL 20m3, VL 17m3, etc.)
  if (t.includes('VL') || t.includes('UTILITAIRE') || t.includes('FOURGON') || t.includes('M3'))
    return '/avatars/vl.svg';

  return '/avatars/default.svg';
}
