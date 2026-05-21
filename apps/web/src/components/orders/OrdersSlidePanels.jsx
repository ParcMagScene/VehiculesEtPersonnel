import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  Edit2,
  Eye,
  FileCheck,
  FileText,
  Hash,
  Package,
  Send,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import React from 'react';

import { Button, Drawer, ProgressBar, StatusBadge, Table, Tag, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { formatCurrency, formatDateSimple as formatDate } from '../../utils/formatUtils';
import AffaireBadge from '../AffaireBadge';
import { formatPhoneDisplay } from '../PhoneInput';
import {
  groupItemsByRequester,
  ORDER_STATUS,
  QUOTE_STATUS,
  REQUEST_PRIORITY,
  REQUEST_STATUS,
} from './ordersConstants';

// ═══ Volet latéral Commande (clic simple) ═══
export const OrderSlidePanel = React.memo(
  ({ order, onClose, onOpenDialog, onEdit, onDelete, onStatusChange }) => {
    if (!order) return null;
    const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
    const items = order.items || [];
    return (
      <Drawer
        open={!!order}
        onClose={onClose}
        side="right"
        width={420}
        className="orders-slide-panel"
        title={order.reference}
        headerActions={
          <Tooltip content="Ouvrir en détail" position="bottom">
            <Button
              variant="ghost"
              className="action-btn small"
              onClick={() => onOpenDialog(order)}
            >
              <Eye size={14} />
            </Button>
          </Tooltip>
        }
      >
        <StatusBadge color={status.color}>
          {status.icon} {status.label}
        </StatusBadge>
        <div className="slide-fields">
          <div className="slide-field">
            <span>Fournisseur</span>
            <strong>{order.supplier_name || '—'}</strong>
          </div>
          <div className="slide-field">
            <span>Date</span>
            <strong>{formatDate(order.order_date)}</strong>
          </div>
          <div className="slide-field">
            <span>Date prévue</span>
            <strong>{formatDate(order.expected_date)}</strong>
          </div>
          <div className="slide-field">
            <span>Affaire</span>
            <strong>
              {order.affaire_id ? <AffaireBadge numero={order.affaire_id} size="sm" /> : '—'}
            </strong>
          </div>
          <div className="slide-field">
            <span>Total HT</span>
            <strong className="amount">{formatCurrency(order.total_ht)}</strong>
          </div>
          <div className="slide-field">
            <span>Total TTC</span>
            <strong className="amount">{formatCurrency(order.total_ttc)}</strong>
          </div>
        </div>
        {items.length > 0 && (
          <>
            <h4>Articles ({items.length})</h4>
            <div className="requester-groups">
              {groupItemsByRequester(items).map((group) => (
                <div key={group.key} className="requester-group">
                  <div className="requester-line">
                    <span className="requester-label">
                      {group.isAffaire ? (
                        <AffaireBadge numero={group.affaireId} size="sm" />
                      ) : group.requesterName ? (
                        <>
                          <UsersIcon size={12} /> {group.requesterName}
                        </>
                      ) : (
                        <span className="muted">Sans demandeur</span>
                      )}
                    </span>
                    <span className="requester-summary">
                      {group.items.length} art. — {group.receivedQty}/{group.totalQty} reçu
                      {group.totalQty > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {order.notes && (
          <div className="slide-notes">
            <h4>Notes</h4>
            <p>{order.notes}</p>
          </div>
        )}
        <div className="slide-actions">
          {order.status === 'draft' && (
            <Button variant="ghost" className="action-btn" onClick={() => onStatusChange('sent')}>
              <Send size={14} /> Envoyer
            </Button>
          )}
          {order.status === 'sent' && (
            <Button
              variant="ghost"
              className="action-btn"
              onClick={() => onStatusChange('confirmed')}
            >
              <Check size={14} /> Confirmer
            </Button>
          )}
          {order.status === STATUS.CONFIRMED && (
            <Button
              variant="ghost"
              className="action-btn"
              onClick={() => onStatusChange('received')}
            >
              <Package size={14} /> Réceptionner
            </Button>
          )}
          <Button variant="ghost" className="action-btn" onClick={onEdit}>
            <Edit2 size={14} /> Modifier
          </Button>
          <Button variant="ghost" className="action-btn danger" onClick={onDelete}>
            <Trash2 size={14} /> Supprimer
          </Button>
        </div>
      </Drawer>
    );
  },
);

// ═══ Volet latéral Devis (clic simple) ═══
export const QuoteSlidePanel = React.memo(
  ({ quote, onClose, onOpenDialog, onEdit, onDelete, onConvert }) => {
    if (!quote) return null;
    const status = QUOTE_STATUS[quote.status] || QUOTE_STATUS.draft;
    const items = quote.items || [];
    return (
      <Drawer
        open={!!quote}
        onClose={onClose}
        side="right"
        width={420}
        className="orders-slide-panel"
        title={quote.reference}
        headerActions={
          <Tooltip content="Ouvrir en détail" position="bottom">
            <Button
              variant="ghost"
              className="action-btn small"
              onClick={() => onOpenDialog(quote)}
            >
              <Eye size={14} />
            </Button>
          </Tooltip>
        }
      >
        <StatusBadge color={status.color}>
          {status.icon} {status.label}
        </StatusBadge>
        {quote.converted_to_order_id && (
          <Tag color="success" size="sm">
            <FileCheck size={14} /> Converti
          </Tag>
        )}
        <div className="slide-fields">
          <div className="slide-field">
            <span>Client</span>
            <strong>{quote.client_name || '—'}</strong>
          </div>
          <div className="slide-field">
            <span>Date</span>
            <strong>{formatDate(quote.quote_date)}</strong>
          </div>
          <div className="slide-field">
            <span>Validité</span>
            <strong>{formatDate(quote.validity_date)}</strong>
          </div>
          <div className="slide-field">
            <span>Affaire</span>
            <strong>
              {quote.affaire_name
                ? `${quote.affaire_id} — ${quote.affaire_name}`
                : quote.affaire_id || '—'}
            </strong>
          </div>
          <div className="slide-field">
            <span>Total HT</span>
            <strong className="amount">{formatCurrency(quote.total_ht)}</strong>
          </div>
          <div className="slide-field">
            <span>Total TTC</span>
            <strong className="amount">{formatCurrency(quote.total_ttc)}</strong>
          </div>
        </div>
        {items.length > 0 && (
          <>
            <h4>Lignes ({items.length})</h4>
            <Table className="items-table compact">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Qté</th>
                  <th>P.U. HT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.designation}</td>
                    <td className="center">{item.quantity}</td>
                    <td className="amount">{formatCurrency(item.unit_price_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
        {quote.notes && (
          <div className="slide-notes">
            <h4>Notes</h4>
            <p>{quote.notes}</p>
          </div>
        )}
        <div className="slide-actions">
          {quote.status === STATUS.ACCEPTED && !quote.converted_to_order_id && (
            <Button variant="ghost" className="action-btn success" onClick={onConvert}>
              <ArrowRight size={14} /> Convertir
            </Button>
          )}
          <Button variant="ghost" className="action-btn" onClick={onEdit}>
            <Edit2 size={14} /> Modifier
          </Button>
          <Button variant="ghost" className="action-btn danger" onClick={onDelete}>
            <Trash2 size={14} /> Supprimer
          </Button>
        </div>
      </Drawer>
    );
  },
);

// ═══ Volet latéral Demande (clic simple) ═══
export const RequestSlidePanel = React.memo(
  ({ request, onClose, onOpenDialog, isAdmin, onValidate, onEdit }) => {
    if (!request) return null;
    const status = REQUEST_STATUS[request.status] || REQUEST_STATUS.pending;
    const priority = REQUEST_PRIORITY[request.priority] || REQUEST_PRIORITY.normal;
    return (
      <Drawer
        open={!!request}
        onClose={onClose}
        side="right"
        width={420}
        className="orders-slide-panel"
        title={request.article}
        headerActions={
          <div className="u-flex u-gap-1">
            <Tooltip content="Modifier" position="bottom">
              <Button variant="ghost" className="action-btn small" onClick={() => onEdit(request)}>
                <Edit2 size={14} />
              </Button>
            </Tooltip>
            <Tooltip content="Ouvrir en détail" position="bottom">
              <Button
                variant="ghost"
                className="action-btn small"
                onClick={() => onOpenDialog(request)}
              >
                <Eye size={14} />
              </Button>
            </Tooltip>
          </div>
        }
      >
        <StatusBadge color={status.color}>
          {status.icon} {status.label}
        </StatusBadge>
        <span className="priority-badge" style={{ color: priority.color }}>
          {priority.icon} {priority.label}
        </span>
        <div className="slide-fields">
          <div className="slide-field">
            <span>Quantité</span>
            <strong>{request.quantity}</strong>
          </div>
          <div className="slide-field">
            <span>Réf.</span>
            <strong>{request.ref_code || '—'}</strong>
          </div>
          <div className="slide-field">
            <span>Destination</span>
              <strong>
                {request.destination === 'Autre'
                  ? request.destination_other || 'Autre'
                  : request.destination}
              </strong>
            </div>
            <div className="slide-field">
              <span>Fournisseur</span>
              <strong>{request.supplier_name || '—'}</strong>
            </div>
            <div className="slide-field">
              <span>Demandeur</span>
              <strong>{request.requested_by_name || request.requested_by_name_db || '—'}</strong>
            </div>
            <div className="slide-field">
              <span>Affaire</span>
              <strong>{request.affaire_id || '—'}</strong>
            </div>
            {request.order_id && (
              <div className="slide-field">
                <span>Commande</span>
                <strong>#{request.order_id}</strong>
              </div>
            )}
          </div>
          {request.notes && (
            <div className="slide-notes">
              <h4>Notes</h4>
              <p>{request.notes}</p>
            </div>
          )}
        {isAdmin && request.status === STATUS.PENDING && (
          <div className="slide-actions">
            <Button
              variant="ghost"
              className="action-btn success"
              onClick={() => onValidate(request, 'approve')}
            >
              <Check size={14} /> Approuver
            </Button>
            <Button
              variant="ghost"
              className="action-btn danger"
              onClick={() => onValidate(request, 'reject')}
            >
              <X size={14} /> Refuser
            </Button>
          </div>
        )}
      </Drawer>
    );
  },
);

// ═══ Volet latéral Fournisseur (clic simple) ═══
export const SupplierSlidePanel = React.memo(({ supplier, onClose, onViewDetail, onViewOrder }) => {
  if (!supplier) return null;
  return (
    <Drawer
      open={!!supplier}
      onClose={onClose}
      side="right"
      width={420}
      className="orders-slide-panel"
      icon={<Building2 size={16} />}
      title={supplier.name}
      headerActions={
        <Tooltip content="Détail complet" position="bottom">
          <Button
            variant="ghost"
            className="action-btn small"
            onClick={() => {
              onClose?.();
              onViewDetail(supplier);
            }}
          >
            <Eye size={14} />
          </Button>
        </Tooltip>
      }
    >
      <div className="slide-fields">
        {supplier.contact_name && (
          <div className="slide-field">
            <span>Contact</span>
            <strong>{supplier.contact_name}</strong>
          </div>
        )}
        {supplier.email && (
          <div className="slide-field">
            <span>Email</span>
            <strong>{supplier.email}</strong>
          </div>
        )}
        {supplier.phone && (
          <div className="slide-field">
            <span>Tél.</span>
            <strong>{formatPhoneDisplay(supplier.phone)}</strong>
          </div>
        )}
      </div>
      {supplier.catalogs?.length > 0 && (
        <>
          <h4>
            <BookOpen size={14} /> Catalogues importés ({supplier.catalogs.length})
          </h4>
          <div className="supplier-catalogs-list">
            {supplier.catalogs.map((cat) => (
              <a
                key={cat.id}
                className="catalog-link-card"
                href={`/catalogues/${cat.filename}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText size={14} />
                <span className="catalog-name">{cat.filename}</span>
                <span className="catalog-meta">
                  {cat.items_count || 0} article{(cat.items_count || 0) > 1 ? 's' : ''}
                </span>
              </a>
            ))}
          </div>
        </>
      )}
      <h4>Commandes en cours ({supplier.orders?.length || 0})</h4>
      {!supplier.orders?.length ? (
        <p className="no-items">Aucune commande en cours</p>
      ) : (
        <div className="supplier-orders-list">
          {supplier.orders.map((order) => {
            const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
            const completion =
              order.item_count > 0
                ? Math.round((order.completed_items / order.item_count) * 100)
                : 0;
            return (
              <div
                key={order.id}
                className="supplier-order-card"
                role="button"
                tabIndex={0}
                onClick={() => onViewOrder(order)}
              >
                <div className="order-card-top">
                  <span className="order-ref">
                    <Hash size={14} /> {order.reference}
                  </span>
                  <StatusBadge color={status.color} size="sm">
                    {status.icon} {status.label}
                  </StatusBadge>
                </div>
                <div className="order-card-meta">
                  <span>{formatDate(order.order_date)}</span>
                  <span>{order.item_count} article(s)</span>
                  <span>{formatCurrency(order.total_ht)} HT</span>
                </div>
                <div className="order-progress">
                  <ProgressBar
                    value={completion}
                    color="success"
                    label={`${completion}% réceptionné`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
});
