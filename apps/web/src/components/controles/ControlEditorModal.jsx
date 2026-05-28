// ═══════════════════════════════════════════════════════════════
// ControlEditorModal.jsx — Créer / éditer un contrôle planifié
// ═══════════════════════════════════════════════════════════════
import { Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import { todayIso } from './utils';

export default function ControlEditorModal({
  control = null,
  entityType, // 'vehicle' | 'equipment'
  entityId,
  onClose,
  onSaved,
}) {
  const isEdit = !!control;
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
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

  const formSnapshot = useMemo(
    () => ({ typeId, periodicity, nextDue, lastDone, assignedTo, notes }),
    [typeId, periodicity, nextDue, lastDone, assignedTo, notes],
  );
  const { guardClose } = useDirtyForm(formSnapshot, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

  useEffect(() => {
    // Chargements indépendants : si /admin/users échoue (non admin), on
    // garde quand même les types. Bug 2026-05-28 : Promise.all rejetait
    // silencieusement → select Type de contrôle vide.
    api
      .getControlTypes(true)
      .then((tRes) => {
        const tList = (tRes?.data || []).filter((t) =>
          entityType === 'vehicle' ? true : t.is_vehicle_specific === 0,
        );
        setTypes(tList);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[ControlEditorModal] getControlTypes échec:', e?.message);
        setTypes([]);
      });
    (api.request?.('/admin/users') ?? Promise.resolve({ success: true, data: [] }))
      .then((uRes) => setUsers(uRes?.data || uRes?.users || []))
      .catch(() => setUsers([]));
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
      refreshBus.publish('controls');
      onSaved?.(r.data);
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={handleSafeClose} size="md">
      <ModalHeader>
        <Pencil size={18} style={{ marginRight: 8 }} />
        {isEdit ? 'Modifier le contrôle' : 'Nouveau contrôle planifié'}
      </ModalHeader>
      <ModalBody>
        <FormField label="Type de contrôle" required>
          <Select size="md" fullWidth value={typeId} onChange={(e) => setTypeId(e.target.value)}>
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
            size="md"
            type="number"
            min={1}
            value={periodicity}
            onChange={(e) => setPeriodicity(e.target.value)}
          />
        </FormField>
        <FormField label="Prochaine échéance" required>
          <Input
            size="md"
            type="date"
            value={nextDue}
            onChange={(e) => setNextDue(e.target.value)}
          />
        </FormField>
        <FormField label="Dernière exécution (optionnel)">
          <Input
            size="md"
            type="date"
            value={lastDone}
            onChange={(e) => setLastDone(e.target.value)}
          />
        </FormField>
        <FormField label="Responsable (optionnel)">
          <Select
            size="md"
            fullWidth
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">— Aucun —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.username || u.email}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Textarea size="md" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        {error && (
          <div style={{ color: '#991b1b', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={handleSafeClose} disabled={busy}>
          Annuler
        </Button>
        <Button variant="primary" onClick={submit} disabled={busy || !typeId || !nextDue}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </ModalFooter>
      {ConfirmDialogRenderer}
    </Modal>
  );
}
