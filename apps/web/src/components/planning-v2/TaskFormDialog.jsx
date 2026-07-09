// components/planning-v2/TaskFormDialog.jsx
//
// Ticket : T-P0-05b (UI mutations Planning v2).
//
// Formulaire modale de création / édition d'une tâche Planning v2.
// Consomme les méthodes `createV2Task` / `updateV2Task` de l'ApiClient
// (T-P0-04). En cas d'erreur backend (422 Zod, 400 transition invalide,
// 404 FEATURE_DISABLED), l'erreur est affichée à l'utilisateur.
//
// Contrat backend (rappel) :
//   - `date` requis à la création.
//   - `section` optionnel (défaut serveur = 'manual').
//   - Transitions statuts validées serveur — l'UI ne les duplique pas,
//     elle affiche simplement le message serveur en cas de rejet.

import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';

import Button from '../ui/Button';
import FormField from '../ui/FormField';
import InlineAlert from '../ui/InlineAlert';
import Input from '../ui/Input';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../ui/Modal';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import {
  TASK_PERIODS,
  TASK_SECTION_LABELS,
  TASK_SECTIONS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from './planningV2Constants';

const EMPTY_FORM = Object.freeze({
  date: '',
  period: '',
  section: 'manual',
  title: '',
  notes: '',
  status: 'pending',
  affaire_num: '',
  person_id: '',
  visible: true,
});

/**
 * Convertit le state form React vers un payload API v2 propre :
 *   - trim des strings
 *   - conversion "" → undefined pour omettre les champs vides
 *   - person_id parsé en entier si présent
 *   - visible en boolean
 *
 * @param {object} form
 * @param {'create' | 'edit'} mode
 * @returns {object}
 */
function buildPayload(form, mode) {
  const out = {};
  const trimStr = (v) => (typeof v === 'string' ? v.trim() : v);

  if (form.date) out.date = form.date;
  else if (mode === 'create') {
    // Le backend rejettera de toute façon (date required).
    out.date = '';
  }

  const period = trimStr(form.period);
  if (period) out.period = period;

  const section = trimStr(form.section);
  if (section) out.section = section;

  const title = trimStr(form.title);
  if (title) out.title = title;
  else if (mode === 'edit') out.title = null; // permet de vider explicitement

  const notes = typeof form.notes === 'string' ? form.notes : '';
  if (notes.length > 0) out.notes = notes;
  else if (mode === 'edit') out.notes = null;

  const status = trimStr(form.status);
  if (status) out.status = status;

  const affaire = trimStr(form.affaire_num);
  if (affaire) out.affaire_num = affaire;
  else if (mode === 'edit') out.affaire_num = null;

  const personRaw = trimStr(form.person_id);
  if (personRaw !== '' && personRaw !== undefined && personRaw !== null) {
    const pid = Number.parseInt(personRaw, 10);
    if (Number.isInteger(pid) && pid > 0) out.person_id = pid;
  } else if (mode === 'edit') {
    out.person_id = null;
  }

  out.visible = form.visible ? 1 : 0;

  return out;
}

export default function TaskFormDialog({
  open,
  mode,
  initialTask = null,
  onSubmit,
  onClose,
  submitting = false,
  submitError = null,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [localError, setLocalError] = useState(null);

  // Re-hydrate le form quand la dialog s'ouvre / change de tâche
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initialTask) {
      setForm({
        date: initialTask.date ?? '',
        period: initialTask.period ?? '',
        section: initialTask.section ?? 'manual',
        title: initialTask.title ?? '',
        notes: initialTask.notes ?? '',
        status: initialTask.status ?? 'pending',
        affaire_num: initialTask.affaire_num ?? '',
        person_id:
          initialTask.person_id !== null && initialTask.person_id !== undefined
            ? String(initialTask.person_id)
            : '',
        visible: initialTask.visible === 0 ? false : true,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setLocalError(null);
  }, [open, mode, initialTask]);

  const title = useMemo(() => (mode === 'edit' ? 'Modifier la tâche' : 'Nouvelle tâche'), [mode]);

  const setField = (field) => (event) => {
    const value =
      event && event.target
        ? event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value
        : event;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    if (!form.date) {
      setLocalError('La date est requise.');
      return;
    }
    const payload = buildPayload(form, mode);
    try {
      await onSubmit(payload);
    } catch (_error) {
      // L'erreur backend est gérée par le parent via `submitError`.
    }
  };

  const combinedError = localError || submitError;

  return (
    <Modal open={open} onClose={onClose} size="md" closeOnBackdrop={false}>
      <form onSubmit={handleSubmit} aria-label={title}>
        <ModalHeader onClose={onClose}>{title}</ModalHeader>
        <ModalBody>
          {combinedError ? (
            <InlineAlert variant="danger" role="alert">
              {combinedError}
            </InlineAlert>
          ) : null}

          <FormField label="Date" required>
            <Input
              type="date"
              size="md"
              value={form.date}
              onChange={setField('date')}
              required
              disabled={submitting}
            />
          </FormField>

          <FormField label="Période (AM/PM)">
            <Select
              size="md"
              value={form.period}
              onChange={setField('period')}
              disabled={submitting}
            >
              <option value="">—</option>
              {TASK_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Section">
            <Select
              size="md"
              value={form.section}
              onChange={setField('section')}
              disabled={submitting}
            >
              {TASK_SECTIONS.map((code) => (
                <option key={code} value={code}>
                  {TASK_SECTION_LABELS[code] || code}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Titre">
            <Input
              type="text"
              size="md"
              value={form.title}
              onChange={setField('title')}
              maxLength={500}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Notes">
            <Textarea
              size="md"
              rows={3}
              value={form.notes}
              onChange={setField('notes')}
              maxLength={5000}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Statut">
            <Select
              size="md"
              value={form.status}
              onChange={setField('status')}
              disabled={submitting}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s] || s}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Numéro d'affaire">
            <Input
              type="text"
              size="md"
              value={form.affaire_num}
              onChange={setField('affaire_num')}
              maxLength={64}
              disabled={submitting}
            />
          </FormField>

          <FormField label="ID Personnel (optionnel)">
            <Input
              type="number"
              size="md"
              min="1"
              step="1"
              value={form.person_id}
              onChange={setField('person_id')}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Visible sur écrans">
            <label className="tasks-panel-v2__checkbox">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={setField('visible')}
                disabled={submitting}
              />
              <span>Afficher cette tâche</span>
            </label>
          </FormField>
        </ModalBody>
        <ModalFooter align="end">
          <Button variant="secondary" onClick={onClose} disabled={submitting} type="button">
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={submitting}>
            {mode === 'edit' ? 'Enregistrer' : 'Créer'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

TaskFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['create', 'edit']).isRequired,
  initialTask: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  submitError: PropTypes.string,
};
