// ═══════════════════════════════════════════════════════════════
// utils.js — Helpers UI partagés du module Contrôles Périodiques
// ═══════════════════════════════════════════════════════════════

export const STATUS_LABELS = {
  A_FAIRE: 'À faire',
  EN_RETARD: 'En retard',
  MANQUE: 'Manqué',
  EFFECTUE: 'Effectué',
};

export const STATUS_COLORS = {
  A_FAIRE: { bg: '#dbeafe', fg: '#1e40af', border: '#3b82f6' },
  EN_RETARD: { bg: '#fef3c7', fg: '#92400e', border: '#f59e0b' },
  MANQUE: { bg: '#fee2e2', fg: '#991b1b', border: '#dc2626' },
  EFFECTUE: { bg: '#dcfce7', fg: '#166534', border: '#22c55e' },
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function diffDaysFromToday(isoDate) {
  if (!isoDate) return null;
  const today = new Date(todayIso() + 'T00:00:00Z').getTime();
  const target = new Date(isoDate + 'T00:00:00Z').getTime();
  return Math.round((target - today) / 86400000);
}

export function formatDueLabel(isoDate) {
  if (!isoDate) return '—';
  const d = diffDaysFromToday(isoDate);
  if (d === null) return isoDate;
  if (d === 0) return `${isoDate} · aujourd'hui`;
  if (d > 0) return `${isoDate} · dans ${d} j`;
  return `${isoDate} · ${-d} j en retard`;
}
