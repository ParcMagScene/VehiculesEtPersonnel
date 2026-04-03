// LogsTab — Consultation des logs d'activité des écrans
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Table, EmptyState } from '@/design-system';

const PAGE_SIZE = 50;

const ACTION_LABELS = {
  screen_created: '🖥️ Écran créé',
  screen_updated: '🖥️ Écran modifié',
  screen_deleted: '🖥️ Écran supprimé',
  playlist_created: '🎵 Playlist créée',
  playlist_updated: '🎵 Playlist modifiée',
  playlist_deleted: '🎵 Playlist supprimée',
  playlist_items_updated: '🎵 Items playlist modifiés',
  media_uploaded: '📁 Média uploadé',
  media_deleted: '📁 Média supprimé',
  message_created: '💬 Message créé',
  message_updated: '💬 Message modifié',
  message_deleted: '💬 Message supprimé',
  template_created: '📐 Template créé',
  template_updated: '📐 Template modifié',
  template_deleted: '📐 Template supprimé',
};

function LogsTab({ refreshKey }) {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplayLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Erreur chargement logs');
    } finally {
      setLoading(false);
    }
  }, [toast, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, refreshKey]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <div className="display-loading">Chargement des logs…</div>;

  if (logs.length === 0) {
    return (
      <EmptyState icon={<Activity size={48} strokeWidth={1} />} title="Aucun log" description="L'historique des actions apparaîtra ici." />
    );
  }

  return (
    <div className="display-logs">
      <Table className="logs-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Utilisateur</th>
            <th>Écran</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            let details = {};
            try { details = JSON.parse(log.details || '{}'); } catch { /* ignore */ }

            return (
              <tr key={log.id}>
                <td className="log-date">
                  {new Date(log.created_at).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="log-action">{ACTION_LABELS[log.action] || log.action}</td>
                <td>{log.user_name || '—'}</td>
                <td>{log.screen_name || '—'}</td>
                <td className="log-details">
                  {details.name || details.filename || details.title || details.count != null ? `(${details.count} items)` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <div className="logs-pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} /> Précédent
          </button>
          <span>Page {page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Suivant <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(LogsTab);
