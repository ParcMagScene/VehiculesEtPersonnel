// ═══════════════════════════════════════════════════════════════
// ControlHistoryModal.jsx — Historique d'un contrôle
// ═══════════════════════════════════════════════════════════════
import { History } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Modal, ModalBody, ModalHeader, Spinner } from '@/design-system';

import api from '../../utils/api';

export default function ControlHistoryModal({ control, onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getControlHistory(control.id);
        if (!alive) return;
        if (!r?.success) throw new Error(r?.error || 'Erreur');
        setItems(r.data || []);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [control.id]);

  return (
    <Modal open onClose={onClose} size="lg">
      <ModalHeader>
        <History size={18} style={{ marginRight: 8 }} />
        Historique — {control?.type_name}
      </ModalHeader>
      <ModalBody>
        {error && <div style={{ color: '#991b1b' }}>{error}</div>}
        {!items && !error && <Spinner />}
        {items && items.length === 0 && <div>Aucun historique.</div>}
        {items && items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: 8 }}>Date</th>
                <th style={{ padding: 8 }}>Statut</th>
                <th style={{ padding: 8 }}>Par</th>
                <th style={{ padding: 8 }}>Échéance</th>
                <th style={{ padding: 8 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{h.performed_at}</td>
                  <td style={{ padding: 8 }}>{h.status}</td>
                  <td style={{ padding: 8 }}>{h.performed_by_name || '—'}</td>
                  <td style={{ padding: 8 }}>{h.next_due_date || '—'}</td>
                  <td style={{ padding: 8, color: '#475569' }}>{h.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ModalBody>
    </Modal>
  );
}
