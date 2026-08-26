// ============================================================
// ReservationEquipment.jsx — Équipements attachés à une réservation
// Composant à intégrer dans un modal de détail de réservation
// ============================================================

import './ReservationEquipment.css';

import { Box, Package, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button, Input, ModalLayout, Tooltip } from '@/design-system';

import { TIMING } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import {
  buildChargementUrlForReservation,
  formatDimensions,
  openInChargement,
} from '../../utils/deepLinking';

export default function ReservationEquipment({ reservationId, _currentUser }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [data, setData] = useState({
    items: [],
    summary: { count: 0, totalQuantity: 0, totalWeight: 0, totalVolume: 0 },
  });
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

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

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
    <div className="reservation-equipment-root">
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
            <Button
              variant="ghost"
              className="catalog-btn catalog-btn-3d"
              onClick={handleOpenChargement}
            >
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
          <Button
            variant="ghost"
            className="catalog-btn catalog-btn-3d catalog-btn-sm"
            onClick={handleOpenChargement}
          >
            <Box size={14} /> Charger dans 3D
          </Button>
        )}
      </div>

      {/* Equipment list */}
      {loading ? (
        <div className="catalog-empty">
          <p>Chargement…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="catalog-empty catalog-empty-spacious">
          <Package size={32} />
          <p>Aucun matériel assigné</p>
          <p className="empty-hint">Ajoutez des équipements du catalogue à cette réservation.</p>
        </div>
      ) : (
        <div className="reservation-equipment-list">
          {items.map((item) => (
            <div key={item.id} className="reservation-equipment-item">
              <div className="eq-info">
                <div className="eq-name">{item.equipmentName || item.equipment_name}</div>
                <div className="eq-ref">
                  {item.reference || '—'} ·{' '}
                  {formatDimensions(item.equipmentDimensions || item.equipment_dimensions)}
                </div>
                {(item.flightcaseName || item.flightcase_name) && (
                  <div className="eq-fc">
                    <Box size={12} /> FC: {item.flightcaseName || item.flightcase_name}
                  </div>
                )}
              </div>
              <span className="eq-qty">×{item.quantity}</span>
              {item.weight && (
                <span className="u-text-secondary reservation-equipment-weight">
                  {item.weight * item.quantity} kg
                </span>
              )}
              <Tooltip content="Retirer">
                <Button
                  variant="danger"
                  size="sm"
                  iconOnly
                  aria-label="Retirer"
                  onClick={() => handleRemove(item.id)}
                >
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
          onAdded={() => {
            setShowAddDialog(false);
            loadEquipment();
          }}
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
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleAssign} disabled={!selectedItem || submitting}>
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
            <Search size={16} className="u-absolute u-text-muted catalog-search-icon" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, référence…"
              className="catalog-search-input"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="u-rounded catalog-results">
          {loading ? (
            <div className="u-text-center u-text-muted catalog-result-empty-state">Recherche…</div>
          ) : catalogItems.length === 0 ? (
            <div className="u-text-center u-text-muted catalog-result-empty-state">
              Aucun résultat
            </div>
          ) : (
            catalogItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedItem(item);
                  }
                }}
                className={`catalog-result-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
              >
                <div className="u-font-semibold catalog-result-name">{item.name}</div>
                <div className="u-text-secondary catalog-result-meta">
                  {item.reference || 'Sans réf.'} · {item.family || ''} ·{' '}
                  {formatDimensions(item.dimensions)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quantity */}
        {selectedItem && (
          <div className="catalog-form-group u-mt-3">
            <label>Quantité pour « {selectedItem.name} »</label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="catalog-quantity-input"
            />
            {selectedItem.defaultFlightcaseId && (
              <div className="u-mt-1 catalog-flightcase-hint">
                <Box size={12} className="catalog-flightcase-hint-icon" />
                Flight-case par défaut sera automatiquement assigné
              </div>
            )}
          </div>
        )}
      </div>
    </ModalLayout>
  );
}
