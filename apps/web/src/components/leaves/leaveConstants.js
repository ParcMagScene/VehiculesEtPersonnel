// ═══════════════════════════════════════════════════════════════
// CONSTANTES PARTAGÉES — Module Congés
// Utilisées par LeaveRequestForm, LeaveRequestsPanel, LeaveValidationPanel
// ═══════════════════════════════════════════════════════════════

import { Clock, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';

export const STATUS_CONFIG = {
  pending:   { label: 'En attente', icon: Clock,          color: '#f59e0b', bg: '#fef3c7' },
  accepted:  { label: 'Acceptée',   icon: CheckCircle,    color: '#10b981', bg: '#d1fae5' },
  refused:   { label: 'Refusée',    icon: XCircle,        color: '#ef4444', bg: '#fee2e2' },
  modified:  { label: 'Modifiée',   icon: AlertTriangle,  color: '#3b82f6', bg: '#dbeafe' },
  cancelled: { label: 'Annulée',    icon: Trash2,         color: '#6b7280', bg: '#f3f4f6' },
};

export const LEAVE_TYPE_LABELS = {
  conge_paye:    { label: 'Congés payés',  icon: '🏖️', color: '#60a5fa' },
  sans_solde:    { label: 'Sans solde',    icon: '💤', color: '#fb923c' },
  exceptionnel:  { label: 'Exceptionnel',  icon: '🎉', color: '#a78bfa' },
  maladie:       { label: 'Maladie',       icon: '🏥', color: '#f87171' },
  parental:      { label: 'Parental',      icon: '👶', color: '#f472b6' },
  sabbatique:    { label: 'Sabbatique',    icon: '🌍', color: '#34d399' },
  formation:     { label: 'Formation',     icon: '🎓', color: '#8b5cf6' },
  fermeture:     { label: 'Fermeture',     icon: '🔒', color: '#6b7280' },
};
