/**
 * SAVTicketList — Liste centrale des tickets SAV avec filtres.
 *
 * Filtres : statut (multi-select), recherche libre (titre/SN/UID/LocMat/équipement).
 * Clic sur une ligne → callback `onSelect(ticketId)` (le parent ouvre les détails).
 */
import { useEffect, useState } from 'react';

import { Spinner } from '@/design-system';

import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import api from '../../utils/api';

const STATUS_OPTIONS = [
  { value: 'open', label: 'OUVERT' },
  { value: 'in_progress', label: 'EN_COURS' },
  { value: 'waiting_parts', label: 'ATTENTE_PIECE' },
  { value: 'resolved', label: 'RESOLU' },
  { value: 'sortie_sav', label: 'SORTIE_SAV' },
  { value: 'closed', label: 'CLOTURE' },
];

const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 };
const th = { ...td, fontWeight: 600, background: '#f8fafc', textAlign: 'left' };

export default function SAVTicketList({ onSelect, refreshKey = 0 }) {
  const [statuses, setStatuses] = useState(['open', 'in_progress', 'waiting_parts']);
  const [q, setQ] = useState('');
  const [tickets, setTickets] = useState([]);
  const [statusLabels, setStatusLabels] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busTick, setBusTick] = useState(0);

  useRefreshSubscription('sav', () => setBusTick((t) => t + 1));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {};
        if (statuses.length > 0) params.status = statuses.join(',');
        if (q.trim()) params.q = q.trim();
        const resp = await api.getSavTicketsV2(params);
        if (cancelled) return;
        if (!resp.success) throw new Error(resp.error || 'Erreur chargement');
        setTickets(resp.tickets);
        setStatusLabels(resp.statusLabels || {});
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [statuses, q, refreshKey, busTick]);

  const toggleStatus = (s) => {
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  return (
    <div className="u-p-4">
      <div className="u-flex u-gap-6 u-mb-3" style={{ alignItems: 'flex-end' }}>
        <div className="u-flex-1">
          <label className="u-font-xs u-text-secondary">Recherche</label>
          <input
            type="text"
            value={q}
            placeholder="Titre, SN, UID, code LocMat, équipement…"
            onChange={(e) => setQ(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 13,
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {STATUS_OPTIONS.map((o) => {
          const active = statuses.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => toggleStatus(o.value)}
              style={{
                padding: '4px 10px',
                border: '1px solid ' + (active ? '#3b82f6' : '#e5e7eb'),
                borderRadius: 4,
                background: active ? '#3b82f6' : '#fff',
                color: active ? '#fff' : '#374151',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {error && <div className="u-text-danger u-mb-2">{error}</div>}

      <div className="u-border u-radius-md u-overflow-auto" style={{ maxHeight: 600 }}>
        <table className="u-table-base">
          <thead>
            <tr>
              <th style={th}>Ticket</th>
              <th style={th}>LocMat</th>
              <th style={th}>Équipement</th>
              <th style={th}>SN / UID</th>
              <th style={th}>Statut</th>
              <th style={th}>Entrée</th>
              <th style={th}>Sortie</th>
              <th style={th}>Coût</th>
              <th style={th}>Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td style={td} colSpan={9}>
                  <Spinner size="sm" /> Chargement…
                </td>
              </tr>
            )}
            {!loading && tickets.length === 0 && (
              <tr>
                <td className="u-text-center u-text-muted" style={td} colSpan={9}>
                  Aucun ticket.
                </td>
              </tr>
            )}
            {!loading &&
              tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelect && onSelect(t.id)}
                  className="u-cursor-pointer"
                >
                  <td style={td}>#{t.id}</td>
                  <td style={td}>{t.locmat_code || '—'}</td>
                  <td style={td}>
                    {t.equipment_name || <span className="u-text-danger">non lié</span>}
                  </td>
                  <td style={td}>{t.serial_number || t.uid || '—'}</td>
                  <td style={td}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#f1f5f9',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {statusLabels[t.status] || t.status}
                    </span>
                  </td>
                  <td style={td}>{t.opened_at ? t.opened_at.slice(0, 10) : '—'}</td>
                  <td style={td}>{t.closed_at ? t.closed_at.slice(0, 10) : '—'}</td>
                  <td style={td}>{t.cost != null ? Number(t.cost).toFixed(2) + ' €' : '—'}</td>
                  <td style={td}>
                    <small className="u-text-secondary">{t.last_modified_source || 'emag'}</small>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
