// MessagesTab — Gestion des messages/annonces d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { MessageSquare, Trash2, Settings, ToggleLeft, ToggleRight, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

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

  const handleDelete = useCallback(async (msg) => {
    if (!confirm(`Supprimer le message « ${msg.title} » ?`)) return;
    try {
      await api.deleteDisplayMessage(msg.id);
      toast.success('Message supprimé');
      onRefresh();
    } catch {
      toast.error('Erreur suppression');
    }
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
      <div className="display-empty">
        <MessageSquare size={48} strokeWidth={1} />
        <h3>Aucun message</h3>
        <p>Créez des messages ou annonces à afficher sur vos écrans.</p>
      </div>
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
              <button className="btn-icon-sm" onClick={() => onEdit(msg)} title="Modifier">
                <Settings size={14} />
              </button>
              <button className="btn-icon-sm" onClick={() => handleToggle(msg)} title={msg.is_active ? 'Désactiver' : 'Activer'}>
                {msg.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              <button className="btn-icon-sm danger" onClick={() => handleDelete(msg)} title="Supprimer">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(MessagesTab);
