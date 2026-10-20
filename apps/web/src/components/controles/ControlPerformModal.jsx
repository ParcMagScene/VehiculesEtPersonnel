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
  Select,
  Textarea,
} from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { todayIso } from './utils';

export default function ControlPerformModal({ control, onClose, onDone }) {
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState('EFFECTUE');
  const [notes, setNotes] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { resetDirty, guardClose } = useDirtyForm(
    { date, status, notes, nextDue },
    { confirmer: confirm },
  );
  const handleSafeClose = guardClose(onClose);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { performed_at: date, status, notes };
      if (nextDue) payload.next_due_date = nextDue;
      const r = await api.performControl(control.id, payload);
      if (!r?.success) throw new Error(r?.error || 'Erreur');
      refreshBus.publish('controls');
      if (status === 'MANQUE') {
        refreshBus.publish('sav');
        refreshBus.publish('equipment');
      }
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
          <FormField label="Résultat du contrôle" required>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="EFFECTUE">Conforme — aucune intervention</option>
              <option value="MANQUE">Anomalie — intervention requise</option>
            </Select>
          </FormField>
          <FormField
            label="Prochaine échéance (optionnel)"
            hint={`Par défaut : date + ${control?.periodicity_days || 365} jours.`}
          >
            <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
          </FormField>
          <FormField
            label={status === 'MANQUE' ? 'Observations à traiter' : 'Notes / observations'}
            required={status === 'MANQUE'}
          >
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                status === 'MANQUE'
                  ? "Décrivez l'anomalie à traiter…"
                  : 'Garage, n° rapport, remarques…'
              }
            />
          </FormField>
          {error && <InlineAlert variant="error">{error}</InlineAlert>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={handleSafeClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant={status === 'MANQUE' ? 'danger' : 'success'}
            onClick={submit}
            disabled={busy || !date || (status === 'MANQUE' && !notes.trim())}
          >
            {busy
              ? 'Enregistrement…'
              : status === 'MANQUE'
                ? 'Enregistrer et demander une intervention'
                : 'Valider le contrôle'}
          </Button>
        </ModalFooter>
      </Modal>
      {ConfirmDialogRenderer}
    </>
  );
}
