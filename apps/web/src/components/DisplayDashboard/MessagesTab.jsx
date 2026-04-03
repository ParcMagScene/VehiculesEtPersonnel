// MessagesTab — Gestion des messages/annonces d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { MessageSquare, Trash2, Settings, ToggleLeft, ToggleRight, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Button, Dialog, EmptyState, Tooltip } from '@/design-system';

const PRIORITY_CONFIG = {
  low: { label: 'Basse', color: 'var(--theme-text-muted)', icon: null },
  normal: { label: 'Normale', color: 'var(--theme-info)', icon: null },
  high: { label: 'Haute', color: 'var(--theme-warning)', icon: AlertTriangle },
  urgent: { label: 'Urgente', color: 'var(--theme-danger)', icon: AlertTriangle },
};

function MessagesTab({ currentUser, refreshKey, onEdit, onRefresh }) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplayMessages();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Erreur chargement messages');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages, refreshKey]);

  const handleDelete = useCallback((msg) => {
    setConfirmDialog({
      title: 'Supprimer',
      message: `Supprimer le message \xAB ${msg.title} \xBB ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteDisplayMessage(msg.id);
          toast.success('Message supprim\xE9');
          onRefresh();
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  }, [toast, onRefresh]);

  const handleToggle = useCallback(async (msg) => {
    try {
      await api.updateDisplayMessage(msg.id, { isActive: !msg.is_active });
      toast.success(msg.is_active ? 'Message désactivé' : 'Message activé');
      onRefresh();
    } catch {
      toast.error('Erreur modification');
    }
  }, [toast, onRefresh]);

  if (loading) return <div className="display-loading">Chargement des messages…</div>;

  if (messages.length === 0) {
    return (
      <EmptyState icon={<MessageSquare size={48} strokeWidth={1} />} title="Aucun message" description="Créez des messages ou annonces à afficher sur vos écrans." />
    );
  }

  return (
    <div className="display-list">
      {messages.map(msg => {
        const prio = PRIORITY_CONFIG[msg.priority] || PRIORITY_CONFIG.normal;
        const PrioIcon = prio.icon;
        const isExpired = msg.date_end && new Date(msg.date_end) < new Date();

        return (
          <div key={msg.id} className={`display-list-item ${!msg.is_active || isExpired ? 'inactive' : ''}`}>
            <div className="list-item-icon" style={{ color: prio.color }}>
              {PrioIcon ? <PrioIcon size={18} /> : <MessageSquare size={18} />}
            </div>
            <div className="list-item-content">
              <h4>
                {msg.title}
                <span className="priority-badge" style={{ backgroundColor: prio.color, color: '#fff' }}>
                  {prio.label}
                </span>
              </h4>
              {msg.body && <p className="list-item-desc">{msg.body.substring(0, 120)}{msg.body.length > 120 ? '…' : ''}</p>}
              <div className="list-item-meta">
                {msg.date_start && (
                  <span><Clock size={12} /> Du {new Date(msg.date_start).toLocaleDateString('fr-FR')}</span>
                )}
                {msg.date_end && (
                  <span>au {new Date(msg.date_end).toLocaleDateString('fr-FR')}</span>
                )}
                {isExpired && <span className="badge-expired">Expiré</span>}
                {!msg.is_active && <span className="badge-inactive">Inactif</span>}
              </div>
            </div>
            <div className="list-item-actions">
              <Tooltip content="Modifier">
                <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(msg)}>
                  <Settings size={14} />
                </Button>
              </Tooltip>
              <Tooltip content={msg.is_active ? 'Désactiver' : 'Activer'}>
                <Button variant="ghost" size="sm" iconOnly onClick={() => handleToggle(msg)}>
                  {msg.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </Button>
              </Tooltip>
              <Tooltip content="Supprimer">
                <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(msg)}>
                  <Trash2 size={14} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      })}
      <Dialog
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirmation'}
        variant={confirmDialog?.variant || 'confirm'}
        onConfirm={confirmDialog?.onConfirm}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirmer'}
        cancelLabel="Annuler"
      >
        {confirmDialog?.message}
      </Dialog>
    </div>
  );
}

export default memo(MessagesTab);
