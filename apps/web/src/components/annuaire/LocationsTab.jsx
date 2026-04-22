import './AnnuairePanel.css';

import { Edit2, ExternalLink, Map, MapPin, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, SearchBar, Spinner, Table, Tooltip } from '@/design-system';

import { STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { loadFromIndexedDB } from '../../utils/indexedDB';
import LocationsMapPanel from '../locations/LocationsMapPanel';
import LocationDialog from '../vehicles/LocationDialog';

const LOCATION_TYPES = ['Salle de spectacle', 'Prestataire', 'Dépôt', 'Garage', 'Autre'];

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
          <Table className="annuaire-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Adresse</th>
                <th>Coordonnées</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {LOCATION_TYPES.map((type) => {
                const locs = grouped[type];
                if (!locs || locs.length === 0) return null;
                return (
                  <React.Fragment key={type}>
                    <tr className="location-group-row">
                      <td colSpan={5}>
                        <strong>{type}</strong> ({locs.length})
                      </td>
                    </tr>
                    {locs.map((loc) => (
                      <tr
                        key={loc.id}
                        className={loc.isCompanyLocation ? 'company-location-row' : ''}
                      >
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
                    ))}
                  </React.Fragment>
                );
              })}
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
        <LocationsMapPanel
          locations={allLocations}
          onClose={() => setShowMapPanel(false)}
          onEditLocation={(loc) => {
            setShowMapPanel(false);
            setEditingLocation(loc);
            setShowDialog(true);
          }}
        />
      )}

      {ConfirmDialogRenderer}
    </div>
  );
}

export default React.memo(LocationsTab);
