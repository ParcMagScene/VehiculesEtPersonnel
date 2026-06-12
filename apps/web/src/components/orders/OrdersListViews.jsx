import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  ClipboardList,
  Edit2,
  Hash,
  Package,
  Trash2,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

import {
  Button,
  Input,
  StatusBadge,
  Table,
  Tooltip,
  useResizableColumns,
  useSortableData,
} from '@/design-system';

import { STATUS } from '../../constants';
import { STATUS_COLORS } from '../../constants/colors';
import { formatCurrency, formatDateSimple as formatDate } from '../../utils/formatUtils';
import AffaireBadge from '../AffaireBadge';
import { formatPhoneDisplay } from '../PhoneInput';
import { ORDER_STATUS, QUOTE_STATUS, REQUEST_PRIORITY, REQUEST_STATUS } from './ordersConstants';

// ═══ Liste des commandes ═══
const ORDERS_COLS = {
  ref: 160,
  supplier: 180,
  affaire: 140,
  date: 110,
  status: 130,
  items: 80,
  total: 120,
  actions: 110,
};
export const OrdersList = React.memo(
  ({ orders, onView, onDoubleClick, onEdit, onDelete, selectedId }) => {
    const { getColProps, getResizerProps } = useResizableColumns('orders-list', ORDERS_COLS);
    const { sorted, getThProps, getSortIndicator } = useSortableData(orders, {
      initialCol: 'order_date',
      initialDir: 'desc',
      getValue: (row, col) => {
        if (col === 'status') return ORDER_STATUS[row.status]?.label ?? row.status;
        if (col === 'item_count') return Number(row.item_count) || 0;
        if (col === 'total_ht') return Number(row.total_ht) || 0;
        return row[col];
      },
    });
    if (!orders.length) return <div className="orders-empty">Aucune commande</div>;
    return (
      <div className="orders-table-wrapper">
        <Table className="orders-table app-data-table">
          <colgroup>
            {Object.keys(ORDERS_COLS).map((k) => (
              <col key={k} {...getColProps(k)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th {...getThProps('reference')}>
                Référence<span className="app-sort-indicator">{getSortIndicator('reference')}</span>
                <span {...getResizerProps('ref')} />
              </th>
              <th {...getThProps('supplier_name')}>
                Fournisseur
                <span className="app-sort-indicator">{getSortIndicator('supplier_name')}</span>
                <span {...getResizerProps('supplier')} />
              </th>
              <th {...getThProps('affaire_id')}>
                Affaire<span className="app-sort-indicator">{getSortIndicator('affaire_id')}</span>
                <span {...getResizerProps('affaire')} />
              </th>
              <th {...getThProps('order_date')}>
                Date<span className="app-sort-indicator">{getSortIndicator('order_date')}</span>
                <span {...getResizerProps('date')} />
              </th>
              <th {...getThProps('status')}>
                Statut<span className="app-sort-indicator">{getSortIndicator('status')}</span>
                <span {...getResizerProps('status')} />
              </th>
              <th {...getThProps('item_count')} className="app-sortable is-center">
                Articles<span className="app-sort-indicator">{getSortIndicator('item_count')}</span>
                <span {...getResizerProps('items')} />
              </th>
              <th {...getThProps('total_ht')} className="app-sortable is-numeric">
                Total HT<span className="app-sort-indicator">{getSortIndicator('total_ht')}</span>
                <span {...getResizerProps('total')} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((order) => {
              const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
              return (
                <tr
                  key={order.id}
                  onClick={() => onView(order)}
                  onDoubleClick={() => onDoubleClick?.(order)}
                  className={`clickable-row${selectedId === order.id ? ' selected' : ''}`}
                >
                  <td className="ref-cell">
                    <Hash size={14} /> {order.reference}
                  </td>
                  <td>{order.supplier_name || '—'}</td>
                  <td className="affaire-cell">
                    {order.affaire_id ? <AffaireBadge numero={order.affaire_id} size="sm" /> : '—'}
                  </td>
                  <td>{formatDate(order.order_date)}</td>
                  <td>
                    <StatusBadge color={status.color}>
                      {status.icon} {status.label}
                    </StatusBadge>
                  </td>
                  <td className="center">{order.item_count || 0}</td>
                  <td className="amount">{formatCurrency(order.total_ht)}</td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <Tooltip content="Modifier">
                      <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(order)}>
                        <Edit2 size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Supprimer">
                      <Button variant="danger" size="sm" iconOnly onClick={() => onDelete(order)}>
                        <Trash2 size={14} />
                      </Button>
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  },
);

// ═══ Liste des devis ═══
const QUOTES_COLS = {
  ref: 160,
  client: 180,
  date: 110,
  validity: 110,
  status: 130,
  total: 120,
  actions: 110,
};
export const QuotesList = React.memo(
  ({ quotes, onView, onDoubleClick, onEdit, onDelete, onConvert, selectedId }) => {
    const { getColProps, getResizerProps } = useResizableColumns('quotes-list', QUOTES_COLS);
    const { sorted, getThProps, getSortIndicator } = useSortableData(quotes, {
      initialCol: 'quote_date',
      initialDir: 'desc',
      getValue: (row, col) => {
        if (col === 'status') return QUOTE_STATUS[row.status]?.label ?? row.status;
        if (col === 'total_ht') return Number(row.total_ht) || 0;
        return row[col];
      },
    });
    if (!quotes.length) return <div className="orders-empty">Aucun devis</div>;
    return (
      <div className="orders-table-wrapper">
        <Table className="orders-table app-data-table">
          <colgroup>
            {Object.keys(QUOTES_COLS).map((k) => (
              <col key={k} {...getColProps(k)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th {...getThProps('reference')}>
                Référence<span className="app-sort-indicator">{getSortIndicator('reference')}</span>
                <span {...getResizerProps('ref')} />
              </th>
              <th {...getThProps('client_name')}>
                Client<span className="app-sort-indicator">{getSortIndicator('client_name')}</span>
                <span {...getResizerProps('client')} />
              </th>
              <th {...getThProps('quote_date')}>
                Date<span className="app-sort-indicator">{getSortIndicator('quote_date')}</span>
                <span {...getResizerProps('date')} />
              </th>
              <th {...getThProps('validity_date')}>
                Validité
                <span className="app-sort-indicator">{getSortIndicator('validity_date')}</span>
                <span {...getResizerProps('validity')} />
              </th>
              <th {...getThProps('status')}>
                Statut<span className="app-sort-indicator">{getSortIndicator('status')}</span>
                <span {...getResizerProps('status')} />
              </th>
              <th {...getThProps('total_ht')} className="app-sortable is-numeric">
                Total HT<span className="app-sort-indicator">{getSortIndicator('total_ht')}</span>
                <span {...getResizerProps('total')} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((quote) => {
              const status = QUOTE_STATUS[quote.status] || QUOTE_STATUS.draft;
              return (
                <tr
                  key={quote.id}
                  onClick={() => onView(quote)}
                  onDoubleClick={() => onDoubleClick?.(quote)}
                  className={`clickable-row${selectedId === quote.id ? ' selected' : ''}`}
                >
                  <td className="ref-cell">
                    <Hash size={14} /> {quote.reference}
                  </td>
                  <td>{quote.client_name || '—'}</td>
                  <td>{formatDate(quote.quote_date)}</td>
                  <td>{formatDate(quote.validity_date)}</td>
                  <td>
                    <StatusBadge color={status.color}>
                      {status.icon} {status.label}
                    </StatusBadge>
                  </td>
                  <td className="amount">{formatCurrency(quote.total_ht)}</td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    {quote.status === STATUS.ACCEPTED && !quote.converted_to_order_id && (
                      <Tooltip content="Convertir en commande">
                        <Button
                          variant="success"
                          size="sm"
                          iconOnly
                          onClick={() => onConvert(quote)}
                        >
                          <ArrowRight size={14} />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content="Modifier">
                      <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(quote)}>
                        <Edit2 size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Supprimer">
                      <Button variant="danger" size="sm" iconOnly onClick={() => onDelete(quote)}>
                        <Trash2 size={14} />
                      </Button>
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  },
);

// ═══ Liste enrichie des fournisseurs ═══
const SUPPLIERS_COLS = {
  name: 200,
  contact: 150,
  email: 200,
  phone: 130,
  catalogues: 100,
  orders: 100,
  total: 120,
  statuses: 140,
  actions: 110,
};
export const EnhancedSuppliersList = React.memo(
  ({ suppliers, onEdit, onDelete, onClick, onDoubleClick, selectedId }) => {
    const { getColProps, getResizerProps } = useResizableColumns('suppliers-list', SUPPLIERS_COLS);
    const { sorted, getThProps, getSortIndicator } = useSortableData(suppliers, {
      initialCol: 'name',
      getValue: (row, col) => {
        if (col === 'catalog_count') return Number(row.catalog_count) || 0;
        if (col === 'active_order_count') return Number(row.active_order_count) || 0;
        if (col === 'total_ht') return Number(row.total_ht) || 0;
        return row[col];
      },
    });
    if (!suppliers.length)
      return (
        <div className="orders-empty">
          <Building2 size={24} />
          <p>Aucun fournisseur</p>
        </div>
      );
    return (
      <div className="orders-table-wrapper">
        <Table className="orders-table suppliers-table app-data-table">
          <colgroup>
            {Object.keys(SUPPLIERS_COLS).map((k) => (
              <col key={k} {...getColProps(k)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th {...getThProps('name')}>
                Fournisseur<span className="app-sort-indicator">{getSortIndicator('name')}</span>
                <span {...getResizerProps('name')} />
              </th>
              <th {...getThProps('contact_name')}>
                Contact
                <span className="app-sort-indicator">{getSortIndicator('contact_name')}</span>
                <span {...getResizerProps('contact')} />
              </th>
              <th {...getThProps('email')}>
                Email<span className="app-sort-indicator">{getSortIndicator('email')}</span>
                <span {...getResizerProps('email')} />
              </th>
              <th {...getThProps('phone')}>
                Téléphone<span className="app-sort-indicator">{getSortIndicator('phone')}</span>
                <span {...getResizerProps('phone')} />
              </th>
              <th {...getThProps('catalog_count')} className="app-sortable is-center">
                Catalogues
                <span className="app-sort-indicator">{getSortIndicator('catalog_count')}</span>
                <span {...getResizerProps('catalogues')} />
              </th>
              <th {...getThProps('active_order_count')} className="app-sortable is-center">
                Commandes
                <span className="app-sort-indicator">{getSortIndicator('active_order_count')}</span>
                <span {...getResizerProps('orders')} />
              </th>
              <th {...getThProps('total_ht')} className="app-sortable is-numeric">
                Total HT<span className="app-sort-indicator">{getSortIndicator('total_ht')}</span>
                <span {...getResizerProps('total')} />
              </th>
              <th>
                Statuts
                <span {...getResizerProps('statuses')} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((supplier) => (
              <tr
                key={supplier.id}
                onClick={() => onClick?.(supplier)}
                onDoubleClick={() => onDoubleClick?.(supplier)}
                className={`clickable-row${selectedId === supplier.id ? ' selected' : ''}${supplier._new ? ' row-new-highlight' : ''}`}
              >
                <td className="ref-cell">
                  <Building2 size={14} /> {supplier.name}
                </td>
                <td>{supplier.contact_name || '—'}</td>
                <td>{supplier.email || '—'}</td>
                <td>{supplier.phone ? formatPhoneDisplay(supplier.phone) : '—'}</td>
                <td className="center">
                  {supplier.catalog_count > 0 ? (
                    <span
                      className="catalog-badge"
                      title={`${supplier.catalog_count} catalogue(s)`}
                    >
                      <BookOpen size={12} /> {supplier.catalog_count}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="center">{supplier.active_order_count || 0}</td>
                <td className="amount">
                  {supplier.total_ht > 0 ? formatCurrency(supplier.total_ht) : '—'}
                </td>
                <td>
                  {supplier.order_statuses
                    ? supplier.order_statuses.split(',').map((s) => {
                        const st = ORDER_STATUS[s.trim()];
                        return st ? (
                          <span
                            key={s}
                            className="mini-status"
                            style={{ color: st.color }}
                            title={st.label}
                          >
                            {st.icon}
                          </span>
                        ) : null;
                      })
                    : '—'}
                </td>
                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <Tooltip content="Modifier">
                    <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(supplier)}>
                      <Edit2 size={14} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Supprimer">
                    <Button variant="danger" size="sm" iconOnly onClick={() => onDelete(supplier)}>
                      <Trash2 size={14} />
                    </Button>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  },
);

// ═══ Suivi des commandes liées (utilisateurs simples) ═══
export const MyLinkedOrdersList = React.memo(({ orders, loading }) => {
  if (loading) return <div className="orders-loading">Chargement...</div>;
  if (!orders.length)
    return (
      <div className="orders-empty u-p-8">
        <Package size={32} />
        <p>Aucune commande en cours liée à vos demandes</p>
        <p className="u-text-muted u-mt-2 u-font-sm">
          Les commandes créées à partir de vos demandes apparaîtront ici
        </p>
      </div>
    );
  return (
    <div className="u-flex-col u-gap-3 u-p-2">
      {orders.map((order) => {
        const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
        const completion =
          order.item_count > 0 ? Math.round((order.completed_items / order.item_count) * 100) : 0;
        return (
          <div
            key={order.id}
            style={{
              background: 'var(--theme-bg-card, #fff)',
              border: '1px solid var(--theme-border)',
              borderRadius: 10,
              padding: '0.85rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div className="u-flex-between u-mb-2">
              <span
                className="u-font-bold"
                style={{ fontSize: '0.9rem', color: 'var(--theme-text-primary)' }}
              >
                <Hash size={14} style={{ verticalAlign: -2 }} /> {order.reference}
              </span>
              <StatusBadge color={status.color} size="sm">
                {status.icon} {status.label}
              </StatusBadge>
            </div>
            {order.supplier_name && (
              <div className="u-text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                <Building2 size={13} style={{ verticalAlign: -2 }} /> {order.supplier_name}
              </div>
            )}
            <div className="u-flex u-gap-4 u-text-muted u-mb-2" style={{ fontSize: '0.75rem' }}>
              <span>{order.item_count} article(s)</span>
              {order.order_date && <span>{formatDate(order.order_date)}</span>}
            </div>
            {/* Barre de progression */}
            <div
              className="u-overflow-hidden"
              style={{
                background: 'var(--theme-bg-secondary, #f3f4f6)',
                borderRadius: 6,
                height: 8,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${completion}%`,
                  borderRadius: 6,
                  background: completion === 100 ? STATUS_COLORS.success : STATUS_COLORS.info,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div className="u-text-muted u-text-right u-mt-1" style={{ fontSize: '0.7rem' }}>
              {completion}% réceptionné
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ═══ Liste des demandes de matériel ═══
const REQUESTS_COLS = {
  article: 220,
  qty: 70,
  priority: 130,
  destination: 150,
  supplier: 160,
  requester: 140,
  status: 140,
  actions: 130,
};
export const MaterialRequestsList = React.memo(
  ({
    requests,
    isAdmin,
    isSimpleUser,
    onValidate,
    onDelete,
    onClick,
    onDoubleClick,
    selectedId,
  }) => {
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const { getColProps, getResizerProps } = useResizableColumns('requests-list', REQUESTS_COLS);
    const { sorted, getThProps, getSortIndicator } = useSortableData(requests, {
      initialCol: 'created_at',
      initialDir: 'desc',
      getValue: (row, col) => {
        if (col === 'priority') return REQUEST_PRIORITY[row.priority]?.label ?? row.priority;
        if (col === 'status') return REQUEST_STATUS[row.status]?.label ?? row.status;
        if (col === 'quantity') return Number(row.quantity) || 0;
        if (col === 'destination')
          return row.destination === 'Autre' ? row.destination_other || 'Autre' : row.destination;
        if (col === 'requester') return row.requested_by_name || row.requested_by_name_db || '';
        return row[col];
      },
    });

    if (!requests.length)
      return (
        <div className="orders-empty">
          <ClipboardList size={24} />
          <p>{isSimpleUser ? "Vous n'avez aucune demande" : 'Aucune demande de matériel'}</p>
        </div>
      );

    // Mode carte mobile pour utilisateurs simples
    if (isSimpleUser) {
      return (
        <div className="u-flex-col u-p-2" style={{ gap: '0.6rem' }}>
          {requests.map((req) => {
            const status = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
            const priority = REQUEST_PRIORITY[req.priority] || REQUEST_PRIORITY.normal;
            return (
              <div
                key={req.id}
                className="u-cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onClick?.(req)}
                style={{
                  background: 'var(--theme-bg-card, #fff)',
                  border: `1px solid ${selectedId === req.id ? 'var(--theme-accent, #2563eb)' : 'var(--theme-border)'}`,
                  borderRadius: 10,
                  padding: '0.8rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div
                  className="u-flex"
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.4rem',
                  }}
                >
                  <div className="u-flex-1" style={{ minWidth: 0 }}>
                    <div
                      className="u-font-bold"
                      style={{ fontSize: '0.9rem', color: 'var(--theme-text-primary)' }}
                    >
                      {req.article}
                      {Array.isArray(req.lines) && req.lines.length > 1 && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: '0.7rem',
                            color: 'var(--theme-text-muted)',
                          }}
                        >
                          +{req.lines.length - 1} réf.
                        </span>
                      )}
                    </div>
                    {req.ref_code && (
                      <div className="u-text-muted" style={{ fontSize: '0.7rem' }}>
                        Réf: {req.ref_code}
                      </div>
                    )}
                  </div>
                  <StatusBadge className="u-flex-shrink-0" color={status.color} size="sm">
                    {status.icon} {status.label}
                  </StatusBadge>
                </div>
                <div
                  className="u-flex u-flex-wrap u-gap-2 u-text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  <span>Qté: {req.quantity}</span>
                  <span style={{ color: priority.color }}>
                    {priority.icon} {priority.label}
                  </span>
                  {req.supplier_name && <span>📦 {req.supplier_name}</span>}
                  <span>
                    📍{' '}
                    {req.destination === 'Autre'
                      ? req.destination_other || 'Autre'
                      : req.destination}
                  </span>
                </div>
                {req.order_id && (
                  <div
                    className="u-font-semibold"
                    style={{
                      marginTop: '0.4rem',
                      fontSize: '0.75rem',
                      color: 'var(--theme-accent, #2563eb)',
                    }}
                  >
                    → Commande #{req.order_id}
                  </div>
                )}
                {req.notes && (
                  <div
                    className="u-text-muted"
                    style={{ marginTop: '0.3rem', fontSize: '0.7rem', fontStyle: 'italic' }}
                  >
                    {req.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="orders-table-wrapper">
        <Table className="orders-table requests-table app-data-table">
          <colgroup>
            {Object.keys(REQUESTS_COLS).map((k) => (
              <col key={k} {...getColProps(k)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th {...getThProps('article')}>
                Article<span className="app-sort-indicator">{getSortIndicator('article')}</span>
                <span {...getResizerProps('article')} />
              </th>
              <th {...getThProps('quantity')} className="app-sortable is-center">
                Qté<span className="app-sort-indicator">{getSortIndicator('quantity')}</span>
                <span {...getResizerProps('qty')} />
              </th>
              <th {...getThProps('priority')}>
                Priorité<span className="app-sort-indicator">{getSortIndicator('priority')}</span>
                <span {...getResizerProps('priority')} />
              </th>
              <th {...getThProps('destination')}>
                Destination
                <span className="app-sort-indicator">{getSortIndicator('destination')}</span>
                <span {...getResizerProps('destination')} />
              </th>
              <th {...getThProps('supplier_name')}>
                Fournisseur
                <span className="app-sort-indicator">{getSortIndicator('supplier_name')}</span>
                <span {...getResizerProps('supplier')} />
              </th>
              <th {...getThProps('requester')}>
                Demandeur<span className="app-sort-indicator">{getSortIndicator('requester')}</span>
                <span {...getResizerProps('requester')} />
              </th>
              <th {...getThProps('status')}>
                Statut<span className="app-sort-indicator">{getSortIndicator('status')}</span>
                <span {...getResizerProps('status')} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((req) => {
              const status = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
              const priority = REQUEST_PRIORITY[req.priority] || REQUEST_PRIORITY.normal;
              return (
                <React.Fragment key={req.id}>
                  <tr
                    className={`${req.priority === 'urgent' ? 'urgent-row' : ''}${onClick ? ' clickable-row' : ''}${selectedId === req.id ? ' selected' : ''}`}
                    onClick={() => onClick?.(req)}
                    onDoubleClick={() => onDoubleClick?.(req)}
                  >
                    <td className="article-cell">
                      <strong>{req.article}</strong>
                      {Array.isArray(req.lines) && req.lines.length > 1 && (
                        <span
                          className="ref-small"
                          title={req.lines.map((l) => l.article).join(', ')}
                        >
                          +{req.lines.length - 1} autre{req.lines.length - 1 > 1 ? 's' : ''} réf.
                        </span>
                      )}
                      {req.ref_code && <span className="ref-small">Réf: {req.ref_code}</span>}
                      {req.affaire_id && (
                        <span className="affaire-small">Aff: {req.affaire_id}</span>
                      )}
                    </td>
                    <td className="center">{req.quantity}</td>
                    <td>
                      <span className="priority-badge" style={{ color: priority.color }}>
                        {priority.icon} {priority.label}
                      </span>
                    </td>
                    <td>
                      {req.destination === 'Autre'
                        ? req.destination_other || 'Autre'
                        : req.destination}
                    </td>
                    <td>{req.supplier_name || '—'}</td>
                    <td>{req.requested_by_name || req.requested_by_name_db || '—'}</td>
                    <td>
                      <StatusBadge color={status.color}>
                        {status.icon} {status.label}
                      </StatusBadge>
                      {req.order_id && (
                        <span className="order-link-small">→ Cmd #{req.order_id}</span>
                      )}
                    </td>
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && req.status === STATUS.PENDING && (
                        <>
                          <Tooltip content="Approuver">
                            <Button
                              variant="success"
                              size="sm"
                              iconOnly
                              onClick={() => onValidate(req, 'approve')}
                            >
                              <Check size={14} />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Refuser">
                            <Button
                              variant="danger"
                              size="sm"
                              iconOnly
                              onClick={() => setRejectingId(req.id)}
                            >
                              <X size={14} />
                            </Button>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip content="Supprimer">
                        <Button variant="danger" size="sm" iconOnly onClick={() => onDelete(req)}>
                          <Trash2 size={14} />
                        </Button>
                      </Tooltip>
                    </td>
                  </tr>
                  {rejectingId === req.id && (
                    <tr className="reject-reason-row">
                      <td colSpan={8}>
                        <div className="reject-input-row">
                          <Input
                            type="text"
                            placeholder="Raison du refus (optionnel)"
                            aria-label="Raison du refus"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="reject-reason-input"
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              onValidate(req, 'reject', rejectReason);
                              setRejectingId(null);
                              setRejectReason('');
                            }}
                          >
                            Confirmer refus
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason('');
                            }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  },
);
