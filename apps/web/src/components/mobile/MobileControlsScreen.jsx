// ═══════════════════════════════════════════════════════════════
// MobileControlsScreen.jsx — Écran contrôles périodiques mobile
// (utilisé depuis MobileEquipmentQR)
// ═══════════════════════════════════════════════════════════════
import { ArrowLeft, CheckCircle2, Loader, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, InlineAlert, Input, Spinner, Textarea } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const STATUS_LABELS = {
  A_FAIRE: 'À faire',
  EN_RETARD: 'En retard',
  MANQUE: 'Manqué',
};
const STATUS_BG = {
  A_FAIRE: '#dbeafe',
  EN_RETARD: '#fef3c7',
  MANQUE: '#fee2e2',
};
const STATUS_FG = {
  A_FAIRE: '#1e40af',
  EN_RETARD: '#92400e',
  MANQUE: '#991b1b',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MobileControlsScreen({ entityType, entityId, entityLabel, onBack }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // contrôle en cours d'exécution
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const r = await api.getControlsForEntity(entityType, entityId);
      if (!r?.success) throw new Error(r?.error || 'Erreur');
      setItems(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const submitPerform = async () => {
    if (!editing || !date) return;
    setSubmitting(true);
    try {
      const r = await api.performControl(editing.id, { performed_at: date, notes });
      if (!r?.success) throw new Error(r?.error || 'Erreur');
      toast.success('Contrôle enregistré');
      setEditing(null);
      setNotes('');
      setDate(todayIso());
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (editing) {
    return (
      <div className="m-eq-qr">
        <div className="m-eq-qr-header">
          <Button variant="ghost" onClick={() => setEditing(null)} aria-label="Retour">
            <ArrowLeft size={20} />
          </Button>
          <h2>Effectuer contrôle</h2>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <strong>{editing.type_code}</strong> — {editing.type_name}
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{entityLabel}</div>

          <label style={{ fontSize: 13 }}>Date d'exécution</label>
          <Input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
          />

          <label style={{ fontSize: 13 }}>Notes</label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Garage, observations…"
          />

          <Button variant="primary" onClick={submitPerform} disabled={submitting || !date}>
            {submitting ? <Loader size={16} className="spin" /> : <CheckCircle2 size={16} />}
            Valider le contrôle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-eq-qr">
      <div className="m-eq-qr-header">
        <Button variant="ghost" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>
          <ShieldCheck size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
          Contrôles
        </h2>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12, color: '#475569', fontSize: 13 }}>{entityLabel}</div>

        {error && <InlineAlert type="error">{error}</InlineAlert>}
        {!items && !error && <Spinner />}
        {items && items.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
            Aucun contrôle planifié.
          </div>
        )}

        {items && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((c) => (
              <div
                key={c.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 12,
                  background: '#fff',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.type_code}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{c.type_name}</div>
                  </div>
                  <span
                    style={{
                      background: STATUS_BG[c.status] || '#f1f5f9',
                      color: STATUS_FG[c.status] || '#475569',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
                  Échéance : <strong>{c.next_due_date || '—'}</strong>
                  {c.last_done_date && ` · Dernier : ${c.last_done_date}`}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  style={{ marginTop: 10, width: '100%' }}
                  onClick={() => setEditing(c)}
                >
                  <CheckCircle2 size={14} /> Effectuer
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
