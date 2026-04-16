import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Hash,
  Tag,
  Clipboard,
  Package,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle,
  Wrench,
  ChevronRight,
  Star,
  Eye,
  QrCode,
  Map,
  ExternalLink,
  Edit2,
  Trash2,
  Printer,
  FileText,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  EQUIPMENT_STATUS,
  SAV_STATUS,
  SAV_PRIORITY,
  SAV_TYPES,
  cleanName,
  APP_BASE_URL,
} from './equipmentConstants';
import { matchPhotoToEquipment, matchLogoToBrand, getCategoryHierarchy } from './equipmentUtils';
import { resolveGenericImage } from '../../utils/genericImages';
import { safeDate } from '../../utils/formatUtils';
import { STATUS_COLORS, ACCENT_COLORS } from '../../constants/colors';
import { Button, Tooltip } from '@/design-system';

const EquipmentDetailContent = ({
  eq,
  _isAdmin,
  compact = false,
  _onEdit,
  _onCreateTicket,
  _onDelete,
  _onSerialize,
  _onPrintLabel,
  _onPrintSheet,
  photosList,
  logosList,
  favoriteIds,
  watchIds,
  onToggleList,
  onOpenTicketDialog,
  onOpenDepotMap,
  categories: catList,
}) => {
  const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
  const [showQR, setShowQR] = useState(false);
  const photo = matchPhotoToEquipment(photosList || [], eq);
  const logo = matchLogoToBrand(logosList || [], eq.brand_canonical || eq.brand);
  const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;
  const isFav = favoriteIds?.has(eq.id);
  const isWatch = watchIds?.has(eq.id);
  const hierarchy = getCategoryHierarchy(eq, catList || []);
  const genericImg = !photo ? resolveGenericImage(eq, hierarchy) : null;

  return (
    <div className="eq-detail-body">
      {/* Hero: Photo + Identité */}
      <div className="eq-detail-hero">
        {(photo || genericImg) && (
          <div className={`eq-detail-photo${!photo && genericImg ? ' eq-generic' : ''}`}>
            <img src={photo || genericImg} alt={cleanName(eq.name)} loading="lazy" />
          </div>
        )}
        <div className="eq-detail-identity">
          <h2 className="eq-detail-name">
            {eq.categoryIcon || eq.category_icon || '📦'} {cleanName(eq.name)}
          </h2>
          <div className="eq-detail-meta-row">
            <span className="eq-detail-status" style={{ background: st.color }}>
              {st.icon} {st.label}
            </span>
            {logo && (
              <img
                className="eq-detail-brand-img"
                src={logo}
                alt={eq.brand_canonical || eq.brand}
                loading="lazy"
                title={eq.brand_canonical || eq.brand}
              />
            )}
          </div>
          {eq.uid && (
            <div className="eq-detail-uid-row">
              <Hash size={14} />
              <code className="eq-uid-code">{eq.uid}</code>
              <Tooltip content="Afficher QR Code">
                <Button variant="ghost" className="eq-btn-qr" onClick={() => setShowQR(!showQR)}>
                  <QrCode size={16} />
                </Button>
              </Tooltip>
              {onToggleList && (
                <>
                  <Tooltip content={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                    <Button
                      variant="ghost"
                      className={`eq-btn-list-star ${isFav ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleList(eq.id, 'favorite');
                      }}
                    >
                      <Star size={16} fill={isFav ? STATUS_COLORS.warning : 'none'} />
                    </Button>
                  </Tooltip>
                  <Tooltip
                    content={isWatch ? 'Retirer de la surveillance' : 'Mettre en surveillance'}
                  >
                    <Button
                      variant="ghost"
                      className={`eq-btn-list-eye ${isWatch ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleList(eq.id, 'watch');
                      }}
                    >
                      <Eye size={16} />
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>
          )}
          {showQR && qrUrl && (
            <div className="eq-qr-block">
              <QRCodeSVG value={qrUrl} size={compact ? 120 : 180} level="M" includeMargin />
              <span className="eq-qr-url">{qrUrl}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hiérarchie catégorie */}
      {hierarchy && (
        <div className="eq-detail-hierarchy">
          {hierarchy.family && (
            <span
              className="eq-hier-badge eq-hier-family"
              style={{ background: hierarchy.family.color || ACCENT_COLORS.indigo }}
            >
              {hierarchy.family.icon || '📦'} {hierarchy.family.name}
            </span>
          )}
          {hierarchy.subfamily && (
            <>
              <ChevronRight size={12} className="eq-hier-sep" />
              <span className="eq-hier-badge eq-hier-sub">{hierarchy.subfamily.name}</span>
            </>
          )}
          {hierarchy.category && (
            <>
              <ChevronRight size={12} className="eq-hier-sep" />
              <span className="eq-hier-badge eq-hier-cat">{hierarchy.category.name}</span>
            </>
          )}
        </div>
      )}

      {/* Informations */}
      <div className="eq-detail-grid eq-detail-info-grid">
        {eq.reference && (
          <div className="eq-detail-field">
            <span className="eq-field-label">
              <Tag size={14} /> Référence
            </span>
            <span className="eq-field-value">{eq.reference}</span>
          </div>
        )}
        {(eq.serialNumber || eq.serial_number) && (
          <div className="eq-detail-field">
            <span className="eq-field-label">
              <Clipboard size={14} /> N° série
            </span>
            <span className="eq-field-value">{eq.serialNumber || eq.serial_number}</span>
          </div>
        )}
        {eq.brand && (
          <div className="eq-detail-field">
            <span className="eq-field-label">🏭 Marque</span>
            <span className="eq-field-value">{eq.brand_canonical || eq.brand}</span>
          </div>
        )}
        {(eq.stockQuantity || eq.stock_quantity) > 1 && (
          <div className="eq-detail-field">
            <span className="eq-field-label">
              <Package size={14} /> Quantité
            </span>
            <span className="eq-field-value">{eq.stockQuantity || eq.stock_quantity}</span>
          </div>
        )}
        {(eq.location_zone || eq.locationZone || eq.location) && (
          <div className="eq-detail-field eq-field-wide">
            <span className="eq-field-label">
              <MapPin size={14} /> Zone dépôt
            </span>
            <span className="eq-field-value">
              {eq.location_zone || eq.locationZone
                ? `${eq.location_depot || eq.locationDepot ? `D${eq.location_depot || eq.locationDepot} — ` : ''}${eq.location_zone || eq.locationZone}${eq.location_code || eq.locationCode ? ` — ${eq.location_code || eq.locationCode}` : ''}${eq.location_floor || eq.locationFloor ? ` (${eq.location_floor || eq.locationFloor})` : ''}`
                : eq.location}
              {(eq.location_zone || eq.locationZone) && onOpenDepotMap && (
                <Tooltip content="Voir sur le plan" position="bottom">
                  <Button
                    variant="ghost"
                    className="eq-zone-map-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDepotMap(eq.location_zone || eq.locationZone, eq.name);
                    }}
                  >
                    <Map size={13} /> Plan
                  </Button>
                </Tooltip>
              )}
            </span>
          </div>
        )}
        {(eq.purchaseDate || eq.purchase_date) && (
          <div className="eq-detail-field">
            <span className="eq-field-label">
              <Calendar size={14} /> Achat
            </span>
            <span className="eq-field-value">{safeDate(eq.purchaseDate || eq.purchase_date)}</span>
          </div>
        )}
        {(eq.purchasePrice || eq.purchase_price) && (
          <div className="eq-detail-field">
            <span className="eq-field-label">
              <DollarSign size={14} /> Prix
            </span>
            <span className="eq-field-value">
              {parseFloat(eq.purchasePrice || eq.purchase_price).toFixed(2)} €
            </span>
          </div>
        )}
        {(eq.warrantyEnd || eq.warranty_end) && (
          <div className="eq-detail-field">
            <span className="eq-field-label">
              <CheckCircle size={14} /> Garantie
            </span>
            <span className="eq-field-value">
              jusqu'au {safeDate(eq.warrantyEnd || eq.warranty_end)}
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      {eq.notes && (
        <div className="eq-detail-notes">
          <h4>📝 Notes</h4>
          <p>{eq.notes}</p>
        </div>
      )}

      {/* Interventions SAV */}
      {(() => {
        const tickets = eq.savTickets || [];
        const activeTickets = tickets.filter(
          (t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_parts',
        );
        const historyTickets = tickets.filter(
          (t) => t.status === 'closed' || t.status === 'resolved',
        );

        if (tickets.length === 0)
          return (
            <div className="eq-detail-section">
              <h3>
                <Wrench size={16} /> Interventions SAV
              </h3>
              <p className="eq-detail-empty">Aucune intervention</p>
            </div>
          );

        const renderTicket = (t) => {
          const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
          const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
          return (
            <div
              key={t.id}
              className={`eq-ticket-item ${onOpenTicketDialog ? 'eq-clickable-ticket' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpenTicketDialog && onOpenTicketDialog(t)}
              style={onOpenTicketDialog ? { cursor: 'pointer' } : {}}
            >
              <div className="eq-ticket-header">
                <span className="eq-ticket-type">{SAV_TYPES[t.type] || t.type}</span>
                <span className="eq-ticket-priority" style={{ color: pri.color }}>
                  {pri.label}
                </span>
                <span className="eq-ticket-status" style={{ background: tst.color }}>
                  {tst.label}
                </span>
              </div>
              <strong>{t.title}</strong>
              {!compact && t.description && <p>{t.description}</p>}
              {!compact && t.resolution && (
                <p className="eq-ticket-resolution">✅ {t.resolution}</p>
              )}
              <div className="eq-ticket-meta">
                <span>
                  {safeDate(t.createdAt)} → {safeDate(t.resolvedAt)}
                </span>
                {t.cost != null && t.cost > 0 && <span>{parseFloat(t.cost).toFixed(2)} €</span>}
              </div>
            </div>
          );
        };

        return (
          <>
            {activeTickets.length > 0 && (
              <div className="eq-detail-section">
                <h3 className="eq-interventions-title">
                  <Wrench size={16} /> Interventions en cours ({activeTickets.length})
                </h3>
                <div className="eq-detail-list">{activeTickets.map(renderTicket)}</div>
              </div>
            )}
            <div className="eq-detail-section">
              <h3>
                <Wrench size={16} /> Historique interventions ({historyTickets.length})
              </h3>
              {historyTickets.length === 0 ? (
                <p className="eq-detail-empty">Aucun historique</p>
              ) : (
                <div className="eq-detail-list">
                  {(compact ? historyTickets.slice(0, 5) : historyTickets).map(renderTicket)}
                  {compact && historyTickets.length > 5 && (
                    <p className="eq-detail-empty eq-detail-empty-more">
                      + {historyTickets.length - 5} autre(s)… Double-cliquez pour tout voir
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
};

const EquipmentSlidePanel = ({
  equipment: eq,
  categories,
  _persons,
  photosList,
  logosList,
  favoriteIds,
  watchIds,
  onToggleList,
  onClose,
  onOpenDialog,
  _onEdit,
  onPrintLabel,
  onPrintSheet,
  isAdmin,
  onOpenDepotMap,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (eq) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [eq]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        const row = e.target.closest('.eq-table-row');
        if (!row) handleClose();
      }
    };
    if (eq && isVisible) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [eq, isVisible, handleClose]);

  if (!isVisible && !eq) return null;

  const currentEq = eq || {};
  const _st = EQUIPMENT_STATUS[currentEq.status] || EQUIPMENT_STATUS.available;

  return (
    <div
      className={`eq-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`}
      ref={panelRef}
    >
      <div className="eq-slide-header">
        <div className="eq-slide-title-row">
          <span className="eq-slide-name">{currentEq.reference || cleanName(currentEq.name)}</span>
          <span className="eq-slide-type">
            {currentEq.categoryIcon || currentEq.category_icon || '📦'}{' '}
            {currentEq.categoryName || currentEq.category_name || ''}
          </span>
        </div>
        <Tooltip content="Fermer">
          <Button variant="ghost" className="eq-slide-close" onClick={handleClose}>
            <X size={18} />
          </Button>
        </Tooltip>
      </div>
      <div className="eq-slide-body">
        <EquipmentDetailContent
          eq={currentEq}
          isAdmin={isAdmin}
          compact={true}
          photosList={photosList}
          logosList={logosList}
          favoriteIds={favoriteIds}
          watchIds={watchIds}
          onToggleList={onToggleList}
          onOpenDepotMap={onOpenDepotMap}
          categories={categories}
        />
      </div>
      <div className="eq-slide-footer">
        {onPrintLabel && (
          <Tooltip content="Imprimer étiquette">
            <Button
              variant="secondary"
              className="eq-footer-icon-btn"
              iconOnly
              aria-label="Imprimer étiquette"
              onClick={() => onPrintLabel(currentEq)}
            >
              <Printer size={14} />
            </Button>
          </Tooltip>
        )}
        {onPrintSheet && (
          <Tooltip content="Imprimer la fiche">
            <Button
              variant="secondary"
              className="eq-footer-icon-btn"
              iconOnly
              aria-label="Imprimer la fiche"
              onClick={() => onPrintSheet(currentEq)}
            >
              <FileText size={14} />
            </Button>
          </Tooltip>
        )}
        <Button
          variant="ghost"
          className="eq-slide-open-btn"
          onClick={() => {
            if (onOpenDialog) onOpenDialog(currentEq);
          }}
        >
          <ExternalLink size={14} /> Ouvrir la fiche complète
        </Button>
      </div>
    </div>
  );
};

const EquipmentDetailDialog = ({
  equipment: eq,
  categories,
  _persons,
  isAdmin,
  photosList,
  logosList,
  favoriteIds,
  watchIds,
  onToggleList,
  onClose,
  onEdit,
  onDelete,
  onCreateTicket,
  _onRefresh,
  onOpenTicketDialog,
  onPrintLabel,
  onPrintSheet,
  onSerialize,
  onOpenDepotMap,
}) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    if (eq) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClosing(false);
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [eq, handleClose]);

  if (!eq) return null;

  const _st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;

  return (
    <div
      className={`eq-dialog-overlay${isClosing ? ' closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="eq-dialog">
        <div className="eq-dialog-header">
          <div className="eq-dialog-title-row">
            <span className="eq-dialog-name">{eq.reference || cleanName(eq.name)}</span>
            <span
              className="eq-dialog-cat"
              style={{ background: eq.categoryColor || eq.category_color || ACCENT_COLORS.indigo }}
            >
              {eq.categoryIcon || eq.category_icon || '📦'}{' '}
              {eq.categoryName || eq.category_name || ''}
            </span>
          </div>
          <Tooltip content="Fermer">
            <Button variant="ghost" className="eq-dialog-close" onClick={handleClose}>
              <X size={20} />
            </Button>
          </Tooltip>
        </div>
        <div className="eq-dialog-body">
          <EquipmentDetailContent
            eq={eq}
            isAdmin={isAdmin}
            compact={false}
            photosList={photosList}
            logosList={logosList}
            favoriteIds={favoriteIds}
            watchIds={watchIds}
            onToggleList={onToggleList}
            onOpenTicketDialog={onOpenTicketDialog}
            onOpenDepotMap={onOpenDepotMap}
            categories={categories}
          />
        </div>
        <div className="eq-dialog-footer">
          <div className="eq-dialog-actions">
            <div className="eq-actions-group">
              <Button variant="primary" onClick={() => onEdit(eq)}>
                <Edit2 size={14} /> Modifier
              </Button>
            </div>
            <div className="eq-actions-group">
              {onCreateTicket && (
                <Button variant="secondary" onClick={() => onCreateTicket(eq)}>
                  <Wrench size={14} /> Ticket SAV
                </Button>
              )}
              {onOpenDepotMap && (
                <Button
                  variant="secondary"
                  onClick={() => onOpenDepotMap(eq.location_zone || eq.locationZone || '', eq.name)}
                >
                  <MapPin size={14} /> Localisation
                </Button>
              )}
              {onPrintLabel && (
                <Button variant="secondary" onClick={() => onPrintLabel(eq)}>
                  <Printer size={14} /> Étiquette
                </Button>
              )}
              {onPrintSheet && (
                <Button variant="secondary" onClick={() => onPrintSheet(eq)}>
                  <FileText size={14} /> Fiche
                </Button>
              )}
              {isAdmin &&
                onSerialize &&
                ((eq.stockQuantity || eq.stock_quantity || 1) > 1 || !eq.uid) && (
                  <Button
                    variant="secondary"
                    onClick={() => onSerialize(eq)}
                    title={
                      (eq.stockQuantity || eq.stock_quantity || 1) > 1
                        ? `Scinder en ${eq.stockQuantity || eq.stock_quantity} entités individuelles avec UID`
                        : 'Attribuer un UID unique à cet équipement'
                    }
                  >
                    <Package size={14} /> Sérialiser
                    {(eq.stockQuantity || eq.stock_quantity || 1) > 1
                      ? ` (${eq.stockQuantity || eq.stock_quantity})`
                      : ''}
                  </Button>
                )}
            </div>
            {isAdmin && onDelete && (
              <Button variant="danger" onClick={() => onDelete(eq.id)}>
                <Trash2 size={14} /> Supprimer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { EquipmentDetailContent, EquipmentSlidePanel, EquipmentDetailDialog };
