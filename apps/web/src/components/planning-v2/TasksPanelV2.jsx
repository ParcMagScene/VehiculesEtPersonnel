// components/planning-v2/TasksPanelV2.jsx
//
// Tickets : T-P0-05 (lecture), T-P0-05b (mutations create/edit/delete).
//
// Composant lecture cursor-based sur GET /api/v2/planning/tasks +
// dialogs Create/Edit/Delete via POST/PUT/DELETE /api/v2/planning/tasks*.
// Se dégrade gracieusement si FEATURE_V2_PLANNING est off côté serveur.
//
// Aucun accès direct à la DB, aucun accès direct à v1. Aligné Design
// System (Button, Card, Table, Modal, FormField, Dialog, Spinner).

import './TasksPanelV2.css';

import PropTypes from 'prop-types';
import { useCallback, useMemo, useState } from 'react';

import { usePlanningTasksV2 } from '../../hooks/v2/usePlanningTasksV2';
import api from '../../utils/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Dialog from '../ui/Dialog';
import InlineAlert from '../ui/InlineAlert';
import { Spinner } from '../ui/Loader';
import Table from '../ui/Table';
import { TASK_SECTION_LABELS, TASK_STATUS_LABELS } from './planningV2Constants';
import TaskFormDialog from './TaskFormDialog';

const DEFAULT_LIMIT = 50;

/**
 * Normalise une erreur API v2 pour affichage utilisateur.
 * Le backend renvoie soit `{ error: string, code?: string, meta?: { issues?: [] } }`
 * dans `err.response.data`, soit une erreur réseau/parse générique.
 */
function extractApiError(err) {
  if (!err) return 'Erreur inconnue';
  const data = err.response?.data;
  if (data?.meta?.issues?.length) {
    return data.meta.issues.map((iss) => `${iss.field || 'champ'} : ${iss.message}`).join(' — ');
  }
  if (typeof data?.error === 'string' && data.error.length > 0) return data.error;
  if (typeof err.message === 'string' && err.message.length > 0) return err.message;
  return 'Erreur inconnue';
}

export default function TasksPanelV2({ initialFilters = {}, limit = DEFAULT_LIMIT }) {
  const [filters, _setFilters] = useState(initialFilters);
  const { items, loading, loadingMore, error, featureDisabled, hasMore, refresh, loadMore } =
    usePlanningTasksV2({ filters, limit });

  // ─── Dialogs (create / edit / delete) ───
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', task: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, task: null });
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState(null);

  const closeAllDialogs = useCallback(() => {
    setFormDialog({ open: false, mode: 'create', task: null });
    setDeleteDialog({ open: false, task: null });
    setMutationError(null);
  }, []);

  const openCreate = useCallback(() => {
    setMutationError(null);
    setFormDialog({ open: true, mode: 'create', task: null });
  }, []);

  const openEdit = useCallback((task) => {
    setMutationError(null);
    setFormDialog({ open: true, mode: 'edit', task });
  }, []);

  const openDelete = useCallback((task) => {
    setMutationError(null);
    setDeleteDialog({ open: true, task });
  }, []);

  const handleSubmitForm = useCallback(
    async (payload) => {
      setMutating(true);
      setMutationError(null);
      try {
        if (formDialog.mode === 'edit' && formDialog.task) {
          await api.updateV2Task(formDialog.task.id, payload);
        } else {
          await api.createV2Task(payload);
        }
        setFormDialog({ open: false, mode: 'create', task: null });
        await refresh();
      } catch (err) {
        setMutationError(extractApiError(err));
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [formDialog, refresh],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog.task) return;
    setMutating(true);
    setMutationError(null);
    try {
      await api.deleteV2Task(deleteDialog.task.id);
      setDeleteDialog({ open: false, task: null });
      await refresh();
    } catch (err) {
      setMutationError(extractApiError(err));
    } finally {
      setMutating(false);
    }
  }, [deleteDialog, refresh]);

  const columns = useMemo(
    () => [
      { key: 'date', label: 'Date', render: (_v, row) => row.date ?? '—' },
      { key: 'period', label: 'AM/PM', render: (_v, row) => row.period ?? '—' },
      {
        key: 'section',
        label: 'Section',
        render: (_v, row) => TASK_SECTION_LABELS[row.section] || row.section || '—',
      },
      { key: 'title', label: 'Titre', render: (_v, row) => row.title ?? '—' },
      {
        key: 'status',
        label: 'Statut',
        render: (_v, row) => TASK_STATUS_LABELS[row.status] || row.status || '—',
      },
      {
        key: '__actions',
        label: 'Actions',
        render: (_v, row) => (
          <div className="tasks-panel-v2__row-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(row)}
              aria-label={`Modifier la tâche ${row.title || row.id}`}
            >
              Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDelete(row)}
              aria-label={`Supprimer la tâche ${row.title || row.id}`}
            >
              Supprimer
            </Button>
          </div>
        ),
      },
    ],
    [openEdit, openDelete],
  );

  if (featureDisabled) {
    return (
      <Card className="tasks-panel-v2">
        <InlineAlert variant="info">
          Planning v2 non activé côté serveur (<code>FEATURE_V2_PLANNING</code> off). Aucune
          régression de la v1.
        </InlineAlert>
      </Card>
    );
  }

  return (
    <Card className="tasks-panel-v2">
      <header className="tasks-panel-v2__header">
        <h2 className="tasks-panel-v2__title">Tâches (Planning v2)</h2>
        <div className="tasks-panel-v2__actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={loading}
            aria-label="Rafraîchir la liste des tâches Planning v2"
          >
            Rafraîchir
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreate}
            aria-label="Créer une nouvelle tâche Planning v2"
          >
            Nouvelle tâche
          </Button>
        </div>
      </header>

      {error ? (
        <InlineAlert variant="danger" role="alert">
          Erreur lors du chargement : {error.message}
        </InlineAlert>
      ) : null}

      {mutationError && !formDialog.open && !deleteDialog.open ? (
        <InlineAlert variant="danger" role="alert">
          {mutationError}
        </InlineAlert>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="tasks-panel-v2__loading" role="status" aria-live="polite">
          <Spinner size="lg" />
          <span className="sr-only">Chargement…</span>
        </div>
      ) : (
        <Table
          columns={columns}
          data={items}
          rowKey={(row) => row.id}
          emptyMessage="Aucune tâche à afficher."
        />
      )}

      <footer className="tasks-panel-v2__footer">
        <span className="tasks-panel-v2__count">
          {items.length} tâche{items.length > 1 ? 's' : ''} chargée{items.length > 1 ? 's' : ''}
        </span>
        {hasMore ? (
          <Button
            variant="primary"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
            aria-label="Charger plus de tâches Planning v2"
          >
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </Button>
        ) : null}
      </footer>

      <TaskFormDialog
        open={formDialog.open}
        mode={formDialog.mode}
        initialTask={formDialog.task}
        submitting={mutating}
        submitError={formDialog.open ? mutationError : null}
        onClose={closeAllDialogs}
        onSubmit={handleSubmitForm}
      />

      <Dialog
        open={deleteDialog.open}
        onClose={closeAllDialogs}
        onConfirm={handleConfirmDelete}
        title="Supprimer cette tâche ?"
        variant="danger"
        destructive
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        loading={mutating}
      >
        {deleteDialog.task ? (
          <>
            <p>Cette action est irréversible.</p>
            <p>
              <strong>{deleteDialog.task.title || deleteDialog.task.id}</strong> —{' '}
              {deleteDialog.task.date}{' '}
              {deleteDialog.task.period ? `(${deleteDialog.task.period})` : ''}
            </p>
            {mutationError ? (
              <InlineAlert variant="danger" role="alert">
                {mutationError}
              </InlineAlert>
            ) : null}
          </>
        ) : null}
      </Dialog>
    </Card>
  );
}

TasksPanelV2.propTypes = {
  initialFilters: PropTypes.object,
  limit: PropTypes.number,
};
