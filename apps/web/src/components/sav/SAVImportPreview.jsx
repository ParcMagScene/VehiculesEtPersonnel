/**
 * SAVImportPreview — Étape 2 : affiche les résultats du preview.
 *
 * Onglets :
 *  - Nouveaux       (à créer)
 *  - Mises à jour   (statut/dates changés depuis LocMat)
 *  - Clôtures       (tickets actifs eM@g absents du CSV — opt-in)
 *  - Collisions     (statut diverge, modif eM@g postérieure → décision manuelle)
 *  - Doublons       (lignes redondantes du CSV)
 *  - Erreurs        (parsing / dates illisibles)
 *
 * L'utilisateur peut :
 *  - décocher acceptNew / acceptUpdates / acceptClosures
 *  - pour chaque collision : "Garder eM@g" (défaut) ou "Forcer LocMat"
 *  - confirmer l'import → POST /api/sav/import/confirm
 *  - télécharger le rapport PDF après confirmation
 */
import { CheckCircle, Download, Upload, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button, InlineAlert, Input, Select, Spinner } from '@/design-system';

import api from '../../utils/api';

const TABS = [
  { key: 'newTickets', label: 'Nouveaux', color: '#16a34a' },
  { key: 'updatedTickets', label: 'Mises à jour', color: '#2563eb' },
  { key: 'closedTickets', label: 'Clôtures', color: '#7c3aed' },
  { key: 'collisions', label: 'Collisions', color: '#dc2626' },
  { key: 'duplicates', label: 'Doublons', color: '#f59e0b' },
  { key: 'errors', label: 'Erreurs', color: '#ef4444' },
];

const td = { padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 };
const th = { ...td, fontWeight: 600, background: '#f8fafc', textAlign: 'left' };

function StatusBadge({ status, statusLabels }) {
  const label = statusLabels?.[status] || status || '—';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: 4,
        background: '#f1f5f9',
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

export default function SAVImportPreview({ file, previewResp, onCancel, onDone }) {
  const { preview, statusLabels, importedAt } = previewResp;
  const [tab, setTab] = useState('newTickets');
  const [acceptNew, setAcceptNew] = useState(true);
  const [acceptUpdates, setAcceptUpdates] = useState(true);
  const [acceptClosures, setAcceptClosures] = useState(false);
  const [collisionDecisions, setCollisionDecisions] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [confirmResult, setConfirmResult] = useState(null);

  const counts = preview.summary;

  const items = preview[tab] || [];

  const setCollision = (ticketId, value) => {
    setCollisionDecisions((prev) => ({ ...prev, [ticketId]: value }));
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      const decisions = {
        acceptNew,
        acceptUpdates,
        acceptClosures,
        collisionResolutions: collisionDecisions,
      };
      const resp = await api.savImportConfirm(file, decisions);
      if (!resp.success) throw new Error(resp.error || 'Erreur confirm');
      setConfirmResult(resp);
    } catch (e) {
      setConfirmError(e.message || 'Erreur lors de la confirmation');
    } finally {
      setConfirming(false);
    }
  };

  const downloadPdf = async () => {
    if (!confirmResult?.importId) return;
    const blob = await api.exportSavImportPdf(confirmResult.importId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-import-sav-${confirmResult.importId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (confirmResult) {
    return (
      <div className="u-text-center u-p-6">
        <CheckCircle size={48} color="#16a34a" />
        <h3>Import #{confirmResult.importId} appliqué</h3>
        <p className="u-text-secondary">
          Créés : <strong>{confirmResult.counts.created}</strong> · Màj :{' '}
          <strong>{confirmResult.counts.updated}</strong> · Clôturés :{' '}
          <strong>{confirmResult.counts.closed}</strong> · Collisions résolues :{' '}
          <strong>{confirmResult.counts.collisions_resolved}</strong> · Ignorés :{' '}
          <strong>{confirmResult.counts.skipped}</strong>
        </p>
        <div className="u-flex u-gap-2 u-justify-center u-mt-4">
          <Button variant="secondary" onClick={downloadPdf}>
            <Download size={14} /> Télécharger le rapport PDF
          </Button>
          <Button variant="primary" onClick={onDone}>
            Terminé
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="u-p-4">
      <div className="u-flex-between">
        <h3 style={{ margin: 0 }}>Aperçu de l'import — {file?.name || 'CSV'}</h3>
        <span className="u-text-secondary u-font-xs">
          {counts.total} ligne{counts.total > 1 ? 's' : ''} traitée{counts.total > 1 ? 's' : ''} •{' '}
          {new Date(importedAt).toLocaleString('fr-FR')}
        </span>
      </div>

      {/* Onglets + compteurs */}
      <div className="u-flex u-gap-1 u-flex-wrap" style={{ margin: '16px 0' }}>
        {TABS.map((t) => {
          const count = (preview[t.key] || []).length;
          const active = tab === t.key;
          return (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 12px',
                border: '1px solid ' + (active ? t.color : '#e5e7eb'),
                borderRadius: 6,
                background: active ? t.color : '#fff',
                color: active ? '#fff' : '#374151',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {t.label} <strong>({count})</strong>
            </button>
          );
        })}
      </div>

      {/* Options décisions */}
      <div className="u-flex u-gap-4 u-mb-3" style={{ fontSize: 13 }}>
        <label>
          <Input
            type="checkbox"
            checked={acceptNew}
            onChange={(e) => setAcceptNew(e.target.checked)}
          />{' '}
          Créer nouveaux ({counts.new})
        </label>
        <label>
          <Input
            type="checkbox"
            checked={acceptUpdates}
            onChange={(e) => setAcceptUpdates(e.target.checked)}
          />{' '}
          Appliquer mises à jour ({counts.updated})
        </label>
        <label>
          <Input
            type="checkbox"
            checked={acceptClosures}
            onChange={(e) => setAcceptClosures(e.target.checked)}
          />{' '}
          Clôturer absents ({counts.closed})
        </label>
      </div>

      {/* Tableau onglet courant */}
      <div className="u-overflow-auto u-border u-radius-md" style={{ maxHeight: 380 }}>
        {items.length === 0 ? (
          <div className="u-p-8 u-text-center u-text-muted">
            Aucun élément dans cette catégorie.
          </div>
        ) : tab === 'errors' ? (
          <table className="u-table-base">
            <thead>
              <tr>
                <th style={th}>Ligne</th>
                <th style={th}>Message</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e, i) => (
                <tr key={i}>
                  <td style={td}>{e.line}</td>
                  <td style={td}>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'closedTickets' ? (
          <table className="u-table-base">
            <thead>
              <tr>
                <th style={th}>Ticket #</th>
                <th style={th}>Code LocMat</th>
                <th style={th}>SN/UID</th>
                <th style={th}>Statut actuel</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.ticket_id}>
                  <td style={td}>#{r.ticket_id}</td>
                  <td style={td}>{r.locmat_code || '—'}</td>
                  <td style={td}>{r.serial_number || r.uid || '—'}</td>
                  <td style={td}>
                    <StatusBadge status={r.current_status} statusLabels={statusLabels} />
                  </td>
                  <td style={td}>→ CLOTURE</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'collisions' ? (
          <table className="u-table-base">
            <thead>
              <tr>
                <th style={th}>Ticket #</th>
                <th style={th}>Code LocMat</th>
                <th style={th}>eM@g</th>
                <th style={th}>LocMat</th>
                <th style={th}>Décision</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.existing_ticket_id}>
                  <td style={td}>#{r.existing_ticket_id}</td>
                  <td style={td}>{r.locmat_code || '—'}</td>
                  <td style={td}>
                    <StatusBadge status={r.emag_status} statusLabels={statusLabels} />
                  </td>
                  <td style={td}>
                    <StatusBadge status={r.locmat_status} statusLabels={statusLabels} />
                  </td>
                  <td style={td}>
                    <Select
                      value={collisionDecisions[r.existing_ticket_id] || 'keep_emag'}
                      onChange={(e) => setCollision(r.existing_ticket_id, e.target.value)}
                      style={{ fontSize: 11, padding: '2px 4px' }}
                    >
                      <option value="keep_emag">Garder eM@g</option>
                      <option value="force_locmat">Forcer LocMat</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="u-table-base">
            <thead>
              <tr>
                <th style={th}>LocMat</th>
                <th style={th}>Article</th>
                <th style={th}>SN / UID</th>
                <th style={th}>Équipement</th>
                <th style={th}>Statut</th>
                <th style={th}>Entrée</th>
                <th style={th}>Sortie</th>
                <th style={th}>Coût</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.locmat_code || '—'}</td>
                  <td style={td}>{r.nom_article || r.code_article || '—'}</td>
                  <td style={td}>{r.serial_number || r.uid || '—'}</td>
                  <td style={td}>
                    {r.equipment_name ? (
                      <span className="u-text-success">
                        ✓ {r.equipment_name}
                        <small className="u-text-muted" style={{ marginLeft: 4 }}>
                          ({r.equipment_match})
                        </small>
                      </span>
                    ) : (
                      <span className="u-text-danger">
                        <XCircle size={12} style={{ verticalAlign: 'middle' }} /> non lié
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    <StatusBadge status={r.status} statusLabels={statusLabels} />
                  </td>
                  <td style={td}>{r.opened_at ? r.opened_at.slice(0, 10) : '—'}</td>
                  <td style={td}>{r.closed_at ? r.closed_at.slice(0, 10) : '—'}</td>
                  <td style={td}>{r.cost != null ? r.cost.toFixed(2) + ' €' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmError && (
        <div className="u-mt-3">
          <InlineAlert type="error">{confirmError}</InlineAlert>
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <Button variant="secondary" onClick={onCancel} disabled={confirming}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={confirming}>
          {confirming ? <Spinner size="sm" /> : <Upload size={14} />} Confirmer l'import
        </Button>
      </div>
    </div>
  );
}
