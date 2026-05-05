import { Link2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button, Checkbox, ModalLayout, Spinner } from '@/design-system';

import api from '../../utils/api';

const TYPE_LABELS = {
  client: 'Client',
  supplier: 'Fournisseur',
  prestataire: 'Prestataire',
};

const REASON_LABELS = {
  domain_exact: 'Domaine exact',
  domain_contains: 'Domaine partiel',
  local_contains: 'Identifiant email',
};

export default function MatchingContactEntitiesModal({ onClose, onLinked }) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getMatchingContactEntities();
        setMatches(res.matches || []);
      } catch (e) {
        console.error('Erreur chargement correspondances contacts:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const highConfidenceCount = useMemo(
    () => matches.filter((m) => Number(m.confidence || 0) >= 1).length,
    [matches],
  );

  const toggleSelection = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === matches.length) setSelected(new Set());
    else setSelected(new Set(matches.map((_, i) => i)));
  };

  const selectHighConfidence = () => {
    const indexes = matches
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => Number(m.confidence || 0) >= 1)
      .map(({ idx }) => idx);
    setSelected(new Set(indexes));
  };

  const handleApply = async () => {
    const links = [...selected].map((idx) => {
      const m = matches[idx];
      return {
        contact_id: m.contact_id,
        entity_type: m.entity_type,
        entity_id: m.entity_id,
        confidence: m.confidence,
        notes: m.match_reason,
      };
    });

    if (!links.length) return;

    setLinking(true);
    try {
      const res = await api.bulkLinkContactEntities(links);
      onLinked?.(res.linked || 0);
      onClose();
    } catch (e) {
      console.error('Erreur liaison contacts:', e);
    } finally {
      setLinking(false);
    }
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="Correspondances Contacts ↔ Entités"
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
        <div className="u-text-center u-p-8">
          <Spinner /> Analyse en cours...
        </div>
      ) : matches.length === 0 ? (
        <div className="u-text-center u-p-8 u-text-secondary">
          <Users size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>Aucune correspondance trouvée.</p>
          <p className="u-font-sm">
            Aucun contact ne correspond à une entité via son adresse email.
          </p>
        </div>
      ) : (
        <>
          <div className="u-flex-center u-gap-3 u-mb-3">
            <Checkbox
              checked={selected.size === matches.length && matches.length > 0}
              onChange={toggleAll}
              label={`Tout sélectionner (${matches.length})`}
            />
            {highConfidenceCount > 0 && (
              <Button variant="secondary" size="sm" onClick={selectHighConfidence}>
                Correspondances exactes ({highConfidenceCount})
              </Button>
            )}
          </div>
          <div className="matching-table-wrapper u-overflow-y-auto" style={{ maxHeight: 450 }}>
            <table className="matching-table u-table-base">
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ width: 40, padding: '8px 4px' }}></th>
                  <th style={{ padding: '8px 4px' }}>Contact</th>
                  <th style={{ padding: '8px 4px' }}>Entité</th>
                  <th style={{ padding: '8px 4px' }}>Critère</th>
                  <th style={{ padding: '8px 4px' }}>Confiance</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, idx) => (
                  <tr
                    key={`${m.contact_id}-${m.entity_type}-${m.entity_id}`}
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
                    <td style={{ padding: '6px 4px' }}>
                      <div style={{ fontWeight: 600 }}>
                        {[m.contact_prenom, m.contact_nom].filter(Boolean).join(' ') ||
                          m.contact_name}
                      </div>
                      {m.contact_email && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {m.contact_email}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {TYPE_LABELS[m.entity_type] || m.entity_type}
                      </div>
                      <div style={{ fontWeight: 600 }}>{m.entity_name}</div>
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
                            m.match_reason === 'domain_exact'
                              ? 'var(--color-success-bg)'
                              : 'var(--color-info-bg)',
                          color:
                            m.match_reason === 'domain_exact'
                              ? 'var(--color-success)'
                              : 'var(--color-info)',
                        }}
                      >
                        {REASON_LABELS[m.match_reason] || m.match_reason}
                      </span>
                    </td>
                    <td style={{ padding: '6px 4px', fontWeight: 600 }}>
                      {Math.round(Number(m.confidence || 0) * 100)}%
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
