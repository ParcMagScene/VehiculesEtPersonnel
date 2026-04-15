import { STATUS_COLORS, ACCENT_COLORS } from '../../constants/colors';

// Helper : grouper les articles par demandeur (affaire ou personne physique)
export function groupItemsByRequester(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.source_affaire_id || item.source_requester_name || '_sans_demandeur';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        isAffaire: !!item.source_affaire_id,
        affaireId: item.source_affaire_id || null,
        requesterName: item.source_requester_name || null,
        items: [],
        totalQty: 0,
        receivedQty: 0,
        totalHt: 0,
      });
    }
    const g = groups.get(key);
    g.items.push(item);
    g.totalQty += item.quantity || 0;
    g.receivedQty += item.received_qty || 0;
    g.totalHt += item.total_ht || 0;
  }
  return [...groups.values()];
}

export const ORDER_STATUS = {
  draft: { label: 'Brouillon', color: 'var(--theme-text-muted)', icon: '📝' },
  sent: { label: 'Envoyée', color: STATUS_COLORS.info, icon: '📤' },
  confirmed: { label: 'Confirmée', color: ACCENT_COLORS.violet, icon: '✅' },
  partial: { label: 'Reçue partiellement', color: STATUS_COLORS.warning, icon: '📦' },
  received: { label: 'Réceptionnée', color: STATUS_COLORS.success, icon: '✔️' },
  cancelled: { label: 'Annulée', color: STATUS_COLORS.danger, icon: '❌' },
};

export const QUOTE_STATUS = {
  draft: { label: 'Brouillon', color: 'var(--theme-text-muted)', icon: '📝' },
  sent: { label: 'Envoyé', color: STATUS_COLORS.info, icon: '📤' },
  accepted: { label: 'Accepté', color: STATUS_COLORS.success, icon: '✅' },
  refused: { label: 'Refusé', color: STATUS_COLORS.danger, icon: '❌' },
  expired: { label: 'Expiré', color: 'var(--theme-text-gray)', icon: '⏰' },
};

export const UNITS = ['u', 'm', 'm²', 'm³', 'kg', 'L', 'h', 'j', 'lot', 'forfait'];

export const REQUEST_STATUS = {
  pending: { label: 'En attente', color: STATUS_COLORS.warning, icon: '⏳' },
  approved: { label: 'Validée', color: STATUS_COLORS.success, icon: '✅' },
  rejected: { label: 'Refusée', color: STATUS_COLORS.danger, icon: '❌' },
  ordered: { label: 'Commandée', color: STATUS_COLORS.info, icon: '📦' },
};

export const REQUEST_PRIORITY = {
  low: { label: 'Basse', color: STATUS_COLORS.neutralSoft, icon: '🔵' },
  normal: { label: 'Normale', color: STATUS_COLORS.info, icon: '🟢' },
  high: { label: 'Haute', color: STATUS_COLORS.warning, icon: '🟡' },
  urgent: { label: 'Urgente', color: STATUS_COLORS.danger, icon: '🔴' },
};

export const DESTINATIONS = ['SAV', 'Pièces', 'Stock', 'Autre'];

export const DOC_TYPES = {
  acknowledgment: { label: 'Accusé de commande', icon: '📋' },
  delivery_note: { label: 'BL fournisseur', icon: '📦' },
  quote: { label: 'Devis fournisseur', icon: '📄' },
  invoice: { label: 'Facture fournisseur', icon: '🧾' },
};
