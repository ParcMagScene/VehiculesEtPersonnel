// ═══════════════════════════════════════════════════════════════
// ControlPerformModal.jsx — Modale "Effectuer un contrôle"
// ═══════════════════════════════════════════════════════════════
import './ControlPerformModal.css';

import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  FormField,
  InlineAlert,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { todayIso } from './utils';

export default function ControlPerformModal({ control, onClose, onDone }) {
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { resetDirty, guardClose } = useDirtyForm({ date, notes, nextDue }, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { performed_at: date, notes };
      if (nextDue) payload.next_due_date = nextDue;
      const r = await api.performControl(control.id, payload);
      if (!r?.success) throw new Error(r?.error || 'Erreur');
      refreshBus.publish('controls');
      resetDirty();
      onDone?.(r.data);
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal open onClose={handleSafeClose} size="md">
        <ModalHeader
          icon={<CheckCircle2 size={18} className="ctrl-perform-header-icon" />}
          onClose={handleSafeClose}
        >
          Effectuer le contrôle — {control?.type_name}
        </ModalHeader>
        <ModalBody>
          <p className="ctrl-perform-entity">
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
            hint={`Par défaut : date + ${control?.periodicity_days || 365} jours.`}
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
          {error && <InlineAlert variant="error">{error}</InlineAlert>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={handleSafeClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="success" onClick={submit} disabled={busy || !date}>
            {busy ? 'Enregistrement…' : 'Valider le contrôle'}
          </Button>
        </ModalFooter>
      </Modal>
      {ConfirmDialogRenderer}
    </>
  );
}
