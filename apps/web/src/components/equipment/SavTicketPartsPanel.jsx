// apps/web/src/components/equipment/SavTicketPartsPanel.jsx
//
// Ticket : T-P1-07c (SAV v2 — panel pieces enrichi).
//
// Panel React consommant les fondations T-P1-07b :
//   - `fetchSavPartsUnified`       (liste des pieces)
//   - `addSavPartUnified`          (ajout d'une piece)
//   - `updateSavPartStatusUnified` (change statut piece)
//   - `transitionSavTicketUnified` (transition du ticket)
//
// Composant intentionnellement **standalone** : il ne modifie pas
// `EquipmentSAV.jsx` (fichier volumineux, ~1200 lignes) et se
// branche via un simple import + rendu conditionnel au flag
// `VITE_FEATURE_V2_SAV` dans `SavSlidePanel`. Zero regression pour
// les utilisateurs en prod (le flag est off par defaut).
//
// Le panel est safe-by-default :
//   - Affiche un message "Namespace v2 desactive" si le flag est
//     off, si `api.v2ListSavParts` est absent, ou si le serveur
//     renvoie FEATURE_DISABLED (les helpers renvoient `null`).
//   - Toast inline succes/erreur.
//   - Refresh auto de la liste apres chaque mutation.
//   - Matrice `SAV_TICKET_TRANSITIONS` respectee : le dropdown de
//     transition ne propose que les cibles valides depuis l'etat
//     courant.

import './SavTicketPartsPanel.css';

import { AlertCircle, CheckCircle, Loader2, Package, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button, FormField, InlineAlert, Input, Select } from '@/design-system';

import api from '../../utils/api';
import {
  addSavPartUnified,
  fetchSavPartsUnified,
  transitionSavTicketUnified,
  updateSavPartStatusUnified,
} from '../../utils/sav/fetchSavParts.js';
import {
  getSavAllowedNext,
  readSavV2ClientFlag,
  SAV_PART_STATUSES,
} from '../../utils/sav/v2Adapters.js';

const PART_STATUS_LABELS = {
  requested: 'Demandée',
  ordered: 'Commandée',
  received: 'Reçue',
  installed: 'Installée',
  cancelled: 'Annulée',
};

const TICKET_STATUS_LABELS = {
  open: 'Ouvert',
  in_progress: 'En cours',
  waiting_parts: 'Attente pièces',
  resolved: 'Résolu',
  sortie_sav: 'Sortie SAV',
  closed: 'Fermé',
};

const INITIAL_FORM = Object.freeze({
  partName: '',
  partReference: '',
  quantity: '1',
  unitPrice: '',
  supplier: '',
  notes: '',
});

/**
 * @param {object} props
 * @param {number|null} props.ticketId
 * @param {string} [props.ticketStatus] Statut courant du ticket (pour
 *   proposer les transitions valides et masquer les auto-transitions).
 * @param {() => void} [props.onTicketTransitioned] Callback apres
 *   transition reussie (permet au parent de rafraichir sa liste).
 */
export default function SavTicketPartsPanel({ ticketId, ticketStatus, onTicketTransitioned }) {
  const flagOn = readSavV2ClientFlag();

  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState('');

  const refresh = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    const result = await fetchSavPartsUnified(api, ticketId, { useV2: flagOn });
    if (result === null) {
      setAvailable(false);
      setParts([]);
      setTotal(0);
    } else {
      setAvailable(true);
      setParts(result.parts);
      setTotal(result.total);
    }
    setLoading(false);
  }, [ticketId, flagOn]);

  useEffect(() => {
    if (!ticketId) return;
    refresh();
  }, [ticketId, refresh]);

  const handleAddPart = async (event) => {
    event.preventDefault();
    if (!form.partName.trim()) {
      setError('Le nom de la pièce est requis');
      return;
    }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('La quantité doit être supérieure à 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const created = await addSavPartUnified(
      api,
      ticketId,
      {
        partName: form.partName.trim(),
        partReference: form.partReference.trim() || null,
        quantity: qty,
        unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
      },
      { useV2: flagOn },
    );
    setSubmitting(false);
    if (created === null) {
      setError("Impossible d'ajouter la pièce (v2 indisponible ou erreur réseau)");
      return;
    }
    setSuccess(`Pièce « ${created.partName} » ajoutée.`);
    setForm(INITIAL_FORM);
    setShowForm(false);
    await refresh();
  };

  const handleChangeStatus = async (partId, newStatus) => {
    setError(null);
    setSuccess(null);
    const updated = await updateSavPartStatusUnified(api, partId, newStatus, { useV2: flagOn });
    if (updated === null) {
      setError(
        `Impossible de passer la pièce en « ${PART_STATUS_LABELS[newStatus] || newStatus} »`,
      );
      return;
    }
    setSuccess(`Statut mis à jour : « ${PART_STATUS_LABELS[newStatus] || newStatus} »`);
    await refresh();
  };

  const handleTransitionTicket = async () => {
    if (!transitionTarget || !ticketStatus) return;
    setError(null);
    setSuccess(null);
    const result = await transitionSavTicketUnified(api, ticketId, transitionTarget, {
      useV2: flagOn,
    });
    if (result === null) {
      setError(
        `Impossible de transitionner le ticket vers « ${TICKET_STATUS_LABELS[transitionTarget] || transitionTarget} »`,
      );
      return;
    }
    setSuccess(
      `Ticket passé de « ${TICKET_STATUS_LABELS[ticketStatus] || ticketStatus} » à « ${TICKET_STATUS_LABELS[transitionTarget] || transitionTarget} »`,
    );
    setTransitionTarget('');
    if (typeof onTicketTransitioned === 'function') onTicketTransitioned(result);
    await refresh();
  };

  if (!ticketId) return null;

  if (!available && !loading) {
    return (
      <div className="sav-parts-panel sav-parts-panel--disabled">
        <div className="sav-parts-panel__header">
          <Package size={16} />
          <span>Pièces SAV (v2)</span>
        </div>
        <InlineAlert variant="info">
          Namespace v2 SAV désactivé (flag <code>VITE_FEATURE_V2_SAV</code> off ou serveur
          <code>FEATURE_DISABLED</code>). Le suivi des pièces n&apos;est pas disponible dans ce
          mode.
        </InlineAlert>
      </div>
    );
  }

  // Cibles de transition proposees (exclut l'auto-transition).
  const transitionOptions = ticketStatus
    ? getSavAllowedNext(ticketStatus).filter((s) => s !== ticketStatus)
    : [];

  return (
    <div className="sav-parts-panel">
      <div className="sav-parts-panel__header">
        <Package size={16} />
        <span>
          Pièces SAV{' '}
          <strong>
            ({total}
            {loading ? ' · chargement…' : ''})
          </strong>
        </span>
        <div className="sav-parts-panel__actions">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} title="Rafraîchir">
            {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowForm((v) => !v);
              setError(null);
              setSuccess(null);
            }}
            disabled={loading || submitting}
          >
            <Plus size={14} /> {showForm ? 'Annuler' : 'Ajouter'}
          </Button>
        </div>
      </div>

      {error && (
        <InlineAlert variant="error" dismissible onDismiss={() => setError(null)}>
          <AlertCircle size={14} /> {error}
        </InlineAlert>
      )}
      {success && (
        <InlineAlert variant="success" dismissible onDismiss={() => setSuccess(null)}>
          <CheckCircle size={14} /> {success}
        </InlineAlert>
      )}

      {showForm && (
        <form className="sav-parts-panel__form" onSubmit={handleAddPart}>
          <div className="sav-parts-panel__form-grid">
            <FormField label="Nom pièce" required>
              <Input
                value={form.partName}
                onChange={(e) => setForm((f) => ({ ...f, partName: e.target.value }))}
                placeholder="Ex : Fusible 5A"
                autoFocus
              />
            </FormField>
            <FormField label="Référence">
              <Input
                value={form.partReference}
                onChange={(e) => setForm((f) => ({ ...f, partReference: e.target.value }))}
                placeholder="Ex : F5A-125V"
              />
            </FormField>
            <FormField label="Quantité" required>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </FormField>
            <FormField label="Prix unitaire (€)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              />
            </FormField>
            <FormField label="Fournisseur">
              <Input
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              />
            </FormField>
            <FormField label="Notes">
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
          </div>
          <div className="sav-parts-panel__form-actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Ajouter la pièce
            </Button>
          </div>
        </form>
      )}

      {parts.length === 0 && !loading ? (
        <div className="sav-parts-panel__empty">Aucune pièce enregistrée pour ce ticket.</div>
      ) : (
        <ul className="sav-parts-panel__list">
          {parts.map((p) => (
            <li key={p.id} className="sav-parts-panel__item">
              <div className="sav-parts-panel__item-main">
                <strong>{p.partName}</strong>
                {p.partReference && (
                  <span className="sav-parts-panel__ref">réf. {p.partReference}</span>
                )}
                <span className="sav-parts-panel__qty">
                  ×{p.quantity}
                  {p.unitPrice != null && <> · {Number(p.unitPrice).toFixed(2)} €</>}
                </span>
                {p.supplier && <span className="sav-parts-panel__supplier">{p.supplier}</span>}
              </div>
              <div className="sav-parts-panel__item-status">
                <Select
                  value={p.status || 'requested'}
                  onChange={(e) => handleChangeStatus(p.id, e.target.value)}
                  disabled={loading || submitting}
                >
                  {SAV_PART_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PART_STATUS_LABELS[s] || s}
                    </option>
                  ))}
                </Select>
              </div>
            </li>
          ))}
        </ul>
      )}

      {ticketStatus && transitionOptions.length > 0 && (
        <div className="sav-parts-panel__transition">
          <span>
            Ticket actuellement{' '}
            <strong>{TICKET_STATUS_LABELS[ticketStatus] || ticketStatus}</strong>. Transitionner
            vers :
          </span>
          <div className="sav-parts-panel__transition-controls">
            <Select
              value={transitionTarget}
              onChange={(e) => setTransitionTarget(e.target.value)}
              disabled={loading || submitting}
            >
              <option value="">— Choisir une cible —</option>
              {transitionOptions.map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABELS[s] || s}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTransitionTicket}
              disabled={!transitionTarget || loading || submitting}
            >
              Appliquer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
