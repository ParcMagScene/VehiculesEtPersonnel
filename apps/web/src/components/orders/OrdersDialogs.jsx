import {
  ArrowRight,
  Check,
  ClipboardList,
  Edit2,
  FileCheck,
  Hash,
  Package,
  Send,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import React from 'react';

import { Button, StatusBadge, Table, Tag, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { formatCurrency, formatDateSimple as formatDate } from '../../utils/formatUtils';
import AffaireBadge from '../AffaireBadge';
import {
  groupItemsByRequester,
  ORDER_STATUS,
  QUOTE_STATUS,
  REQUEST_PRIORITY,
  REQUEST_STATUS,
} from './ordersConstants';

// ═══ Dialog Commande (double-clic) ═══
export const OrderDetailDialog = React.memo(
  ({ order, onClose, onEdit, onDelete, onStatusChange }) => {
    const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
    const items = order.items || [];
    return (
      <div
        className="orders-overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="order-detail-dialog"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="order-detail-header">
            <div className="order-detail-title">
              <h2>{order.reference}</h2>
              <StatusBadge color={status.color}>
                {status.icon} {status.label}
              </StatusBadge>
            </div>
            <div className="order-detail-actions">
              {order.status === 'draft' && (
                <Button
                  variant="ghost"
                  className="action-btn"
                  onClick={() => onStatusChange('sent')}
                >
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
              <Button variant="ghost" className="close-btn" onClick={onClose} aria-label="Fermer">
                <X size={20} />
              </Button>
            </div>
          </div>
          <div className="order-detail-grid">
            <div className="detail-section">
              <h3>Informations</h3>
              <div className="detail-fields">
                <div className="detail-field">
                  <span className="field-label">Fournisseur</span>
                  <span>{order.supplier_name || '—'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Date commande</span>
                  <span>{formatDate(order.order_date)}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Date prévue</span>
                  <span>{formatDate(order.expected_date)}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Affaire</span>
                  <span>
                    {order.affaire_id ? <AffaireBadge numero={order.affaire_id} size="sm" /> : '—'}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Créé par</span>
                  <span>{order.created_by_name || '—'}</span>
                </div>
              </div>
            </div>
            <div className="detail-section">
              <h3>Montants</h3>
              <div className="detail-fields">
                <div className="detail-field">
                  <span className="field-label">Total HT</span>
                  <span className="amount-large">{formatCurrency(order.total_ht)}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">TVA ({order.tva_rate}%)</span>
                  <span>{formatCurrency(order.total_ttc - order.total_ht)}</span>
                </div>
                <div className="detail-field total">
                  <span className="field-label">Total TTC</span>
                  <span className="amount-large">{formatCurrency(order.total_ttc)}</span>
                </div>
              </div>
            </div>
          </div>
          {order.notes && (
            <div className="detail-notes">
              <h3>Notes</h3>
              <p>{order.notes}</p>
            </div>
          )}
          <div className="detail-section">
            <h3>Lignes de commande ({items.length})</h3>
            {items.length > 0 ? (
              <div className="requester-groups detail">
                {groupItemsByRequester(items).map((group) => (
                  <div key={group.key} className="requester-group">
                    <div className="requester-group-header">
                      <span className="requester-label">
                        {group.isAffaire ? (
                          <AffaireBadge numero={group.affaireId} size="sm" />
                        ) : group.requesterName ? (
                          <>
                            <UsersIcon size={14} /> {group.requesterName}
                          </>
                        ) : (
                          <span className="muted">Sans demandeur</span>
                        )}
                      </span>
                      <span className="requester-summary">
                        {group.items.length} article{group.items.length > 1 ? 's' : ''} —{' '}
                        {formatCurrency(group.totalHt)} HT — {group.receivedQty}/{group.totalQty}{' '}
                        reçu{group.totalQty > 1 ? 's' : ''}
                      </span>
                    </div>
                    <Table className="items-table compact">
                      <thead>
                        <tr>
                          <th>Réf</th>
                          <th>Désignation</th>
                          <th>Qté</th>
                          <th>Unité</th>
                          <th>P.U. HT</th>
                          <th>Total HT</th>
                          <th>Reçu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr
                            key={item.id}
                            className={item.received_qty >= item.quantity ? 'received-row' : ''}
                          >
                            <td className="ref-code">{item.ref_code || '—'}</td>
                            <td>{item.designation}</td>
                            <td className="center">{item.quantity}</td>
                            <td className="center">{item.unit}</td>
                            <td className="amount">{formatCurrency(item.unit_price_ht)}</td>
                            <td className="amount">{formatCurrency(item.total_ht)}</td>
                            <td className="center">{item.received_qty || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-items">Aucune ligne</p>
            )}
          </div>
          <div className="dialog-footer">
            <Button variant="ghost" className="action-btn" onClick={onClose}>
              <X size={14} /> Fermer
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

// ═══ Dialog Devis (double-clic) ═══
export const QuoteDetailDialog = React.memo(
  ({ quote, onClose, onEdit, onDelete, onConvert, onStatusChange }) => {
    const status = QUOTE_STATUS[quote.status] || QUOTE_STATUS.draft;
    const items = quote.items || [];
    return (
      <div
        className="orders-overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="order-detail-dialog"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="order-detail-header">
            <div className="order-detail-title">
              <h2>{quote.reference}</h2>
              <StatusBadge color={status.color}>
                {status.icon} {status.label}
              </StatusBadge>
              {quote.converted_to_order_id && (
                <Tag color="success" size="sm">
                  <FileCheck size={14} /> Converti en commande
                </Tag>
              )}
            </div>
            <div className="order-detail-actions">
              {quote.status === 'draft' && (
                <Button
                  variant="ghost"
                  className="action-btn"
                  onClick={() => onStatusChange('sent')}
                >
                  <Send size={14} /> Envoyer
                </Button>
              )}
              {quote.status === 'sent' && (
                <>
                  <Button
                    variant="ghost"
                    className="action-btn success"
                    onClick={() => onStatusChange('accepted')}
                  >
                    <Check size={14} /> Accepter
                  </Button>
                  <Button
                    variant="ghost"
                    className="action-btn danger"
                    onClick={() => onStatusChange('refused')}
                  >
                    <X size={14} /> Refuser
                  </Button>
                </>
              )}
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
              <Button variant="ghost" className="close-btn" onClick={onClose} aria-label="Fermer">
                <X size={20} />
              </Button>
            </div>
          </div>
          <div className="order-detail-grid">
            <div className="detail-section">
              <h3>Client</h3>
              <div className="detail-fields">
                <div className="detail-field">
                  <span className="field-label">Nom</span>
                  <span>{quote.client_name || '—'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Email</span>
                  <span>{quote.client_email || '—'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Adresse</span>
                  <span>{quote.client_address || '—'}</span>
                </div>
              </div>
            </div>
            <div className="detail-section">
              <h3>Informations</h3>
              <div className="detail-fields">
                <div className="detail-field">
                  <span className="field-label">Date devis</span>
                  <span>{formatDate(quote.quote_date)}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Validité</span>
                  <span>{formatDate(quote.validity_date)}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Affaire</span>
                  <span>
                    {quote.affaire_name
                      ? `${quote.affaire_id} — ${quote.affaire_name}`
                      : quote.affaire_id || '—'}
                  </span>
                </div>
                <div className="detail-field total">
                  <span className="field-label">Total HT</span>
                  <span className="amount-large">{formatCurrency(quote.total_ht)}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Total TTC</span>
                  <span className="amount-large">{formatCurrency(quote.total_ttc)}</span>
                </div>
              </div>
            </div>
          </div>
          {quote.notes && (
            <div className="detail-notes">
              <h3>Notes</h3>
              <p>{quote.notes}</p>
            </div>
          )}
          <div className="detail-section">
            <h3>Lignes du devis ({items.length})</h3>
            {items.length > 0 ? (
              <Table className="items-table">
                <thead>
                  <tr>
                    <th>Désignation</th>
                    <th>Qté</th>
                    <th>Unité</th>
                    <th>P.U. HT</th>
                    <th>Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.designation}</td>
                      <td className="center">{item.quantity}</td>
                      <td className="center">{item.unit}</td>
                      <td className="amount">{formatCurrency(item.unit_price_ht)}</td>
                      <td className="amount">{formatCurrency(item.total_ht)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="no-items">Aucune ligne</p>
            )}
          </div>
        </div>
      </div>
    );
  },
);

// ═══ Dialog Demande (double-clic) ═══
export const RequestDetailDialog = React.memo(
  ({ request, onClose, isAdmin, onValidate, onDelete, onEdit }) => {
    const status = REQUEST_STATUS[request.status] || REQUEST_STATUS.pending;
    const priority = REQUEST_PRIORITY[request.priority] || REQUEST_PRIORITY.normal;
    return (
      <div
        className="orders-overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="order-detail-dialog request-detail-dialog"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="order-detail-header">
            <div className="order-detail-title">
              <h2>
                <ClipboardList size={20} /> {request.article}
              </h2>
              <StatusBadge color={status.color}>
                {status.icon} {status.label}
              </StatusBadge>
              <span className="priority-badge" style={{ color: priority.color }}>
                {priority.icon} {priority.label}
              </span>
            </div>
            <div className="order-detail-actions">
              {isAdmin && request.status === STATUS.PENDING && (
                <>
                  <Button
                    variant="ghost"
                    className="action-btn success"
                    onClick={() => {
                      onValidate(request, 'approve');
                      onClose();
                    }}
                  >
                    <Check size={14} /> Approuver
                  </Button>
                  <Button
                    variant="ghost"
                    className="action-btn danger"
                    onClick={() => {
                      onValidate(request, 'reject');
                      onClose();
                    }}
                  >
                    <X size={14} /> Refuser
                  </Button>
                </>
              )}
              <Button variant="ghost" className="action-btn" onClick={() => onEdit(request)}>
                <Edit2 size={14} /> Modifier
              </Button>
              <Button
                variant="ghost"
                className="action-btn danger"
                onClick={() => {
                  onDelete(request);
                  onClose();
                }}
              >
                <Trash2 size={14} /> Supprimer
              </Button>
              <Button variant="ghost" className="close-btn" onClick={onClose} aria-label="Fermer">
                <X size={20} />
              </Button>
            </div>
          </div>
          <div className="order-detail-grid">
            <div className="detail-section">
              <h3>Détails</h3>
              <div className="detail-fields">
                <div className="detail-field">
                  <span className="field-label">Article</span>
                  <span>{request.article}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Réf.</span>
                  <span>{request.ref_code || '—'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Quantité</span>
                  <span>{request.quantity}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Destination</span>
                  <span>
                    {request.destination === 'Autre'
                      ? request.destination_other || 'Autre'
                      : request.destination}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Fournisseur</span>
                  <span>{request.supplier_name || '—'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Demandeur</span>
                  <span>{request.requested_by_name || request.requested_by_name_db || '—'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Affaire</span>
                  <span>{request.affaire_id || '—'}</span>
                </div>
                {request.order_id && (
                  <div className="detail-field">
                    <span className="field-label">Commande</span>
                    <span>#{request.order_id}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {request.notes && (
            <div className="detail-notes">
              <h3>Notes</h3>
              <p>{request.notes}</p>
            </div>
          )}
          {request.rejection_reason && (
            <div className="detail-notes rejection">
              <h3>Raison du refus</h3>
              <p>{request.rejection_reason}</p>
            </div>
          )}
        </div>
      </div>
    );
  },
);
