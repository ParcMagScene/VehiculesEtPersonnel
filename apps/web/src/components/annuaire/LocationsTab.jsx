import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';
import api from '../../utils/api';
import LocationDialog from '../vehicles/LocationDialog';
import { Button, Dialog, Input, Table, Spinner, SearchBar, Tooltip } from '@/design-system';
import { loadFromIndexedDB } from '../../utils/indexedDB';
import { useToast } from '../../hooks/useToast';

const LOCATION_TYPES = ['Salle de spectacle', 'Prestataire', 'Dépôt', 'Garage', 'Autre'];

function LocationsTab({ currentUser }) {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [companyAddress, setCompanyAddress] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

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
  }, []);

  useEffect(() => {
    loadLocations();
    loadFromIndexedDB('calendarConfig', {}).then(config => {
      setCompanyAddress(config.companyAddress || '');
    }).catch(() => {});
  }, [loadLocations]);

  const allLocations = companyAddress
    ? [{ id: 'company-hq', name: 'Siège', address: companyAddress, type: 'Dépôt', isCompanyLocation: true }, ...locations]
    : locations;

  const filtered = allLocations.filter(loc =>
    !searchTerm || loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) || loc.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grouped = {};
  LOCATION_TYPES.forEach(type => { grouped[type] = []; });
  filtered.forEach(loc => {
    const t = LOCATION_TYPES.includes(loc.type) ? loc.type : 'Autre';
    grouped[t].push(loc);
  });

  const handleSave = async () => {
    // LocationDialog gère le save API lui-même — on rafraîchit juste la liste
    await loadLocations();
  };

  const handleDelete = (loc) => {
    setConfirmDialog({
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
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  if (loading) {
    return <div className="annuaire-loading"><Spinner size="lg" /><p>Chargement...</p></div>;
  }

  return (
    <>
      {/* Toolbar */}
      <div className="annuaire-toolbar">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Rechercher un lieu..." />
        <div className="annuaire-toolbar-actions">
          <Button variant="primary" onClick={() => { setEditingLocation(null); setShowDialog(true); }}>
            <Plus size={15} /> Nouveau lieu
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="annuaire-header-stats">
        <span className="stat-badge location">{allLocations.length} lieux</span>
        {LOCATION_TYPES.map(t => {
          const count = grouped[t]?.length || 0;
          return count > 0 ? <span key={t} className="stat-badge">{count} {t.toLowerCase()}{count > 1 ? 's' : ''}</span> : null;
        })}
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
              {LOCATION_TYPES.map(type => {
                const locs = grouped[type];
                if (!locs || locs.length === 0) return null;
                return (
                  <React.Fragment key={type}>
                    <tr className="location-group-row">
                      <td colSpan={5}><strong>{type}</strong> ({locs.length})</td>
                    </tr>
                    {locs.map(loc => (
                      <tr key={loc.id} className={loc.isCompanyLocation ? 'company-location-row' : ''}>
                        <td className="name-cell">
                          <MapPin size={14} style={{ color: '#10b981', verticalAlign: -2, marginRight: 6 }} />
                          {loc.name}
                          {loc.isCompanyLocation && <span className="company-badge">Siège</span>}
                        </td>
                        <td><span className="location-type-badge">{loc.type}</span></td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.address || '—'}</td>
                        <td>
                          {loc.lat && loc.lng ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                              target="_blank" rel="noopener noreferrer"
                              className="coords-link"
                              onClick={e => e.stopPropagation()}
                            >
                              {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)} <ExternalLink size={12} />
                            </a>
                          ) : '—'}
                        </td>
                        <td>
                          {!loc.isCompanyLocation && (
                            <div className="actions-cell">
                              <Tooltip content="Modifier"><button onClick={() => { setEditingLocation(loc); setShowDialog(true); }}><Edit2 size={14} /></button></Tooltip>
                              {currentUser?.isAdmin && (
                                <Tooltip content="Supprimer"><Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(loc)}><Trash2 size={14} /></Button></Tooltip>
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
            <div className="annuaire-empty"><p>Aucun lieu trouvé</p></div>
          )}
        </div>
      </div>

      {showDialog && (
        <LocationDialog
          location={editingLocation}
          onSave={handleSave}
          onClose={() => { setShowDialog(false); setEditingLocation(null); }}
          companyAddress={companyAddress}
        />
      )}

      <Dialog
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.onConfirm}
        title={confirmDialog?.title || 'Confirmation'}
        variant={confirmDialog?.variant || 'confirm'}
        confirmLabel={confirmDialog?.confirmLabel || 'Oui'}
        cancelLabel={confirmDialog?.cancelLabel || 'Non'}
      >
        {confirmDialog?.message}
      </Dialog>
    </>
  );
}

export default React.memo(LocationsTab);
