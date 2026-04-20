import './AnnuairePanel.css';

import { Check, Link2, MapPin } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button, Checkbox, ModalLayout, Spinner } from '@/design-system';

import api from '../../utils/api';

const TYPE_LABELS = {
  client: 'Client',
  supplier: 'Fournisseur',
  prestataire: 'Prestataire',
};

const REASON_LABELS = {
  name: 'Nom similaire',
  address: 'Adresse similaire',
  city: 'Ville + adresse',
};

export default function MatchingLocationsModal({ onClose, onLinked }) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getMatchingLocations();
        setMatches(res.matches || []);
      } catch (e) {
        console.error('Erreur chargement correspondances:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleSelection = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === matches.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(matches.map((_, i) => i)));
    }
  };

  const handleApply = async () => {
    const links = [...selected].map((idx) => ({
      entity_type: matches[idx].entity_type,
      entity_id: matches[idx].entity_id,
      location_id: matches[idx].location_id,
    }));
    if (!links.length) return;

    setLinking(true);
    try {
      const res = await api.bulkLinkLocations(links);
      onLinked?.(res.linked || 0);
      onClose();
    } catch (e) {
      console.error('Erreur liaison:', e);
    } finally {
      setLinking(false);
    }
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="Correspondances Lieux ↔ Entités"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="primary" onClick={handleApply} disabled={selected.size === 0 || linking}>
            {linking ? <Spinner size={14} /> : <Link2 size={15} />}
            Lier {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spinner /> Analyse en cours…
        </div>
      ) : matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
          <MapPin size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>Aucune correspondance trouvée.</p>
          <p style={{ fontSize: '0.85rem' }}>
            Toutes les entités sont déjà liées ou aucun nom/adresse ne correspond.
          </p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Checkbox
              checked={selected.size === matches.length}
              onChange={toggleAll}
              label={`Tout sélectionner (${matches.length})`}
            />
          </div>
          <div className="matching-table-wrapper" style={{ maxHeight: 450, overflowY: 'auto' }}>
            <table className="matching-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ width: 40, padding: '8px 4px' }}></th>
                  <th style={{ padding: '8px 4px' }}>Type</th>
                  <th style={{ padding: '8px 4px' }}>Entité</th>
                  <th style={{ padding: '8px 4px' }}>Adresse entité</th>
                  <th style={{ padding: '8px 4px' }}>Lieu proposé</th>
                  <th style={{ padding: '8px 4px' }}>Adresse lieu</th>
                  <th style={{ padding: '8px 4px' }}>Critère</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, idx) => (
                  <tr
                    key={`${m.entity_type}-${m.entity_id}-${m.location_id}`}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: selected.has(idx) ? 'var(--bg-accent-subtle)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleSelection(idx)}
                  >
                    <td style={{ padding: '6px 4px' }}>
                      <Checkbox checked={selected.has(idx)} onChange={() => toggleSelection(idx)} />
                    </td>
                    <td style={{ padding: '6px 4px', fontSize: '0.85rem' }}>
                      {TYPE_LABELS[m.entity_type] || m.entity_type}
                    </td>
                    <td style={{ padding: '6px 4px', fontWeight: 500 }}>{m.entity_name}</td>
                    <td
                      style={{
                        padding: '6px 4px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {[m.entity_address, m.entity_city].filter(Boolean).join(', ')}
                    </td>
                    <td style={{ padding: '6px 4px', fontWeight: 500 }}>
                      <MapPin size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                      {m.location_name}
                    </td>
                    <td
                      style={{
                        padding: '6px 4px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {m.location_address}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <span
                        className="matching-badge"
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          background:
                            m.match_reason === 'name'
                              ? 'var(--color-success-bg)'
                              : 'var(--color-info-bg)',
                          color:
                            m.match_reason === 'name'
                              ? 'var(--color-success)'
                              : 'var(--color-info)',
                        }}
                      >
                        {REASON_LABELS[m.match_reason] || m.match_reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ModalLayout>
  );
}
