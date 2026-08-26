import './AnnuairePanel.css';

import { Edit2, ExternalLink, Map, MapPin, Plus, Trash2 } from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import {
  Button,
  SearchBar,
  Spinner,
  Table,
  Tooltip,
  useResizableColumns,
  useSortableData,
} from '@/design-system';

import { STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { loadFromIndexedDB } from '../../utils/indexedDB';
import { refreshBus } from '../../utils/refresh-bus';
import LocationDialog from '../vehicles/LocationDialog';

const LocationsMapPanel = lazy(() => import('../locations/LocationsMapPanel'));

const LOCATION_TYPES = [
  'Salle de spectacle',
  'Lycée',
  'Ecole',
  'Salle municipale',
  'Prestataire',
  'Dépôt',
  'Garage',
  'Autre',
];

function LocationsTab({ currentUser }) {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [companyAddress, setCompanyAddress] = useState('');
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const LOCATIONS_COLS = { name: 240, type: 140, address: 320, coords: 180, actions: 130 };
  const { getColProps, getResizerProps } = useResizableColumns('locations-list', LOCATIONS_COLS);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getLocations();
      setLocations(data);
    } catch (err) {
      console.error('Erreur chargement lieux:', err);
      toast.error('Erreur lors du chargement des lieux');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLocations();
    loadFromIndexedDB('calendarConfig', {})
      .then((config) => {
        setCompanyAddress(config.companyAddress || '');
      })
      .catch(() => {});
  }, [loadLocations]);

  useRefreshSubscription('annuaire', loadLocations);

  const allLocations = companyAddress
    ? [
        {
          id: 'company-hq',
          name: 'Siège',
          address: companyAddress,
          type: 'Dépôt',
          isCompanyLocation: true,
        },
        ...locations,
      ]
    : locations;

  const filtered = allLocations.filter(
    (loc) =>
      !searchTerm ||
      loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.address?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const { sorted, sortCol, getThProps, getSortIndicator } = useSortableData(filtered, {
    initialCol: null,
    getValue: (row, col) => {
      if (col === 'coords') {
        if (row.lat && row.lng) return Number(row.lat) * 1000 + Number(row.lng);
        return null;
      }
      return row[col];
    },
  });

  const grouped = {};
  LOCATION_TYPES.forEach((type) => {
    grouped[type] = [];
  });
  filtered.forEach((loc) => {
    const t = LOCATION_TYPES.includes(loc.type) ? loc.type : 'Autre';
    grouped[t].push(loc);
  });

  const handleSave = async () => {
    // LocationDialog gère le save API lui-même — on rafraîchit juste la liste
    await loadLocations();
  };

  const handleDelete = (loc) => {
    confirm({
      title: 'Supprimer le lieu',
      message: `Voulez-vous vraiment supprimer « ${loc.name} » ?`,
      onConfirm: async () => {
        try {
          await api.deleteLocation(loc.id);
          await loadLocations();
          refreshBus.publish('annuaire');
          toast.success('Lieu supprimé');
        } catch (err) {
          toast.error(`Erreur: ${err.message}`);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="annuaire-loading">
        <Spinner size="lg" />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div
      className="locations-tab"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div className="annuaire-toolbar">
        <div className="annuaire-toolbar-actions-row">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher un lieu..."
          />
          <div className="annuaire-toolbar-actions">
            <Button
              variant="secondary"
              onClick={() => setShowMapPanel(true)}
              title="Voir sur la carte"
            >
              <Map size={15} /> Carte
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingLocation(null);
                setShowDialog(true);
              }}
            >
              <Plus size={15} /> Nouveau lieu
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="annuaire-content">
        <div className="annuaire-table-wrapper">
          <Table className="annuaire-table app-data-table">
            <colgroup>
              <col {...getColProps('name')} />
              <col {...getColProps('type')} />
              <col {...getColProps('address')} />
              <col {...getColProps('coords')} />
              <col {...getColProps('actions')} />
            </colgroup>
            <thead>
              <tr>
                <th {...getThProps('name')}>
                  Nom<span className="app-sort-indicator">{getSortIndicator('name')}</span>
                  <span {...getResizerProps('name')} />
                </th>
                <th {...getThProps('type')}>
                  Type<span className="app-sort-indicator">{getSortIndicator('type')}</span>
                  <span {...getResizerProps('type')} />
                </th>
                <th {...getThProps('address')}>
                  Adresse<span className="app-sort-indicator">{getSortIndicator('address')}</span>
                  <span {...getResizerProps('address')} />
                </th>
                <th {...getThProps('coords')}>
                  Coordonnées
                  <span className="app-sort-indicator">{getSortIndicator('coords')}</span>
                  <span {...getResizerProps('coords')} />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const renderRow = (loc) => (
                  <tr key={loc.id} className={loc.isCompanyLocation ? 'company-location-row' : ''}>
                    <td className="name-cell">
                      <MapPin
                        size={14}
                        style={{
                          color: STATUS_COLORS.success,
                          verticalAlign: -2,
                          marginRight: 6,
                        }}
                      />
                      {loc.name}
                      {loc.isCompanyLocation && <span className="company-badge">Siège</span>}
                    </td>
                    <td>
                      <span className="location-type-badge">{loc.type}</span>
                    </td>
                    <td
                      style={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {loc.address || '—'}
                    </td>
                    <td>
                      {loc.lat && loc.lng ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="coords-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}{' '}
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {!loc.isCompanyLocation && (
                        <div className="actions-cell">
                          <Tooltip content="Modifier">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingLocation(loc);
                                setShowDialog(true);
                              }}
                            >
                              <Edit2 size={14} />
                            </Button>
                          </Tooltip>
                          {currentUser?.isAdmin && (
                            <Tooltip content="Supprimer">
                              <Button
                                variant="danger"
                                size="sm"
                                iconOnly
                                aria-label="Supprimer le lieu"
                                onClick={() => handleDelete(loc)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
                if (sortCol) {
                  // Tri actif : liste plate triée, sans groupes
                  return sorted.map(renderRow);
                }
                return LOCATION_TYPES.map((type) => {
                  const locs = grouped[type];
                  if (!locs || locs.length === 0) return null;
                  return (
                    <React.Fragment key={type}>
                      <tr className="location-group-row">
                        <td colSpan={5}>
                          <strong>{type}</strong> ({locs.length})
                        </td>
                      </tr>
                      {locs.map(renderRow)}
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </Table>
          {filtered.length === 0 && (
            <div className="annuaire-empty">
              <p>Aucun lieu trouvé</p>
            </div>
          )}
        </div>
      </div>

      {showDialog && (
        <LocationDialog
          location={editingLocation}
          onSave={handleSave}
          onClose={() => {
            setShowDialog(false);
            setEditingLocation(null);
          }}
          companyAddress={companyAddress}
        />
      )}

      {showMapPanel && (
        <Suspense
          fallback={
            <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement de la carte…</div>
          }
        >
          <LocationsMapPanel
            locations={allLocations}
            onClose={() => setShowMapPanel(false)}
            onEditLocation={(loc) => {
              setShowMapPanel(false);
              setEditingLocation(loc);
              setShowDialog(true);
            }}
          />
        </Suspense>
      )}

      {ConfirmDialogRenderer}
    </div>
  );
}

export default React.memo(LocationsTab);
