// ═══════════════════════════════════════════════════════════════
// CONSTANTES PARTAGÉES — Module Congés
// Utilisées par LeaveRequestForm, LeaveRequestsPanel, LeaveValidationPanel
// ═══════════════════════════════════════════════════════════════

import { Clock, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { STATUS_COLORS, ACCENT_COLORS } from '../../constants/colors';

export const STATUS_CONFIG = {
  pending: { label: 'En attente', icon: Clock, color: STATUS_COLORS.warning, bg: '#fef3c7' },
  accepted: { label: 'Acceptée', icon: CheckCircle, color: STATUS_COLORS.success, bg: '#d1fae5' },
  refused: { label: 'Refusée', icon: XCircle, color: STATUS_COLORS.danger, bg: '#fee2e2' },
  modified: { label: 'Modifiée', icon: AlertTriangle, color: STATUS_COLORS.info, bg: '#dbeafe' },
  cancelled: { label: 'Annulée', icon: Trash2, color: STATUS_COLORS.neutralSoft, bg: '#f3f4f6' },
};

export const LEAVE_TYPE_LABELS = {
  conge_paye: { label: 'Congés payés', icon: '🏖️', color: '#60a5fa' },
  sans_solde: { label: 'Sans solde', icon: '💤', color: '#fb923c' },
  exceptionnel: { label: 'Exceptionnel', icon: '🎉', color: '#a78bfa' },
  maladie: { label: 'Maladie', icon: '🏥', color: '#f87171' },
  parental: { label: 'Parental', icon: '👶', color: '#f472b6' },
  sabbatique: { label: 'Sabbatique', icon: '🌍', color: '#34d399' },
  formation: { label: 'Formation', icon: '🎓', color: ACCENT_COLORS.violet },
  fermeture: { label: 'Fermeture', icon: '🔒', color: STATUS_COLORS.neutralSoft },
};
