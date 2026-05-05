// ═══════════════════════════════════════════════════════════════
// ControlPerformModal.jsx — Modale "Effectuer un contrôle"
// ═══════════════════════════════════════════════════════════════
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  FormField,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@/design-system';

import api from '../../utils/api';
import { todayIso } from './utils';

export default function ControlPerformModal({ control, onClose, onDone }) {
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { performed_at: date, notes };
      if (nextDue) payload.next_due_date = nextDue;
      const r = await api.performControl(control.id, payload);
      if (!r?.success) throw new Error(r?.error || 'Erreur');
      onDone?.(r.data);
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <ModalHeader>
        <CheckCircle2 size={18} style={{ marginRight: 8 }} />
        Effectuer le contrôle — {control?.type_name}
      </ModalHeader>
      <ModalBody>
        <p style={{ marginTop: 0, color: '#475569', fontSize: 14 }}>
          {control?.entity_type === 'vehicle' ? 'Véhicule' : 'Équipement'} :{' '}
          <strong>{control?.entity_name || control?.entity_id}</strong>
        </p>
        <FormField label="Date d'exécution" required>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayIso()}
          />
        </FormField>
        <FormField
          label="Prochaine échéance (optionnel)"
          help={`Par défaut : date + ${control?.periodicity_days || 365} jours.`}
        >
          <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        </FormField>
        <FormField label="Notes / observations">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Garage, n° rapport, défauts constatés…"
          />
        </FormField>
        {error && (
          <div style={{ color: '#991b1b', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Annuler
        </Button>
        <Button variant="primary" onClick={submit} disabled={busy || !date}>
          {busy ? 'Enregistrement…' : 'Valider le contrôle'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
