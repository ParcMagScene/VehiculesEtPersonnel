import { Check, Plus, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import { Button, EntityCombobox, Input, ModalLayout, Select, Textarea } from '@/design-system';

import { formatCurrency } from '../../utils/formatUtils';
import AddressAutocomplete from '../AddressAutocomplete';
import { ORDER_STATUS, QUOTE_STATUS, UNITS } from './ordersConstants';

// ═══ Formulaire Commande ═══
export const OrderFormModal = React.memo(({ order, suppliers, onSave, onClose }) => {
  const itemIdCounter = useRef(0);
  const generateItemId = () => `item-${++itemIdCounter.current}`;
  // eslint-disable-next-line react-hooks/refs
  const [form, setForm] = useState(() => {
    const items = (
      order?.items || [{ designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }]
    ).map((i) => ({ ...i, _key: generateItemId() }));
    return {
      type: order?.type || 'purchase',
      supplier_id: order?.supplier_id || '',
      affaire_id: order?.affaire_id || '',
      status: order?.status || 'draft',
      order_date: order?.order_date || new Date().toISOString().slice(0, 10),
      expected_date: order?.expected_date || '',
      tva_rate: order?.tva_rate || 20,
      notes: order?.notes || '',
      items,
    };
  });

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { designation: '', quantity: 1, unit: 'u', unit_price_ht: 0, _key: generateItemId() },
      ],
    }));
  const removeItem = (idx) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const totalHT = useMemo(
    () => form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price_ht || 0), 0),
    [form.items],
  );
  const totalTTC = totalHT * (1 + (form.tva_rate || 0) / 100);

  return (
    <ModalLayout
      open
      onClose={onClose}
      size="lg"
      title={order?.id ? `Modifier ${order.reference}` : 'Nouvelle commande'}
      className="order-form-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave(form)}
            disabled={!form.items.some((i) => i.designation)}
          >
            <Check size={16} /> {order?.id ? 'Enregistrer' : 'Créer la commande'}
          </Button>
        </>
      }
    >
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-field">
            <label>Fournisseur</label>
            <EntityCombobox
              value={form.supplier_id}
              onChange={(val) => setForm((f) => ({ ...f, supplier_id: val }))}
              options={suppliers}
              placeholder="— Sélectionner —"
            />
          </div>
          <div className="form-field">
            <label>Code affaire</label>
            <Input
              type="text"
              value={form.affaire_id}
              onChange={(e) => setForm((f) => ({ ...f, affaire_id: e.target.value }))}
              placeholder="ex: AF32844"
            />
          </div>
          <div className="form-field">
            <label>Date commande</label>
            <input
              type="date"
              value={form.order_date}
              onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Date prévue</label>
            <input
              type="date"
              value={form.expected_date}
              onChange={(e) => setForm((f) => ({ ...f, expected_date: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>TVA (%)</label>
            <Input
              type="number"
              value={form.tva_rate}
              onChange={(e) =>
                setForm((f) => ({ ...f, tva_rate: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          {order?.id && (
            <div className="form-field">
              <label>Statut</label>
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(ORDER_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="form-items-section">
          <div className="items-header">
            <h3>Lignes de commande</h3>
            <Button variant="ghost" type="button" className="add-item-btn" onClick={addItem}>
              <Plus size={14} /> Ajouter une ligne
            </Button>
          </div>
          {form.items.map((item, idx) => (
            <div key={item._key} className="item-row">
              <Input
                type="text"
                placeholder="Désignation"
                value={item.designation}
                onChange={(e) => updateItem(idx, 'designation', e.target.value)}
                className="item-designation"
              />
              <Input
                type="number"
                placeholder="Qté"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                className="item-qty"
              />
              <Select
                value={item.unit}
                onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                className="item-unit"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                placeholder="P.U. HT"
                value={item.unit_price_ht}
                onChange={(e) => updateItem(idx, 'unit_price_ht', parseFloat(e.target.value) || 0)}
                step="0.01"
                className="item-price"
              />
              <span className="item-total">
                {formatCurrency((item.quantity || 0) * (item.unit_price_ht || 0))}
              </span>
              <Input
                type="text"
                placeholder="Affaire / Demandeur"
                value={item.source_affaire_id || ''}
                onChange={(e) => updateItem(idx, 'source_affaire_id', e.target.value)}
                className="item-source"
                title="Affaire ou demandeur source"
              />
              {form.items.length > 1 && (
                <Button
                  variant="ghost"
                  type="button"
                  className="remove-item-btn"
                  onClick={() => removeItem(idx)}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
          ))}
          <div className="items-totals">
            <span>
              Total HT: <strong>{formatCurrency(totalHT)}</strong>
            </span>
            <span>
              TVA ({form.tva_rate}%): <strong>{formatCurrency(totalTTC - totalHT)}</strong>
            </span>
            <span>
              Total TTC: <strong>{formatCurrency(totalTTC)}</strong>
            </span>
          </div>
        </div>

        <div className="form-field full-width">
          <label>Notes</label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </div>
      </div>
    </ModalLayout>
  );
});

// ═══ Formulaire Devis ═══
export const QuoteFormModal = React.memo(({ quote, clients = [], onSave, onClose }) => {
  const itemIdCounter = useRef(0);
  const generateItemId = () => `item-${++itemIdCounter.current}`;
  // eslint-disable-next-line react-hooks/refs
  const [form, setForm] = useState(() => {
    const items = (
      quote?.items || [{ designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }]
    ).map((i) => ({ ...i, _key: generateItemId() }));
    return {
      client_name: quote?.client_name || '',
      client_email: quote?.client_email || '',
      client_address: quote?.client_address || '',
      affaire_id: quote?.affaire_id || '',
      status: quote?.status || 'draft',
      quote_date: quote?.quote_date || new Date().toISOString().slice(0, 10),
      validity_date: quote?.validity_date || '',
      tva_rate: quote?.tva_rate || 20,
      notes: quote?.notes || '',
      items,
    };
  });

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { designation: '', quantity: 1, unit: 'u', unit_price_ht: 0, _key: generateItemId() },
      ],
    }));
  const removeItem = (idx) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const totalHT = useMemo(
    () => form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price_ht || 0), 0),
    [form.items],
  );
  const totalTTC = totalHT * (1 + (form.tva_rate || 0) / 100);

  return (
    <ModalLayout
      open
      onClose={onClose}
      size="lg"
      title={quote ? `Modifier ${quote.reference}` : 'Nouveau devis'}
      className="order-form-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave(form)}
            disabled={!form.items.some((i) => i.designation)}
          >
            <Check size={16} /> {quote ? 'Enregistrer' : 'Créer le devis'}
          </Button>
        </>
      }
    >
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-field">
            <label>Nom client</label>
            <Input
              type="text"
              value={form.client_name}
              onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
              list="quote-clients-autocomplete"
            />
            <datalist id="quote-clients-autocomplete">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="form-field">
            <label>Email client</label>
            <Input
              type="email"
              value={form.client_email}
              onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
            />
          </div>
          <div className="form-field full-width">
            <label>Adresse client</label>
            <AddressAutocomplete
              value={form.client_address}
              onChange={(val) => setForm((f) => ({ ...f, client_address: val }))}
            />
          </div>
          <div className="form-field">
            <label>Code affaire</label>
            <Input
              type="text"
              value={form.affaire_id}
              onChange={(e) => setForm((f) => ({ ...f, affaire_id: e.target.value }))}
              placeholder="ex: AF32844"
            />
          </div>
          <div className="form-field">
            <label>Date devis</label>
            <input
              type="date"
              value={form.quote_date}
              onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Validité</label>
            <input
              type="date"
              value={form.validity_date}
              onChange={(e) => setForm((f) => ({ ...f, validity_date: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>TVA (%)</label>
            <Input
              type="number"
              value={form.tva_rate}
              onChange={(e) =>
                setForm((f) => ({ ...f, tva_rate: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          {quote && (
            <div className="form-field">
              <label>Statut</label>
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(QUOTE_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="form-items-section">
          <div className="items-header">
            <h3>Lignes du devis</h3>
            <Button variant="ghost" type="button" className="add-item-btn" onClick={addItem}>
              <Plus size={14} /> Ajouter une ligne
            </Button>
          </div>
          {form.items.map((item, idx) => (
            <div key={item._key} className="item-row">
              <Input
                type="text"
                placeholder="Désignation"
                value={item.designation}
                onChange={(e) => updateItem(idx, 'designation', e.target.value)}
                className="item-designation"
              />
              <Input
                type="number"
                placeholder="Qté"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                className="item-qty"
              />
              <Select
                value={item.unit}
                onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                className="item-unit"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                placeholder="P.U. HT"
                value={item.unit_price_ht}
                onChange={(e) => updateItem(idx, 'unit_price_ht', parseFloat(e.target.value) || 0)}
                step="0.01"
                className="item-price"
              />
              <span className="item-total">
                {formatCurrency((item.quantity || 0) * (item.unit_price_ht || 0))}
              </span>
              {form.items.length > 1 && (
                <Button
                  variant="ghost"
                  type="button"
                  className="remove-item-btn"
                  onClick={() => removeItem(idx)}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
          ))}
          <div className="items-totals">
            <span>
              Total HT: <strong>{formatCurrency(totalHT)}</strong>
            </span>
            <span>
              TVA ({form.tva_rate}%): <strong>{formatCurrency(totalTTC - totalHT)}</strong>
            </span>
            <span>
              Total TTC: <strong>{formatCurrency(totalTTC)}</strong>
            </span>
          </div>
        </div>

        <div className="form-field full-width">
          <label>Notes</label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </div>
      </div>
    </ModalLayout>
  );
});
