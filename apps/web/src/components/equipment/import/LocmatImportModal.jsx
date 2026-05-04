// ═══════════════════════════════════════════════════════════════
// LocmatImportModal — Import intelligent Locations.csv + Serialise.csv
//
// Étapes : SELECT (2 fichiers CSV) → PREVIEW (diff par onglets) → IMPORTING → DONE
// Parsing CSV côté client via PapaParse, diff calculé côté serveur (preview),
// puis confirmation transactionnelle.
// ═══════════════════════════════════════════════════════════════
import {
  AlertTriangle,
  Boxes,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Hash,
  ListChecks,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import Papa from 'papaparse';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button, EmptyState, InlineAlert, ModalLayout, Table } from '@/design-system';

import { useToast } from '../../../hooks/useToast';
import api from '../../../utils/api';
import './LocmatImportModal.css';

const TABS = [
  { key: 'newProducts', label: 'Nouvelles réfs', icon: Plus, color: 'success' },
  { key: 'updatedProducts', label: 'Modifiées', icon: RefreshCw, color: 'info' },
  { key: 'quantityChanges', label: 'Quantités', icon: Hash, color: 'warning' },
  { key: 'serializationChanges', label: 'Sérialisation', icon: ShieldCheck, color: 'info' },
  { key: 'newSerials', label: 'Nouveaux N° série', icon: Plus, color: 'success' },
  { key: 'removedSerials', label: 'N° série retirés', icon: Minus, color: 'danger' },
  { key: 'missingProducts', label: 'Suppressions ?', icon: Trash2, color: 'warning' },
  { key: 'duplicates', label: 'Doublons CSV', icon: Copy, color: 'warning' },
  { key: 'collisions', label: 'Collisions', icon: ShieldAlert, color: 'danger' },
  { key: 'errors', label: 'Erreurs', icon: AlertTriangle, color: 'danger' },
];

function readCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => resolve(res.data || []),
      error: (err) => reject(err),
    });
  });
}

// Réimplémente la même normalisation que côté serveur, en restant tolérant.
function normalizeKey(k) {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}
function pick(row, aliases) {
  const idx = {};
  for (const k of Object.keys(row)) idx[normalizeKey(k)] = k;
  for (const a of aliases) {
    const k = idx[normalizeKey(a)];
    if (k != null && row[k] !== '' && row[k] != null) return row[k];
  }
  return null;
}
function toNum(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(
    String(v)
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, ''),
  );
  return Number.isFinite(n) ? n : 0;
}
function toBool(v) {
  return ['1', 'true', 'vrai', 'oui', 'yes', 'x'].includes(
    String(v || '')
      .trim()
      .toLowerCase(),
  );
}

function normalizeLocations(rows) {
  return rows
    .map((row) => {
      const code = String(
        pick(row, [
          'Code libre générique',
          'Code Libre',
          'Code Article',
          'Code',
          'Référence',
          'Reference',
        ]) || '',
      ).trim();
      const name = String(
        pick(row, ['Désignation', 'Designation', 'Nom', 'Libellé', 'Libelle']) || '',
      ).trim();
      if (!code && !name) return null;
      return {
        code,
        name,
        description:
          String(pick(row, ['Description', 'Commentaire', 'Notes']) || '').trim() || null,
        category:
          String(pick(row, ['Catégorie', 'Categorie', 'Famille', 'Type']) || '').trim() || null,
        // ⚠️ Export Locmat : la colonne "Mag Scène" contient en fait la quantité stock
        quantity: Math.max(
          0,
          Math.round(
            toNum(
              pick(row, [
                'Mag Scène',
                'Mag Scene',
                'Mag-Scene',
                'MAG SCENE',
                'Quantité',
                'Quantite',
                'Qté',
                'Qte',
                'Stock',
              ]),
            ),
          ),
        ),
        price: Math.max(
          0,
          toNum(pick(row, ['Tarif 1 HT', 'Tarif', 'Tarif unitaire', 'Prix unitaire', 'Prix'])),
        ),
        value: Math.max(0, toNum(pick(row, ['Valeur', 'Valeur stock']))),
        barcode:
          String(
            pick(row, [
              'Code à Barres',
              'Code-barres',
              'Code Barre',
              'CodeBarre',
              'Barcode',
              'EAN',
            ]) || '',
          ).trim() || null,
        location: String(pick(row, ['Emplacement', 'Lieu', 'Location']) || '').trim() || null,
        isSerialized: toBool(
          pick(row, ['O', 'Sérialisé', 'Serialise', 'Sérialisée', 'Serialisable']),
        ),
      };
    })
    .filter(Boolean);
}

function normalizeSerials(rows) {
  return rows
    .map((row) => {
      const serial = String(
        pick(row, [
          'Numéro de série',
          'Numéro de Série',
          'Numero de Serie',
          'N° de série',
          'Serial',
          'NumSerie',
        ]) || '',
      ).trim();
      if (!serial) return null;
      return {
        code: String(
          pick(row, ['Code libre générique', 'Code Libre', 'Code Article', 'Code', 'Référence']) ||
            '',
        ).trim(),
        serial,
        name: String(pick(row, ['Nom', 'Désignation', 'Designation']) || '').trim() || null,
      };
    })
    .filter(Boolean);
}

export default function LocmatImportModal({ onDone, onClose }) {
  const toast = useToast();
  const [step, setStep] = useState('select'); // select | preview | importing | done
  const [locFile, setLocFile] = useState(null);
  const [serFile, setSerFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState(null);
  const [activeTab, setActiveTab] = useState('newProducts');
  const [result, setResult] = useState(null);
  const locInputRef = useRef(null);
  const serInputRef = useRef(null);

  const counts = useMemo(() => {
    if (!diff) return null;
    return {
      newProducts: diff.newProducts.length,
      updatedProducts: diff.updatedProducts.length,
      quantityChanges: diff.quantityChanges.length,
      newSerials: diff.newSerials.length,
      removedSerials: diff.removedSerials.length,
      errors: diff.errors.length,
    };
  }, [diff]);

  async function handleAnalyze() {
    setError(null);
    if (!locFile && !serFile) {
      setError('Veuillez sélectionner au moins un des deux fichiers CSV.');
      return;
    }
    setBusy(true);
    try {
      const [locRows, serRows] = await Promise.all([
        locFile ? readCsv(locFile) : Promise.resolve([]),
        serFile ? readCsv(serFile) : Promise.resolve([]),
      ]);
      const locations = normalizeLocations(locRows);
      const serials = normalizeSerials(serRows);

      const res = await api.previewLocmatImport({
        locations,
        serials,
        source: [locFile?.name, serFile?.name].filter(Boolean).join(' + '),
      });
      if (!res?.success) throw new Error(res?.error || 'Échec preview');
      setDiff(res);
      setStep('preview');
    } catch (e) {
      setError(e.message || 'Erreur lors de l’analyse.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!diff) return;
    setBusy(true);
    setStep('importing');
    setError(null);
    try {
      const res = await api.confirmLocmatImport({
        source: [locFile?.name, serFile?.name].filter(Boolean).join(' + '),
        newProducts: diff.newProducts,
        updatedProducts: diff.updatedProducts,
        quantityChanges: diff.quantityChanges,
        serializationChanges: diff.serializationChanges || [],
        newSerials: diff.newSerials,
        removedSerials: diff.removedSerials,
        // signalements (sans action automatique côté serveur)
        missingProducts: diff.missingProducts || [],
        duplicates: diff.duplicates || { locations: [], serials: [] },
        collisions: diff.collisions || [],
      });
      if (!res?.success) throw new Error(res?.error || 'Échec import');
      setResult(res);
      setStep('done');
      toast.success?.('Import Locmat terminé');
    } catch (e) {
      setError(e.message || "Erreur lors de l'import.");
      setStep('preview');
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadReport() {
    if (!diff) return;
    const blob = new Blob([JSON.stringify(diff, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locmat-diff-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ────── RENDER STEP CONTENT ──────
  const isSelect = step === 'select';
  const isPreview = step === 'preview';
  const isImporting = step === 'importing';
  const isDone = step === 'done';

  return (
    <ModalLayout
      open
      onClose={!isImporting ? onClose : undefined}
      size="xl"
      className="stock-modal stock-modal-lg"
      title={
        <>
          <FileSpreadsheet size={20} /> Import intelligent Locmat
        </>
      }
      footer={
        isSelect ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleAnalyze}
              disabled={busy || (!locFile && !serFile)}
            >
              {busy ? <Loader2 size={16} className="u-spin" /> : <ListChecks size={16} />}
              Analyser
            </Button>
          </>
        ) : isPreview ? (
          <>
            <Button variant="ghost" onClick={() => setStep('select')}>
              ← Retour
            </Button>
            <Button variant="ghost" onClick={handleDownloadReport}>
              <Download size={16} /> Télécharger rapport
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={
                busy ||
                !counts ||
                counts.newProducts +
                  counts.updatedProducts +
                  counts.quantityChanges +
                  (counts.serializationChanges || 0) +
                  counts.newSerials +
                  counts.removedSerials ===
                  0
              }
            >
              <Check size={16} /> Valider l'import
            </Button>
          </>
        ) : isDone ? (
          <Button variant="primary" onClick={onDone}>
            Fermer
          </Button>
        ) : null
      }
    >
      <div className="stock-modal-body u-overflow-auto" style={{ maxHeight: '70vh' }}>
        {error && <InlineAlert>{error}</InlineAlert>}

        {/* ─── STEP: SELECT ─── */}
        {isSelect && (
          <div className="locmat-select">
            <p className="stock-import-hint">
              Sélectionnez les exports Locmat. Aucune écriture ne sera faite avant validation.
            </p>

            <FileSlot
              label="Locations.csv (références produits + quantités)"
              icon={<Boxes size={18} />}
              file={locFile}
              inputRef={locInputRef}
              onChange={setLocFile}
            />
            <FileSlot
              label="Serialise.csv (numéros de série)"
              icon={<Hash size={18} />}
              file={serFile}
              inputRef={serInputRef}
              onChange={setSerFile}
            />
          </div>
        )}

        {/* ─── STEP: PREVIEW ─── */}
        {isPreview && diff && (
          <div className="locmat-preview">
            <div className="locmat-tabs" role="tablist">
              {TABS.map((t) => {
                const n = counts?.[t.key] ?? 0;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === t.key}
                    className={`locmat-tab ${activeTab === t.key ? 'is-active' : ''} is-${t.color}`}
                    onClick={() => setActiveTab(t.key)}
                  >
                    <Icon size={14} /> {t.label} <span className="locmat-tab-count">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="locmat-tab-panel">
              <DiffTable tabKey={activeTab} rows={diff[activeTab] || []} />
            </div>
          </div>
        )}

        {/* ─── STEP: IMPORTING ─── */}
        {isImporting && (
          <div className="locmat-importing" style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader2 size={48} className="u-spin" />
            <p>Import en cours… Veuillez patienter.</p>
          </div>
        )}

        {/* ─── STEP: DONE ─── */}
        {isDone && result && (
          <div className="locmat-done">
            <h3 style={{ marginTop: 0 }}>
              <Check size={20} /> Import terminé
            </h3>
            <ul>
              <li>
                Produits créés : <strong>{result.createdProducts}</strong>
              </li>
              <li>
                Produits mis à jour : <strong>{result.updatedProducts}</strong>
              </li>
              <li>
                Quantités ajustées : <strong>{result.quantityAdjusted}</strong>
              </li>
              <li>
                Sérialisations activées : <strong>{result.serializationActivated || 0}</strong>
              </li>
              <li>
                N° série ajoutés : <strong>{result.serialsAdded}</strong>
              </li>
              <li>
                N° série réactivés : <strong>{result.serialsReactivated}</strong>
              </li>
              <li>
                N° série retirés : <strong>{result.serialsRemoved}</strong>
              </li>
              {result.serialsSkippedCollision > 0 && (
                <li>
                  N° série ignorés (collision) : <strong>{result.serialsSkippedCollision}</strong>
                </li>
              )}
              {result.errors?.length > 0 && (
                <li style={{ color: 'var(--color-danger, #c62828)' }}>
                  Erreurs : <strong>{result.errors.length}</strong>
                </li>
              )}
            </ul>
            {result.errors?.length > 0 && (
              <details>
                <summary>Voir les erreurs ({result.errors.length})</summary>
                <pre style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                  {result.errors.join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </ModalLayout>
  );
}

// ─── Sous-composants ───
function FileSlot({ label, icon, file, inputRef, onChange }) {
  return (
    <div className="locmat-file-slot">
      <label className="locmat-file-label">
        {icon} {label}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {file && (
        <span className="locmat-file-meta">
          <Upload size={12} /> {file.name} — {(file.size / 1024).toFixed(1)} Ko
        </span>
      )}
    </div>
  );
}

function DiffTable({ tabKey, rows }) {
  // Colonnes par onglet
  const columns = useMemo(() => {
    switch (tabKey) {
      case 'newProducts':
        return [
          { key: 'code', label: 'Code', render: (_, r) => r.code },
          { key: 'name', label: 'Nom', render: (_, r) => r.name },
          { key: 'category', label: 'Catégorie', render: (_, r) => r.category || '—' },
          { key: 'quantity', label: 'Qté', render: (_, r) => r.quantity },
          { key: 'price', label: 'Tarif', render: (_, r) => r.price },
        ];
      case 'updatedProducts':
        return [
          { key: 'code', label: 'Code', render: (_, r) => r.code },
          { key: 'name', label: 'Nom', render: (_, r) => r.name || '—' },
          {
            key: 'diffs',
            label: 'Modifications',
            render: (_, r) => (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {Object.entries(r.diffs || {}).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}</strong>: <s>{String(v.from ?? '∅')}</s> → {String(v.to ?? '∅')}
                  </li>
                ))}
              </ul>
            ),
          },
        ];
      case 'quantityChanges':
        return [
          { key: 'code', label: 'Code', render: (_, r) => r.code },
          { key: 'name', label: 'Nom', render: (_, r) => r.name },
          { key: 'from', label: 'Avant', render: (_, r) => r.from },
          { key: 'to', label: 'Après', render: (_, r) => r.to },
          { key: 'delta', label: 'Δ', render: (_, r) => (r.delta > 0 ? `+${r.delta}` : r.delta) },
          {
            key: 'reason',
            label: 'Motif',
            render: (_, r) => (r.reason === 'serialization-sync' ? 'sync sérialisation' : '—'),
          },
        ];
      case 'serializationChanges':
        return [
          { key: 'code', label: 'Code', render: (_, r) => r.code },
          { key: 'name', label: 'Nom', render: (_, r) => r.name || '—' },
          {
            key: 'change',
            label: 'Changement',
            render: () => 'is_serialized : 0 → 1',
          },
          {
            key: 'serialCount',
            label: 'Nb serials actifs (après import)',
            render: (_, r) => r.serialCount,
          },
        ];
      case 'newSerials':
        return [
          { key: 'code', label: 'Code', render: (_, r) => r.code },
          { key: 'serial', label: 'N° série', render: (_, r) => r.serial },
          {
            key: 'productExisting',
            label: 'Produit',
            render: (_, r) => (r.productExisting ? 'Existant' : 'Nouveau'),
          },
        ];
      case 'removedSerials':
        return [
          { key: 'code', label: 'Code', render: (_, r) => r.code },
          { key: 'serial', label: 'N° série retiré', render: (_, r) => r.serial },
        ];
      case 'errors':
        return [
          { key: 'scope', label: 'Source', render: (_, r) => r.scope },
          { key: 'message', label: 'Message', render: (_, r) => r.message },
        ];
      case 'missingProducts':
        return [
          { key: 'code', label: 'Code', render: (_, r) => r.code },
          { key: 'name', label: 'Nom', render: (_, r) => r.name || '—' },
          { key: 'quantity', label: 'Qté DB', render: (_, r) => r.quantity },
          {
            key: 'note',
            label: 'Action',
            render: () => 'Signalé (aucune écriture automatique)',
          },
        ];
      case 'collisions':
        return [
          { key: 'scope', label: 'Type', render: (_, r) => r.scope },
          { key: 'serial', label: 'N° série', render: (_, r) => r.serial },
          {
            key: 'detail',
            label: 'Détail',
            render: (_, r) => {
              if (r.scope === 'csv-cross-code') return `Codes CSV : ${(r.codes || []).join(', ')}`;
              if (r.scope === 'db-cross-equipment')
                return `CSV: ${r.csvCode} (eq #${r.csvEquipmentId ?? '—'}) vs DB eq #${r.dbEquipmentId}`;
              return JSON.stringify(r);
            },
          },
        ];
      default:
        return [];
    }
  }, [tabKey]);

  // Cas spécial : `duplicates` est un objet { locations, serials } → on aplatit ici.
  const flatRows = useMemo(() => {
    if (tabKey !== 'duplicates') return rows;
    if (!rows || Array.isArray(rows)) return rows || [];
    return [
      ...(rows.locations || []).map((r) => ({ ...r, kind: 'location' })),
      ...(rows.serials || []).map((r) => ({ ...r, kind: 'serial' })),
    ];
  }, [tabKey, rows]);

  const dupColumns = [
    {
      key: 'kind',
      label: 'Source',
      render: (_, r) => (r.kind === 'serial' ? 'Serialise.csv' : 'Locations.csv'),
    },
    { key: 'code', label: 'Code', render: (_, r) => r.code },
    { key: 'serial', label: 'N° série', render: (_, r) => r.serial || '—' },
    { key: 'name', label: 'Nom', render: (_, r) => r.name || '—' },
  ];
  const finalColumns = tabKey === 'duplicates' ? dupColumns : columns;

  // Pagination client (100/page) — évite de rendre 1700+ lignes d'un coup
  // qui sature le main thread et déclenche les warnings [Violation].
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [tabKey, flatRows.length]);
  const totalPages = Math.max(1, Math.ceil((flatRows?.length || 0) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(
    () => (flatRows || []).slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [flatRows, safePage],
  );

  if (!flatRows || flatRows.length === 0) {
    return <EmptyState title="Rien à signaler" description="Aucune entrée dans cette catégorie." />;
  }

  return (
    <>
      <Table
        columns={finalColumns}
        data={pagedRows}
        rowKey={(r, i) => `${tabKey}-${safePage}-${i}`}
        maxHeight={400}
        striped
        compact
      />
      {totalPages > 1 && (
        <div className="locmat-pager">
          <Button
            size="sm"
            variant="ghost"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Précédent
          </Button>
          <span className="locmat-pager-info">
            Page <strong>{safePage + 1}</strong> / {totalPages}
            {' · '}
            <span style={{ opacity: 0.7 }}>
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, flatRows.length)} sur{' '}
              {flatRows.length}
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Suivant →
          </Button>
        </div>
      )}
    </>
  );
}
