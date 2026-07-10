// apps/web/src/components/admin/AdminEquipmentUidPanel.jsx
//
// Ticket : T-P1-06c (Equipment UID v2 — panel admin dogfooding).
//
// Panel admin standalone consommant les fondations livrees en
// T-P1-06b (`fetchEquipmentUidAuditUnified`,
// `regenerateEquipmentUidUnified`).
//
// Affichage :
//   - Compteurs (total / avec UID / sans UID / avec serial).
//   - Verdict serveur (chip vert = OK, orange = a corriger).
//   - Table des doublons serial (lecture seule, informative).
//   - Table des doublons UID (avec bouton "Regenerer UID" par ligne).
//
// Le composant est monte uniquement si :
//   - user admin (verifie par le parent avant rendu).
//   - flag serveur v2 actif (retour `null` → message d'invitation
//     a activer FEATURE_V2_EQUIPMENT_UID).
//
// Aucune modification des donnees v1 : toute la lecture/ecriture
// passe par le namespace `/api/v2/equipment-uid/*`.

import { AlertTriangle, CheckCircle2, Fingerprint, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/design-system';

import api from '../../utils/api';
import {
  fetchEquipmentUidAuditUnified,
  regenerateEquipmentUidUnified,
} from '../../utils/equipmentUid/fetchEquipmentUidAudit.js';
import { readEquipmentUidV2ClientFlag } from '../../utils/equipmentUid/v2Adapters.js';

const CARD_STYLE = {
  padding: 16,
  border: '1px solid var(--theme-border)',
  borderRadius: 8,
  background: 'var(--theme-surface)',
};

const STAT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 120,
};

const STAT_NUMBER_STYLE = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: 'var(--theme-text-primary)',
};

const STAT_LABEL_STYLE = {
  fontSize: '0.78rem',
  color: 'var(--theme-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

/**
 * @typedef {object} AdminEquipmentUidPanelProps
 * @property {object} [apiOverride] - Injection facultative pour les tests.
 * @property {boolean} [flagOverride] - Injection facultative du flag pour les tests.
 */

/**
 * @param {AdminEquipmentUidPanelProps} props
 */
export default function AdminEquipmentUidPanel({ apiOverride, flagOverride } = {}) {
  const client = apiOverride ?? api;
  const useV2 = typeof flagOverride === 'boolean' ? flagOverride : readEquipmentUidV2ClientFlag();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(new Set());
  const [regenErrorId, setRegenErrorId] = useState(null);

  const loadAudit = useCallback(async () => {
    if (!useV2) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEquipmentUidAuditUnified(client, { useV2 });
      if (result === null) {
        setError('audit-indisponible');
        setReport(null);
      } else {
        setReport(result);
      }
    } finally {
      setLoading(false);
    }
  }, [client, useV2]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const handleRegenerate = useCallback(
    async (equipmentId) => {
      setRegenErrorId(null);
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.add(equipmentId);
        return next;
      });
      try {
        const result = await regenerateEquipmentUidUnified(client, equipmentId, {
          reason: 'admin-panel-regen',
          useV2,
        });
        if (result === null) {
          setRegenErrorId(equipmentId);
          return;
        }
        // Recharge l'audit apres regeneration pour refleter le nouvel
        // etat des doublons.
        await loadAudit();
      } finally {
        setRegenerating((prev) => {
          const next = new Set(prev);
          next.delete(equipmentId);
          return next;
        });
      }
    },
    [client, loadAudit, useV2],
  );

  if (!useV2) {
    return (
      <div style={CARD_STYLE} data-testid="admin-uid-panel-flag-off">
        <div className="u-flex-center u-gap-2 u-mb-2">
          <Fingerprint size={18} />
          <strong>Diagnostics UID equipement (v2)</strong>
        </div>
        <p className="u-text-muted">
          Le namespace v2 <code>/api/v2/equipment-uid/*</code> n&apos;est pas active cote client.
          Definissez <code>VITE_FEATURE_V2_EQUIPMENT_UID=1</code> dans votre <code>.env.local</code>
          pour dogfooder ce panel.
        </p>
      </div>
    );
  }

  if (loading && !report) {
    return (
      <div style={CARD_STYLE} data-testid="admin-uid-panel-loading">
        <div className="u-flex-center u-gap-2">
          <RefreshCw size={16} className="u-animate-spin" />
          <span>Chargement de l&apos;audit UID...</span>
        </div>
      </div>
    );
  }

  if (error === 'audit-indisponible') {
    return (
      <div style={CARD_STYLE} data-testid="admin-uid-panel-error">
        <div className="u-flex-center u-gap-2 u-mb-2">
          <AlertTriangle size={18} color="var(--theme-warning, orange)" />
          <strong>Audit UID indisponible</strong>
        </div>
        <p className="u-text-muted">
          Le serveur a repondu &quot;audit indisponible&quot; (flag serveur eteint, erreur reseau ou
          endpoint non accessible). Verifiez <code>FEATURE_V2_EQUIPMENT_UID</code> cote API et
          rechargez.
        </p>
        <Button variant="secondary" onClick={loadAudit}>
          Reessayer
        </Button>
      </div>
    );
  }

  if (!report) return null;

  const isOk = report.verdict?.startsWith('OK') ?? false;

  return (
    <div className="u-flex-col u-gap-3" data-testid="admin-uid-panel-report">
      <div style={CARD_STYLE}>
        <div className="u-flex-center u-gap-2 u-mb-3" style={{ justifyContent: 'space-between' }}>
          <div className="u-flex-center u-gap-2">
            <Fingerprint size={18} />
            <strong>Diagnostics UID equipement</strong>
            {isOk ? (
              <span
                className="u-flex-center u-gap-1"
                style={{ color: 'var(--theme-success, green)' }}
              >
                <CheckCircle2 size={14} /> OK
              </span>
            ) : (
              <span
                className="u-flex-center u-gap-1"
                style={{ color: 'var(--theme-warning, orange)' }}
              >
                <AlertTriangle size={14} /> A corriger
              </span>
            )}
          </div>
          <Button variant="secondary" onClick={loadAudit} disabled={loading}>
            <RefreshCw size={14} /> Rafraichir
          </Button>
        </div>

        <div className="u-flex u-gap-4 u-flex-wrap">
          <div style={STAT_STYLE}>
            <span style={STAT_NUMBER_STYLE}>{report.equipmentTotal}</span>
            <span style={STAT_LABEL_STYLE}>Total equipements</span>
          </div>
          <div style={STAT_STYLE}>
            <span style={STAT_NUMBER_STYLE}>{report.equipmentWithUid}</span>
            <span style={STAT_LABEL_STYLE}>Avec UID</span>
          </div>
          <div style={STAT_STYLE}>
            <span
              style={{
                ...STAT_NUMBER_STYLE,
                color: report.equipmentWithoutUid > 0 ? 'var(--theme-warning, orange)' : undefined,
              }}
            >
              {report.equipmentWithoutUid}
            </span>
            <span style={STAT_LABEL_STYLE}>Sans UID</span>
          </div>
          <div style={STAT_STYLE}>
            <span style={STAT_NUMBER_STYLE}>{report.equipmentWithSerial}</span>
            <span style={STAT_LABEL_STYLE}>Avec serial</span>
          </div>
        </div>

        {report.verdict && (
          <p className="u-mt-3" style={{ fontStyle: 'italic', color: 'var(--theme-text-muted)' }}>
            Verdict : {report.verdict}
          </p>
        )}
      </div>

      <div style={CARD_STYLE}>
        <h3 style={{ margin: '0 0 12px 0' }}>
          Doublons <code>serial_number</code> ({report.duplicateSerials.length})
        </h3>
        {report.duplicateSerials.length === 0 ? (
          <p className="u-text-muted">Aucun doublon detecte.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6 }}>Serial</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Equipment IDs</th>
              </tr>
            </thead>
            <tbody>
              {report.duplicateSerials.map((d) => (
                <tr key={`serial-${d.serialNumber}`}>
                  <td style={{ padding: 6, fontFamily: 'monospace' }}>{d.serialNumber}</td>
                  <td style={{ padding: 6 }}>{d.count}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace' }}>{d.ids.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={CARD_STYLE}>
        <h3 style={{ margin: '0 0 12px 0' }}>
          Doublons <code>uid</code> ({report.duplicateUids.length})
        </h3>
        {report.duplicateUids.length === 0 ? (
          <p className="u-text-muted">Aucun doublon detecte.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6 }}>UID</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Equipment IDs</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {report.duplicateUids.map((d) => (
                <tr key={`uid-${d.uid}`}>
                  <td style={{ padding: 6, fontFamily: 'monospace' }}>{d.uid}</td>
                  <td style={{ padding: 6 }}>{d.count}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace' }}>{d.ids.join(', ')}</td>
                  <td style={{ padding: 6 }}>
                    <div className="u-flex u-gap-1 u-flex-wrap">
                      {d.ids.map((eqId) => (
                        <Button
                          key={`regen-${eqId}`}
                          variant="secondary"
                          onClick={() => handleRegenerate(eqId)}
                          disabled={regenerating.has(eqId)}
                          data-testid={`regen-btn-${eqId}`}
                        >
                          {regenerating.has(eqId) ? (
                            <>
                              <RefreshCw size={12} className="u-animate-spin" /> …
                            </>
                          ) : (
                            <>Regen #{eqId}</>
                          )}
                        </Button>
                      ))}
                    </div>
                    {regenErrorId !== null && d.ids.includes(regenErrorId) && (
                      <p
                        className="u-mt-1"
                        style={{
                          color: 'var(--theme-danger, red)',
                          fontSize: '0.8rem',
                        }}
                      >
                        Regeneration echouee (#{regenErrorId}). Verifiez le flag serveur
                        <code>FEATURE_V2_EQUIPMENT_UID</code> et reessayez.
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
