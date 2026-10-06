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
}) {
  const prettyVehicleReg = String(reservationVehicleReg || '').trim();
  const vehicleBadge = section === 'chargement' && prettyVehicleReg
    ? `<span class="tv-vehicle-badge" title="${escapeHtml(prettyVehicleReg)}">${escapeHtml(prettyVehicleReg)}</span>`
    : '';

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
