// ═══════════════════════════════════════════════════════════════
// ControlHistoryModal.jsx — Historique d'un contrôle
// ═══════════════════════════════════════════════════════════════
import { History } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Modal, ModalBody, ModalHeader, Spinner, Table } from '@/design-system';

import api from '../../utils/api';

const HISTORY_COLUMNS = [
  { key: 'performed_at', label: 'Date' },
  { key: 'status', label: 'Statut' },
  { key: 'performed_by_name', label: 'Par' },
  { key: 'next_due_date', label: 'Échéance' },
  { key: 'notes', label: 'Notes' },
];

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
      <ModalHeader icon={<History size={18} />} onClose={onClose}>
        Historique — {control?.type_name}
      </ModalHeader>
      <ModalBody>
        {error && <div style={{ color: '#991b1b' }}>{error}</div>}
        {!items && !error && <Spinner />}
        {items && (
          <Table
            columns={HISTORY_COLUMNS}
            data={items.map((h) => ({
              id: h.id,
              performed_at: h.performed_at,
              status: h.status,
              performed_by_name: h.performed_by_name || '—',
              next_due_date: h.next_due_date || '—',
              notes: h.notes || '',
            }))}
            emptyMessage="Aucun historique."
            compact
          />
        )}
      </ModalBody>
    </Modal>
  );
}
