/**
 * GenerateOrdersModal — Créer/Mettre à jour des commandes depuis les articles d'une affaire
 * Détecte les fournisseurs, propose créer ou ajouter à une commande existante.
 */
import './GenerateOrdersModal.css';

import {
  AlertTriangle,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Loader,
  Package,
  Plus,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  EmptyState,
  InlineAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Table,
} from '@/design-system';

import api from '../../utils/api';

const STATUS_LABELS = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  confirmed: 'Confirmée',
  partial: 'Partielle',
  received: 'Reçue',
  cancelled: 'Annulée',
};

export default function GenerateOrdersModal({ affaireId, affaireReference, onClose, onGenerated }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [supplierActions, setSupplierActions] = useState({}); // { supplierName: { action: 'create'|'add', orderId: number } }
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);

  // Charger les données
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await api.prepareOrdersFromAffaire(affaireId);
        setData(result);
        // Pré-sélectionner l'action par défaut pour chaque fournisseur
        const defaults = {};
        for (const s of result.suppliers || []) {
          if (s.existing_orders?.length > 0) {
            defaults[s.name] = { action: 'add', orderId: s.existing_orders[0].id };
          } else {
            defaults[s.name] = { action: 'create', orderId: null };
          }
        }
        setSupplierActions(defaults);
      } catch (err) {
        setError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [affaireId]);

  const setAction = useCallback((supplierName, action, orderId = null) => {
    setSupplierActions((prev) => ({ ...prev, [supplierName]: { action, orderId } }));
  }, []);

  // Exécuter les actions
  const handleSubmit = async () => {
    if (processing || !data) return;
    setProcessing(true);
    const resultsList = [];
    try {
      for (const supplier of data.suppliers) {
        const config = supplierActions[supplier.name];
        if (!config) continue;

        const items = (supplier.items || []).map((it) => ({
          designation: it.description || it.designation || '—',
          quantity: it.quantity || 1,
          unit: 'u',
          unit_price_ht: it.unit_price_ht || 0,
          tva_rate: 20,
          ref_code: it.code || null,
          source_affaire_id: affaireId,
          source_type: 'affaire',
        }));

        if (config.action === 'create') {
          const result = await api.generateOrdersFromBL({
            affaire_id: affaireId,
            affaire_reference: affaireReference || affaireId,
            items: supplier.items,
          });
          resultsList.push({
            supplier: supplier.name,
            action: 'create',
            success: true,
            reference: result.orders?.[0]?.reference,
            count: supplier.items?.length || 0,
          });
        } else if (config.action === 'add' && config.orderId) {
          await api.addItemsToOrder(config.orderId, items);
          const targetOrder = (supplier.existing_orders || []).find((o) => o.id === config.orderId);
          resultsList.push({
            supplier: supplier.name,
            action: 'add',
            success: true,
            reference: targetOrder?.reference,
            count: supplier.items?.length || 0,
          });
        }
      }
      setResults(resultsList);
    } catch (err) {
      setResults([
        ...resultsList,
        { supplier: '—', action: 'error', success: false, error: err.message },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (results && results.some((r) => r.success)) {
      onGenerated?.();
    }
    onClose();
  };

  const activeSuppliers = data?.suppliers?.filter((s) => supplierActions[s.name]) || [];
  const totalArticles = activeSuppliers.reduce((sum, s) => sum + (s.items?.length || 0), 0);

  return (
    <Modal open onClose={handleClose} size="lg" className="gen-orders-modal">
      <ModalHeader icon={<ShoppingCart size={20} />} onClose={handleClose}>
        Commandes — {affaireReference || affaireId}
      </ModalHeader>

      <ModalBody>
        {loading && (
          <div className="gen-orders-loading">
            <Loader size={24} className="spin-slow" />
            <span>Analyse des articles et fournisseurs…</span>
          </div>
        )}

        {error && <InlineAlert>{error}</InlineAlert>}

        {!loading && !error && data && (
          <>
            {data.suppliers.length === 0 ? (
              <EmptyState
                icon={<Package size={32} />}
                title="Aucun fournisseur identifié dans les BL de cette affaire."
                description="Importez un BL contenant des articles avec fournisseurs."
              />
            ) : (
              <>
                <div className="gen-orders-summary">
                  <span>
                    <Package size={14} /> {data.total_items} article
                    {data.total_items > 1 ? 's' : ''}
                  </span>
                  <span>
                    <Truck size={14} /> {data.suppliers.length} fournisseur
                    {data.suppliers.length > 1 ? 's' : ''}
                  </span>
                  {data.no_supplier_items?.length > 0 && (
                    <span className="gen-orders-warn">
                      <AlertTriangle size={13} /> {data.no_supplier_items.length} sans fournisseur
                    </span>
                  )}
                </div>

                <div className="gen-orders-suppliers">
                  {data.suppliers.map((supplier) => (
                    <SupplierBlock
                      key={supplier.name}
                      supplier={supplier}
                      config={supplierActions[supplier.name]}
                      onChangeAction={setAction}
                    />
                  ))}
                </div>
              </>
            )}

            {results && <ResultsSummary results={results} />}
          </>
        )}
      </ModalBody>

      {/* Footer */}
      {!loading && !error && data && data.suppliers.length > 0 && !results && (
        <ModalFooter>
          <Button variant="ghost" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={processing || totalArticles === 0}
          >
            <Briefcase size={15} />
            {processing
              ? 'Traitement…'
              : `Exécuter (${activeSuppliers.length} fournisseur${activeSuppliers.length > 1 ? 's' : ''})`}
          </Button>
        </ModalFooter>
      )}

      {results && (
        <ModalFooter>
          <Button variant="primary" onClick={handleClose}>
            Fermer
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}

// ━━━ Bloc par fournisseur ━━━
function SupplierBlock({ supplier, config, onChangeAction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="supplier-block">
      <div
        className="supplier-header"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="supplier-expand">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="supplier-info">
          <span className="supplier-name">{supplier.name}</span>
          <span className="supplier-count">
            {supplier.items?.length || 0} article{(supplier.items?.length || 0) > 1 ? 's' : ''}
          </span>
        </div>
        <div className="supplier-action-select" onClick={(e) => e.stopPropagation()}>
          {supplier.existing_orders?.length > 0 ? (
            <Select
              value={config?.action === 'add' ? `add-${config.orderId}` : 'create'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'create') {
                  onChangeAction(supplier.name, 'create');
                } else {
                  const orderId = parseInt(val.replace('add-', ''));
                  onChangeAction(supplier.name, 'add', orderId);
                }
              }}
            >
              <option value="create">+ Nouvelle commande</option>
              {supplier.existing_orders.map((o) => (
                <option key={o.id} value={`add-${o.id}`}>
                  Ajouter à {o.reference} ({STATUS_LABELS[o.status] || o.status} — {o.item_count}{' '}
                  art.)
                </option>
              ))}
            </Select>
          ) : (
            <span className="supplier-new-badge">
              <Plus size={12} /> Nouvelle commande
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="supplier-items">
          <Table className="supplier-items-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Désignation</th>
                <th>Qté</th>
                <th>P.U. HT</th>
              </tr>
            </thead>
            <tbody>
              {(supplier.items || []).map((item, i) => (
                <tr key={i}>
                  <td className="si-ref">{item.code || '—'}</td>
                  <td className="si-desc">{item.description || '—'}</td>
                  <td className="si-qty">{item.quantity ?? '—'}</td>
                  <td className="si-price">
                    {item.unit_price_ht ? `${item.unit_price_ht.toFixed(2)} €` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ━━━ Résumé des résultats ━━━
function ResultsSummary({ results }) {
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  return (
    <div className="gen-orders-results">
      <h4>
        <Check size={18} /> Résultat
      </h4>
      {successes.map((r, i) => (
        <div key={i} className="result-row success">
          <Check size={14} />
          <span>
            <strong>{r.supplier}</strong> —{' '}
            {r.action === 'create' ? 'Commande créée' : 'Articles ajoutés à'}{' '}
            <strong>{r.reference}</strong> ({r.count} article{r.count > 1 ? 's' : ''})
          </span>
        </div>
      ))}
      {failures.map((r, i) => (
        <div key={i} className="result-row error">
          <AlertTriangle size={14} />
          <span>{r.error || 'Erreur inconnue'}</span>
        </div>
      ))}
    </div>
  );
}
