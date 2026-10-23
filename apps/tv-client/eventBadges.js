const AFFAIRE_TYPE_COLORS = {
  Prestation: '#3b82f6',
  Location: '#f59e0b',
  Installation: '#10b981',
  Vente: '#8b5cf6',
  'Tournée': '#ec4899',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getEventBadges({
  section,
  affaireNum = '',
  affaireType = '',
  reservationVehicleReg = '',
  reservationVehicles,
}) {
  const hasVehicleList = Array.isArray(reservationVehicles);
  const vehicles = hasVehicleList
    ? reservationVehicles
        .map((vehicle) => ({
          name: String(vehicle?.name || '').trim(),
          registration: String(vehicle?.registration || '').trim(),
        }))
        .filter((vehicle) => vehicle.name || vehicle.registration)
    : [];
  const prettyVehicleReg = String(reservationVehicleReg || '').trim();
  const vehicleBadges = hasVehicleList
    ? vehicles
        .map((vehicle) => {
          const label = [vehicle.registration, vehicle.name].filter(Boolean).join(' · ');
          const title = [vehicle.name, vehicle.registration].filter(Boolean).join(' · ');
          return `<span class="tv-vehicle-badge" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
        })
        .join('')
    : prettyVehicleReg
      ? `<span class="tv-vehicle-badge" title="${escapeHtml(prettyVehicleReg)}">${escapeHtml(prettyVehicleReg)}</span>`
      : '';
  const vehicleBadge = ['chargement', 'courses'].includes(section) ? vehicleBadges : '';

  const badgeColor = AFFAIRE_TYPE_COLORS[affaireType] || '#3b82f6';
  const affaireBadge = affaireNum
    ? `<span class="tv-affaire-badge" style="--badge-color:${badgeColor}">${escapeHtml(affaireNum)}</span>`
    : '';

  return { vehicleBadge, affaireBadge };
}

if (typeof window !== 'undefined') {
  window.getEventBadges = getEventBadges;
}

if (typeof globalThis !== 'undefined') {
  globalThis.getEventBadges = getEventBadges;
}
