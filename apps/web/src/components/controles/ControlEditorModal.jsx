// ═══════════════════════════════════════════════════════════════
// ControlEditorModal.jsx — Créer / éditer un contrôle planifié
// ═══════════════════════════════════════════════════════════════
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Button,
  FormField,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Textarea,
} from '@/design-system';

import api from '../../utils/api';
import { todayIso } from './utils';

export default function ControlEditorModal({
  control = null,
  entityType, // 'vehicle' | 'equipment'
  entityId,
  onClose,
  onSaved,
}) {
  const isEdit = !!control;
  const [types, setTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [typeId, setTypeId] = useState(control?.control_type_id || '');
  const [periodicity, setPeriodicity] = useState(control?.periodicity_days || '');
  const [nextDue, setNextDue] = useState(control?.next_due_date || todayIso());
  const [lastDone, setLastDone] = useState(control?.last_done_date || '');
  const [assignedTo, setAssignedTo] = useState(control?.assigned_to || '');
  const [notes, setNotes] = useState(control?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [tRes, uRes] = await Promise.all([
        api.getControlTypes(true),
        api.request?.('/admin/users') ?? Promise.resolve({ success: true, data: [] }),
      ]);
      const tList = (tRes?.data || []).filter((t) =>
        entityType === 'vehicle' ? true : t.is_vehicle_specific === 0,
      );
      setTypes(tList);
      setUsers(uRes?.data || uRes?.users || []);
    })();
  }, [entityType]);

  useEffect(() => {
    if (!isEdit && typeId) {
      const t = types.find((x) => x.id === Number(typeId));
      if (t && !periodicity) setPeriodicity(t.default_periodicity_days);
    }
  }, [typeId, types, isEdit, periodicity]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        control_type_id: Number(typeId),
        periodicity_days: periodicity ? Number(periodicity) : undefined,
        next_due_date: nextDue,
        last_done_date: lastDone || null,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        notes,
      };
      let r;
      if (isEdit) {
        r = await api.updateControl(control.id, payload);
      } else {
        r = await api.createControl({
          ...payload,
          entity_type: entityType,
          entity_id: String(entityId),
        });
      }
      if (!r?.success) throw new Error(r?.error || 'Erreur');
      onSaved?.(r.data);
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
        <Pencil size={18} style={{ marginRight: 8 }} />
        {isEdit ? 'Modifier le contrôle' : 'Nouveau contrôle planifié'}
      </ModalHeader>
      <ModalBody>
        <FormField label="Type de contrôle" required>
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">— Choisir —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} · {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Périodicité (jours)" required>
          <Input
            type="number"
            min={1}
            value={periodicity}
            onChange={(e) => setPeriodicity(e.target.value)}
          />
        </FormField>
        <FormField label="Prochaine échéance" required>
          <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        </FormField>
        <FormField label="Dernière exécution (optionnel)">
          <Input type="date" value={lastDone} onChange={(e) => setLastDone(e.target.value)} />
        </FormField>
        <FormField label="Responsable (optionnel)">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">— Aucun —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.username || u.email}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
        <Button variant="primary" onClick={submit} disabled={busy || !typeId || !nextDue}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
