// ============================================================
// ReservationEquipment.jsx — Équipements attachés à une réservation
// Composant à intégrer dans un modal de détail de réservation
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, Box, Search } from 'lucide-react';
import { Button, ModalLayout, Input, Tooltip } from '@/design-system';
import api from '../../utils/api';
import { formatDimensions, buildChargementUrlForReservation, openInChargement } from '../../utils/deepLinking';
import './ReservationEquipment.css';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

import { TIMING } from '../../constants';

export default function ReservationEquipment({ reservationId, _currentUser }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [data, setData] = useState({ items: [], summary: { count: 0, totalQuantity: 0, totalWeight: 0, totalVolume: 0 } });
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadEquipment = useCallback(async () => {
    if (!reservationId) return;
    setLoading(true);
    try {
      const result = await api.getReservationEquipment(reservationId);
      setData(result);
    } catch (e) {
      console.error('Erreur chargement équipements réservation:', e);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  const handleRemove = (linkId) => {
    confirm({
      title: 'Retirer',
      message: 'Retirer cet \xE9quipement de la r\xE9servation ?',
      variant: 'danger',
      confirmLabel: 'Retirer',
      onConfirm: async () => {
        try {
          await api.removeEquipmentFromReservation(reservationId, linkId);
          loadEquipment();
        } catch (e) {
          toast.error(e.message || 'Erreur');
        }
      },
    });
  };

  const handleOpenChargement = () => {
    const url = buildChargementUrlForReservation(reservationId);
    openInChargement(url);
  };

  const { items, summary } = data;

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Summary bar */}
      {items.length > 0 && (
        <div className="reservation-equipment-summary">
          <div className="summary-item">
            <span className="summary-value">{summary.totalQuantity}</span>
            <span className="summary-label">Éléments</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{summary.totalWeight} kg</span>
            <span className="summary-label">Poids total</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{summary.totalVolume} m³</span>
            <span className="summary-label">Volume total</span>
          </div>
          <div className="u-ml-auto">
            <Button variant="ghost" className="catalog-btn catalog-btn-3d" onClick={handleOpenChargement}>
              <Box size={16} /> Ouvrir dans Chargement 3D
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="u-flex u-gap-2 u-mb-3">
        <Button variant="primary" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus size={14} /> Ajouter du matériel
        </Button>
        {items.length > 0 && (
          <Button variant="ghost" className="catalog-btn catalog-btn-3d catalog-btn-sm" onClick={handleOpenChargement}>
            <Box size={14} /> Charger dans 3D
          </Button>
        )}
      </div>

      {/* Equipment list */}
      {loading ? (
        <div className="catalog-empty"><p>Chargement…</p></div>
      ) : items.length === 0 ? (
        <div className="catalog-empty" style={{ padding: '2rem 1rem' }}>
          <Package size={32} />
          <p>Aucun matériel assigné</p>
          <p className="empty-hint">Ajoutez des équipements du catalogue à cette réservation.</p>
        </div>
      ) : (
        <div className="reservation-equipment-list">
          {items.map(item => (
            <div key={item.id} className="reservation-equipment-item">
              <div className="eq-info">
                <div className="eq-name">{item.equipmentName || item.equipment_name}</div>
                <div className="eq-ref">{item.reference || '—'} · {formatDimensions(item.equipmentDimensions || item.equipment_dimensions)}</div>
                {(item.flightcaseName || item.flightcase_name) && (
                  <div className="eq-fc">
                    <Box size={12} /> FC: {item.flightcaseName || item.flightcase_name}
                  </div>
                )}
              </div>
              <span className="eq-qty">×{item.quantity}</span>
              {item.weight && <span className="u-text-secondary" style={{ fontSize: '0.8rem' }}>{item.weight * item.quantity} kg</span>}
              <Tooltip content="Retirer">
                <Button variant="danger" size="sm" iconOnly aria-label="Retirer" onClick={() => handleRemove(item.id)}>
                  <Trash2 size={14} />
                </Button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {/* Add equipment dialog */}
      {showAddDialog && (
        <AddEquipmentDialog
          reservationId={reservationId}
          onAdded={() => { setShowAddDialog(false); loadEquipment(); }}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {ConfirmDialogRenderer}
    </div>
  );
}

// ─── Dialog pour ajouter un équipement du catalogue ───
function AddEquipmentDialog({ reservationId, onAdded, onClose }) {
  const toast = useToast();
  const [catalogItems, setCatalogItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getCatalogEquipment({ search, limit: 20 });
        setCatalogItems(data.items || []);
      } catch (e) {
        console.error('Erreur recherche catalogue:', e);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(load, TIMING.DEBOUNCE_SEARCH);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAssign = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await api.assignEquipmentToReservation(reservationId, {
        equipment_id: selectedItem.id,
        quantity: parseInt(quantity) || 1,
      });
      onAdded();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="Ajouter du matériel"
      icon={<Plus size={20} />}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            disabled={!selectedItem || submitting}
          >
            {submitting ? 'Ajout…' : 'Ajouter'}
          </Button>
        </>
      }
    >
        <div className="catalog-modal-body">
          {/* Search */}
          <div className="catalog-form-group">
            <label>Rechercher dans le catalogue</label>
            <div className="u-relative">
              <Search size={16} className="u-absolute u-text-muted" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, référence…"
                style={{ paddingLeft: '2.25rem' }}
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div className="u-rounded" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--theme-border)' }}>
            {loading ? (
              <div className="u-text-center u-text-muted" style={{ padding: '1rem' }}>Recherche…</div>
            ) : catalogItems.length === 0 ? (
              <div className="u-text-center u-text-muted" style={{ padding: '1rem' }}>Aucun résultat</div>
            ) : (
              catalogItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    background: selectedItem?.id === item.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                    borderBottom: '1px solid var(--theme-border)',
                    borderLeft: selectedItem?.id === item.id ? '3px solid var(--theme-primary)' : '3px solid transparent',
                  }}
                >
                  <div className="u-font-semibold" style={{ fontSize: '0.9rem' }}>{item.name}</div>
                  <div className="u-text-secondary" style={{ fontSize: '0.8rem' }}>
                    {item.reference || 'Sans réf.'} · {item.family || ''} · {formatDimensions(item.dimensions)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quantity */}
          {selectedItem && (
            <div className="catalog-form-group u-mt-3">
              <label>Quantité pour « {selectedItem.name} »</label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ maxWidth: '120px' }} />
              {selectedItem.defaultFlightcaseId && (
                <div className="u-mt-1" style={{ fontSize: '0.8rem', color: '#059669' }}>
                  <Box size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Flight-case par défaut sera automatiquement assigné
                </div>
              )}
            </div>
          )}
        </div>
    </ModalLayout>
  );
}
