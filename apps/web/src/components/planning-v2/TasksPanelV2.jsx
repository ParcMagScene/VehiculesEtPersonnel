// components/planning-v2/TasksPanelV2.jsx
//
// Ticket : T-P0-05 (UI TaskPlanningPanel v2 — lecture).
//
// Composant lecture cursor-based sur GET /api/v2/planning/tasks.
// Se dégrade gracieusement si FEATURE_V2_PLANNING est off côté serveur.
//
// Aucun accès direct à la DB, aucun accès direct à v1. Toutes les
// mutations UI (create/update/delete) seront apportées par un ticket
// suivant (T-P0-05b). Ce composant est intentionnellement minimal et
// aligné sur le Design System (Button, Card, Table).

import './TasksPanelV2.css';

import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

import { usePlanningTasksV2 } from '../../hooks/v2/usePlanningTasksV2';
import Button from '../ui/Button';
import Card from '../ui/Card';
import InlineAlert from '../ui/InlineAlert';
import { Spinner } from '../ui/Loader';
import Table from '../ui/Table';

const DEFAULT_LIMIT = 50;

export default function TasksPanelV2({ initialFilters = {}, limit = DEFAULT_LIMIT }) {
  const [filters, _setFilters] = useState(initialFilters);
  const { items, loading, loadingMore, error, featureDisabled, hasMore, refresh, loadMore } =
    usePlanningTasksV2({ filters, limit });

  const columns = useMemo(
    () => [
      { key: 'date', label: 'Date', render: (_value, row) => row.date ?? '—' },
      { key: 'period', label: 'AM/PM', render: (_value, row) => row.period ?? '—' },
      { key: 'section', label: 'Section', render: (_value, row) => row.section ?? '—' },
      { key: 'title', label: 'Titre', render: (_value, row) => row.title ?? '—' },
      { key: 'status', label: 'Statut', render: (_value, row) => row.status ?? '—' },
    ],
    [],
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
        </div>
      </header>

      {error ? (
        <InlineAlert variant="danger" role="alert">
          Erreur lors du chargement : {error.message}
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
    </Card>
  );
}

TasksPanelV2.propTypes = {
  initialFilters: PropTypes.object,
  limit: PropTypes.number,
};
