/**
 * SAVTicketDetails — Vue détail d'un ticket SAV avec édition + historique.
 *
 * Permet à un admin de :
 *  - changer le statut (les valeurs autorisées proviennent du backend)
 *  - éditer notes, résolution, coût
 *  - voir l'historique field-level (qui/quand/source eM@g vs LocMat)
 */
import { useEffect, useState } from 'react';

import { Button, InlineAlert, Spinner } from '@/design-system';

import api from '../../utils/api';

const STATUS_OPTIONS = [
  { value: 'open', label: 'OUVERT' },
  { value: 'in_progress', label: 'EN_COURS' },
  { value: 'waiting_parts', label: 'ATTENTE_PIECE' },
  { value: 'resolved', label: 'RESOLU' },
  { value: 'sortie_sav', label: 'SORTIE_SAV' },
  { value: 'closed', label: 'CLOTURE' },
];

const labelStyle = { display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 };
const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 13,
};
// Styles partagés table historique (extraits de 6+ inline styles dupliqués)
const histThStyle = {
  padding: '6px 8px',
  background: '#f8fafc',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
};
const histTdStyle = { padding: '4px 8px', borderBottom: '1px solid #f1f5f9' };

export default function SAVTicketDetails({ ticketId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ status: '', notes: '', resolution: '', cost: '' });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.getSavTicketV2(ticketId);
      if (!resp.success) throw new Error(resp.error || 'Erreur');
      setData(resp);
      setForm({
        status: resp.ticket.status || '',
        notes: resp.ticket.notes || '',
        resolution: resp.ticket.resolution || '',
        cost: resp.ticket.cost != null ? String(resp.ticket.cost) : '',
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {};
      if (form.status !== data.ticket.status) payload.status = form.status;
      if (form.notes !== (data.ticket.notes || '')) payload.notes = form.notes;
      if (form.resolution !== (data.ticket.resolution || '')) payload.resolution = form.resolution;
      const newCost = form.cost === '' ? null : parseFloat(form.cost);
      const oldCost = data.ticket.cost != null ? Number(data.ticket.cost) : null;
      if (newCost !== oldCost) payload.cost = newCost;

      if (Object.keys(payload).length === 0) {
        setError('Aucune modification à enregistrer');
        return;
      }
      const resp = await api.patchSavTicket(ticketId, payload);
      if (!resp.success) throw new Error(resp.error || 'Erreur enregistrement');
      await reload();
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="u-p-8 u-text-center">
        <Spinner /> Chargement du ticket…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="u-p-4">
        <InlineAlert type="error">{error || 'Ticket introuvable'}</InlineAlert>
        <Button onClick={onClose}>Fermer</Button>
      </div>
    );
  }

  const { ticket, history, statusLabels } = data;

  return (
    <div className="u-p-4">
      <div className="u-flex-between u-mb-3">
        <h3 style={{ margin: 0 }}>
          Ticket SAV #{ticket.id}{' '}
          <small className="u-text-secondary" style={{ fontWeight: 400 }}>
            {ticket.locmat_code ? `· ${ticket.locmat_code}` : ''}
          </small>
        </h3>
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
      </div>

      {/* Infos en lecture seule */}
      <div
        className="u-mb-4"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          padding: 12,
          background: '#f8fafc',
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <div>
          <strong>Équipement :</strong>
          <br />
          {ticket.equipment_name || '—'}
          {ticket.equipment_reference && (
            <small className="u-text-secondary"> · {ticket.equipment_reference}</small>
          )}
        </div>
        <div>
          <strong>SN / UID :</strong>
          <br />
          {ticket.serial_number || '—'} / {ticket.uid || '—'}
        </div>
        <div>
          <strong>Source :</strong> {ticket.last_modified_source || 'emag'}
          <br />
          <small>
            Modifié le{' '}
            {ticket.last_modified_at
              ? new Date(ticket.last_modified_at).toLocaleString('fr-FR')
              : '—'}
          </small>
        </div>
        <div>
          <strong>Entrée :</strong> {ticket.opened_at ? ticket.opened_at.slice(0, 10) : '—'}
        </div>
        <div>
          <strong>Sortie :</strong> {ticket.closed_at ? ticket.closed_at.slice(0, 10) : '—'}
        </div>
        <div>
          <strong>Titre :</strong> {ticket.title}
        </div>
      </div>

      {/* Édition */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Statut</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {statusLabels?.[o.value] || o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Coût (€)</label>
          <input
            type="number"
            step="0.01"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Notes internes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            style={inputStyle}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Résolution</label>
          <textarea
            value={form.resolution}
            onChange={(e) => setForm({ ...form, resolution: e.target.value })}
            rows={2}
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div className="u-mb-3">
          <InlineAlert type="error">{error}</InlineAlert>
        </div>
      )}

      <div className="u-flex u-gap-2 u-justify-end" style={{ marginBottom: 24 }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size="sm" /> : 'Enregistrer'}
        </Button>
      </div>

      {/* Historique */}
      <h4 style={{ margin: '16px 0 8px 0' }}>Historique ({history.length})</h4>
      <div className="u-overflow-auto u-border u-radius-md" style={{ maxHeight: 300 }}>
        <table className="u-table-base" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={histThStyle}>Date</th>
              <th style={histThStyle}>Champ</th>
              <th style={histThStyle}>Avant</th>
              <th style={histThStyle}>Après</th>
              <th style={histThStyle}>Source</th>
              <th style={histThStyle}>Par</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="u-p-4 u-text-center u-text-muted">
                  Aucune modification enregistrée.
                </td>
              </tr>
            )}
            {history.map((h) => (
              <tr key={h.id}>
                <td style={histTdStyle}>{new Date(h.timestamp).toLocaleString('fr-FR')}</td>
                <td style={histTdStyle}>{h.field}</td>
                <td style={histTdStyle}>{h.old_value || '—'}</td>
                <td style={histTdStyle}>{h.new_value || '—'}</td>
                <td style={histTdStyle}>
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: h.source === 'locmat' ? '#fef3c7' : '#dbeafe',
                      fontSize: 10,
                    }}
                  >
                    {h.source}
                  </span>
                </td>
                <td style={histTdStyle}>
                  {h.user_name || (h.import_id ? `import #${h.import_id}` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
