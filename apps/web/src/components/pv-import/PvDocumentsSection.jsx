// ═══════════════════════════════════════════════════════════════
// PvDocumentsSection.jsx — Liste des PV PDF rattachés à une entité
// ═══════════════════════════════════════════════════════════════
// Utilisé dans les fiches Équipement et Véhicule pour donner un accès
// direct aux PV de contrôle importés (rapports DEKRA / Apave / Socotec…)
// et aux lignes de lots multi-équipements.
//
// Props :
//   - entityType : 'equipment' | 'vehicle'
//   - entityId   : number (id de l'entité)
//
// Cliquer sur un lien ouvre le PDF dans un nouvel onglet ; l'auth
// passe par le cookie httpOnly `auth_token` (cf. middleware/authenticate.js).

import './PvDocumentsSection.css';

import { ExternalLink, FileText, FolderOpen, Package } from 'lucide-react';
import { useEffect, useState } from 'react';

import api from '../../utils/api';

function safeJson(s) {
  if (!s) return [];
  if (typeof s !== 'string') return Array.isArray(s) ? s : [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR');
}

export default function PvDocumentsSection({ entityType, entityId }) {
  const [data, setData] = useState(null); // { controls, lots } | null = loading

  useEffect(() => {
    let cancelled = false;
    if (!entityId) return undefined;
    const fetcher =
      entityType === 'vehicle' ? api.getPvByVehicle?.bind(api) : api.getPvByEquipment?.bind(api);
    if (typeof fetcher !== 'function') {
      setData({ controls: [], lots: [] });
      return undefined;
    }
    fetcher(entityId)
      .then((r) => {
        if (cancelled) return;
        if (r?.success) {
          setData({ controls: r.controls || [], lots: r.lots || [] });
        } else {
          setData({ controls: [], lots: [] });
        }
      })
      .catch(() => {
        if (!cancelled) setData({ controls: [], lots: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (data === null) return null; // loading silencieux

  // Aplatissement : pour chaque entrée d'historique, on étend chaque doc PDF.
  const documents = (data.controls || []).flatMap((ch) => {
    const docs = safeJson(ch.documents);
    return docs.map((d) => ({
      key: `ch-${ch.history_id}-${d.url || d.name}`,
      name: d.name || 'PV.pdf',
      url: d.url,
      size: d.size,
      performedAt: ch.performed_at,
      pvImportId: d.pv_import_id,
    }));
  });

  const lots = data.lots || [];
  const total = documents.length + lots.length;

  if (total === 0) return null; // ne pas surcharger la fiche si vide

  return (
    <div className="pv-docs-section">
      <h3 className="pv-docs-title">
        <FileText size={16} /> PV de contrôle ({total})
      </h3>

      {documents.length > 0 && (
        <ul className="pv-docs-list">
          {documents.map((d) => {
            // Dossier parent (ex: /pv/) → utile pour ouvrir l'index du
            // répertoire si servi (sinon retombe sur le PDF lui-même).
            const folderUrl = d.url ? d.url.replace(/\/[^/]+$/, '/') : null;
            return (
              <li key={d.key} className="pv-doc-item">
                <FileText size={14} className="pv-doc-icon" />
                <div className="pv-doc-info">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pv-doc-name"
                    title="Ouvrir le PV"
                  >
                    {d.name} <ExternalLink size={12} />
                  </a>
                  <span className="pv-doc-meta">{formatDate(d.performedAt)}</span>
                </div>
                {folderUrl && (
                  <a
                    href={folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pv-doc-folder"
                    title="Ouvrir le dossier"
                  >
                    <FolderOpen size={14} />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lots.length > 0 && (
        <div className="pv-lots">
          <h4 className="pv-lots-title">
            <Package size={14} /> Lots de contrôle ({lots.length})
          </h4>
          <ul className="pv-docs-list">
            {lots.map((l) => {
              const url = l.pdf_path ? `/${l.pdf_path}` : null;
              const folderUrl = url ? url.replace(/\/[^/]+$/, '/') : null;
              return (
                <li key={`lot-${l.id}`} className="pv-doc-item">
                  <Package size={14} className="pv-doc-icon" />
                  <div className="pv-doc-info">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pv-doc-name"
                      >
                        Lot du {formatDate(l.date_control)} <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="pv-doc-name">Lot du {formatDate(l.date_control)}</span>
                    )}
                    <span className="pv-doc-meta">
                      {l.quantite_controlee} contrôlé(s)
                      {l.quantite_non_controlee > 0 &&
                        ` · ${l.quantite_non_controlee} non contrôlé(s)`}
                      {l.organisme ? ` · ${l.organisme}` : ''}
                    </span>
                  </div>
                  {folderUrl && (
                    <a
                      href={folderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pv-doc-folder"
                      title="Ouvrir le dossier"
                    >
                      <FolderOpen size={14} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
