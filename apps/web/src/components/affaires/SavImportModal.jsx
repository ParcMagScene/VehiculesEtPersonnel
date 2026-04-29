import '../equipment/EquipmentImportModal.css'; // réutilise le même CSS
import './SavImportModal.css';

import {
  AlertCircle as AlertInfo,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Link2,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  InlineAlert,
  Input,
  Modal,
  ModalBody,
  ModalHeader,
  ModalLayout,
  Spinner,
  Table,
} from '@/design-system';

import { STATUS } from '../../constants';
import { STATUS_COLORS } from '../../constants/colors';
import api from '../../utils/api';
import { formatDateSimple } from '../../utils/formatUtils';

// En-têtes CSV attendues (format Locmat Interventions)
const HEADER_MAP = {
  intervention: 'intervention',
  'code libre': 'intervention',
  'code article': 'code_article',
  'nom article': 'nom_article',
  'numéro de série': 'numero_de_serie',
  'numero de serie': 'numero_de_serie',
  'n° de série': 'numero_de_serie',
  'n° serie': 'numero_de_serie',
  début: 'debut',
  debut: 'debut',
  fin: 'fin',
  coût: 'cout',
  cout: 'cout',
  a: 'a',
};

function parseCSV(text, separator = ';') {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2)
    return {
      headers: [],
      rows: [],
      error: 'Le fichier doit contenir au moins un en-tête et une ligne de données',
    };

  // La première ligne peut être un titre (ex: "Interventions Locmat")
  // Chercher la ligne d'en-tête (celle qui contient "Intervention" ou "Code Article")
  let headerLineIndex = 0;
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (
      (lower.includes('intervention') || lower.includes('code libre')) &&
      lower.includes('article')
    ) {
      headerLineIndex = i;
      break;
    }
  }

  const rawHeaders = lines[headerLineIndex].split(separator).map((h) => h.trim());
  const mappedHeaders = rawHeaders.map((h) => {
    const lower = h.toLowerCase().replace(/[*]/g, '').trim();
    return HEADER_MAP[lower] || lower.replace(/\s+/g, '_');
  });

  // Dé-quoter un champ CSV (guillemets doubles)
  const dequote = (val) => {
    if (!val) return val;
    const t = val.trim();
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"');
    return t;
  };

  const rows = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(separator);
    if (values.every((v) => !v.trim())) continue;
    const row = {};
    for (let j = 0; j < mappedHeaders.length; j++) {
      row[mappedHeaders[j]] = dequote(values[j] || '');
    }
    if (row.intervention || row.code_article || row.nom_article) {
      rows.push(row);
    }
  }

  return { headers: rawHeaders, mappedHeaders, rows, error: null };
}

const STATUS_MAP = {
  closed: { label: 'Clôturée', color: 'var(--theme-text-gray)', icon: '✅' },
  resolved: { label: 'Sortie SAV', color: STATUS_COLORS.success, icon: '✅' },
  in_progress: { label: 'En cours', color: STATUS_COLORS.warning, icon: '🔧' },
  open: { label: 'Ouverte', color: STATUS_COLORS.danger, icon: '🔴' },
};

const SavImportModal = ({ onClose, onImportDone }) => {
  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [csvData, setCsvData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualLinks, setManualLinks] = useState({}); // { rowIndex: equipmentId }
  const [linkSearch, setLinkSearch] = useState('');
  const [linkingIndex, setLinkingIndex] = useState(null); // index de l'intervention en cours de liaison
  const [duplicateAction, setDuplicateAction] = useState('update'); // 'update' | 'skip' | 'create'

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const parsed = parseCSV(text, ';');
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      if (parsed.rows.length === 0) {
        setError('Aucune donnée trouvée dans le fichier');
        return;
      }
      setCsvData(parsed);
      // Lancer la preview automatiquement
      setLoading(true);
      api
        .importSavTicketsCsv(parsed.rows, 'preview')
        .then((result) => {
          setPreview(result);
          setStep('preview');
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    };
    reader.readAsText(f, 'UTF-8');
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
        const input = document.getElementById('sav-csv-file-input');
        const dt = new DataTransfer();
        dt.items.add(f);
        input.files = dt.files;
        handleFileSelect({ target: input });
      }
    },
    [handleFileSelect],
  );

  const handleImport = async () => {
    try {
      setLoading(true);
      setStep('importing');
      const result = await api.importSavTicketsCsv(
        csvData.rows,
        'import',
        Object.keys(manualLinks).length > 0 ? manualLinks : null,
        duplicateAction === 'skip',
        duplicateAction === 'update',
      );
      setResult(result);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // Filtrer la liste d'équipements pour le sélecteur de lien manuel
  const filteredEquipment = useMemo(() => {
    if (!preview?.equipmentList || !linkSearch.trim())
      return preview?.equipmentList?.slice(0, 30) || [];
    const s = linkSearch.toLowerCase();
    return preview.equipmentList
      .filter(
        (e) =>
          (e.name && e.name.toLowerCase().includes(s)) ||
          (e.reference && e.reference.toLowerCase().includes(s)) ||
          (e.serial_number && e.serial_number.toLowerCase().includes(s)),
      )
      .slice(0, 30);
  }, [preview?.equipmentList, linkSearch]);

  const suggestedEquipmentByIndex = useMemo(() => {
    if (!preview?.unmatchedItems || !preview?.equipmentList) return {};
    const equipmentById = new Map((preview.equipmentList || []).map((e) => [e.id, e]));
    const map = {};
    for (const item of preview.unmatchedItems) {
      map[item.index] = (item.suggestedEquipmentIds || [])
        .map((id) => equipmentById.get(id))
        .filter(Boolean);
    }
    return map;
  }, [preview?.unmatchedItems, preview?.equipmentList]);

  // Nombre d'interventions encore non liées (après liens manuels)
  const remainingUnlinked = useMemo(() => {
    if (!preview) return 0;
    return (preview.unmatchedItems || []).filter((item) => !manualLinks[item.index]).length;
  }, [preview, manualLinks]);

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="Import Interventions SAV"
      icon={<Upload size={18} />}
      size="xl"
      className="eq-import-modal"
      bodyClassName="eq-import-body"
      footer={
        <>
          {step === 'upload' && (
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep('upload');
                  setCsvData(null);
                  setPreview(null);
                  setManualLinks({});
                }}
              >
                ← Retour
              </Button>
              <Button variant="primary" onClick={handleImport} disabled={loading}>
                <Download size={14} /> Importer{' '}
                {duplicateAction === 'skip' && preview?.duplicatesCount > 0
                  ? preview.totalRows - preview.duplicatesCount
                  : preview?.totalRows}{' '}
                interventions
                {duplicateAction === 'update' && preview?.duplicatesCount > 0
                  ? ` (+ ${preview.duplicatesCount} mises à jour)`
                  : ''}
              </Button>
            </>
          )}
          {step === STATUS.DONE && (
            <Button
              variant="primary"
              onClick={() => {
                onImportDone();
                onClose();
              }}
            >
              <CheckCircle size={14} /> Terminé
            </Button>
          )}
        </>
      }
    >
      {error && (
        <InlineAlert dismissible onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      {/* Étape 1 : Upload */}
      {step === 'upload' && !loading && (
        <div className="eq-import-upload">
          <div
            className="eq-import-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <FileText size={48} strokeWidth={1} />
            <h4>Glissez un fichier CSV d'interventions</h4>
            <p>ou cliquez pour sélectionner un fichier</p>
            <p className="eq-import-hint">
              Format Locmat : CSV séparé par <code>;</code>
            </p>
            <p className="eq-import-hint">
              Colonnes : Intervention, Code Article, Nom Article, N° de série, Début, Fin, Coût,
              Statut
            </p>
            <input
              id="sav-csv-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
            />
            <Button
              variant="primary"
              onClick={() => document.getElementById('sav-csv-file-input').click()}
            >
              <Upload size={14} /> Choisir un fichier
            </Button>
          </div>
        </div>
      )}

      {step === 'upload' && loading && (
        <div className="eq-import-progress">
          <Spinner size="xl" />
          <h4>Analyse en cours...</h4>
        </div>
      )}

      {/* Étape 2 : Aperçu + Liens manuels */}
      {step === 'preview' && preview && (
        <div className="eq-import-preview">
          {/* Stats */}
          <div className="eq-import-summary">
            <div className="eq-import-stat">
              <span className="eq-import-stat-value">{preview.totalRows}</span>
              <span className="eq-import-stat-label">Interventions</span>
            </div>
            <div className="eq-import-stat" style={{ borderColor: STATUS_COLORS.success }}>
              <span className="eq-import-stat-value" style={{ color: STATUS_COLORS.success }}>
                {preview.matched + Object.keys(manualLinks).length}
              </span>
              <span className="eq-import-stat-label">✅ Liées</span>
            </div>
            <div
              className="eq-import-stat"
              style={{
                borderColor: remainingUnlinked > 0 ? STATUS_COLORS.warning : STATUS_COLORS.success,
              }}
            >
              <span
                className="eq-import-stat-value"
                style={{
                  color: remainingUnlinked > 0 ? STATUS_COLORS.warning : STATUS_COLORS.success,
                }}
              >
                {remainingUnlinked}
              </span>
              <span className="eq-import-stat-label">⚠️ Non liées</span>
            </div>
            <div className="eq-import-stat">
              <span className="eq-import-stat-value">{preview.totalCost?.toFixed(2)} €</span>
              <span className="eq-import-stat-label">Coût total</span>
            </div>
            {preview.duplicatesCount > 0 && (
              <div className="eq-import-stat" style={{ borderColor: STATUS_COLORS.danger }}>
                <span className="eq-import-stat-value" style={{ color: STATUS_COLORS.danger }}>
                  {preview.duplicatesCount}
                </span>
                <span className="eq-import-stat-label">🔁 Doublons</span>
              </div>
            )}
          </div>

          {/* Détection entrées / sorties SAV */}
          {(preview.entries > 0 || preview.exits > 0) && (
            <div className="eq-import-section sav-import-flow-box">
              <h4>🔄 Détection des flux SAV</h4>
              <div className="sav-import-flow-stats">
                {preview.entries > 0 && (
                  <span className="sav-import-flow-badge sav-flow-entry">
                    📥 {preview.entries} entrée(s) en SAV (sans date de fin)
                  </span>
                )}
                {preview.exits > 0 && (
                  <span className="sav-import-flow-badge sav-flow-exit">
                    📤 {preview.exits} sortie(s) SAV (date de fin renseignée)
                  </span>
                )}
                {preview.statusTransitions > 0 && (
                  <span className="sav-import-flow-badge sav-flow-transition">
                    🔄 {preview.statusTransitions} intervention(s) à clôturer automatiquement
                  </span>
                )}
                {preview.previewAutoClosedMissing > 0 && (
                  <span className="sav-import-flow-badge sav-flow-exit">
                    📦 {preview.previewAutoClosedMissing} ticket(s) actif(s) absent(s) du fichier
                    seront clôturés
                  </span>
                )}
              </div>
              {preview.previewAutoClosedMissingItems?.length > 0 && (
                <p className="sav-import-unmatched-desc" style={{ marginTop: 8 }}>
                  Exemples:{' '}
                  {preview.previewAutoClosedMissingItems
                    .slice(0, 5)
                    .map((t) => t.intervention || t.title)
                    .join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Option doublons */}
          {preview.duplicatesCount > 0 && (
            <div className="eq-import-section sav-import-dup-box">
              <p className="sav-import-dup-title">
                🔁 {preview.duplicatesCount} doublon(s) détecté(s) (même N° d’intervention)
              </p>
              <div className="sav-import-dup-options">
                <label className="sav-import-dup-label">
                  <input
                    type="radio"
                    name="dup-action"
                    checked={duplicateAction === 'update'}
                    onChange={() => setDuplicateAction('update')}
                  />
                  Mettre à jour les tickets existants (statut → en cours, coût, lien équipement)
                </label>
                <label className="sav-import-dup-label">
                  <input
                    type="radio"
                    name="dup-action"
                    checked={duplicateAction === 'skip'}
                    onChange={() => setDuplicateAction('skip')}
                  />
                  Ignorer les doublons
                </label>
                <label className="sav-import-dup-label">
                  <input
                    type="radio"
                    name="dup-action"
                    checked={duplicateAction === 'create'}
                    onChange={() => setDuplicateAction('create')}
                  />
                  Créer quand même (doublons)
                </label>
              </div>
            </div>
          )}

          {/* Statuts */}
          <div className="eq-import-section">
            <h4>📊 Répartition des statuts</h4>
            <div className="sav-import-status-list">
              {Object.entries(preview.statusCounts || {}).map(([st, count]) => {
                const info = STATUS_MAP[st] || STATUS_MAP.open;
                return (
                  <span
                    key={st}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 12px',
                      borderRadius: 20,
                      background: info.color + '15',
                      color: info.color,
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {info.icon} {info.label} : {count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Aperçu des données */}
          <div className="eq-import-section">
            <h4>
              <Eye size={14} /> Aperçu (10 premières lignes)
            </h4>
            <div className="eq-import-table-wrap">
              <Table className="eq-import-table">
                <thead>
                  <tr>
                    <th>Lié</th>
                    <th>N° Intervention</th>
                    <th>Code</th>
                    <th>Article</th>
                    <th>N° Série</th>
                    <th>UID EMAG</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Coût</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.sample || []).map((row, i) => (
                    <tr key={i} style={{ background: row.matched ? '' : 'var(--btn-warning-bg)' }}>
                      <td>{row.matched ? '✅' : '⚠️'}</td>
                      <td className="sav-import-mono">
                        {row.intervention}{' '}
                        {row.isDuplicate && <span className="sav-import-dup-badge">🔁</span>}
                      </td>
                      <td>{row.code_article}</td>
                      <td className="eq-import-name-cell">{row.nom_article}</td>
                      <td className="sav-import-small">{row.parsedSerial || row.serial}</td>
                      <td
                        style={{
                          fontSize: 11,
                          color: row.parsedUid ? STATUS_COLORS.info : 'var(--theme-text-muted)',
                          fontWeight: row.parsedUid ? 600 : 400,
                        }}
                      >
                        {row.parsedUid || '—'}
                      </td>
                      <td>{formatDateSimple(row.startDate)}</td>
                      <td>{formatDateSimple(row.endDate)}</td>
                      <td>{row.cost > 0 ? `${row.cost.toFixed(2)} €` : '—'}</td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 600,
                            background:
                              (STATUS_MAP[row.status]?.color || 'var(--theme-text-gray)') + '20',
                            color: STATUS_MAP[row.status]?.color || 'var(--theme-text-gray)',
                          }}
                        >
                          {STATUS_MAP[row.status]?.label || row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>

          {/* Interventions non liées — permettre liaison manuelle */}
          {(preview.unmatchedItems || []).length > 0 && (
            <div className="eq-import-section">
              <h4 className="sav-import-unmatched-header">
                <AlertInfo size={16} /> {preview.unmatchedItems.length} intervention(s) sans
                correspondance
              </h4>
              <p className="sav-import-unmatched-desc">
                Ces interventions seront importées mais non liées à un équipement. Vous pouvez les
                lier manuellement ci-dessous ou plus tard depuis l'onglet SAV.
              </p>
              <p className="sav-import-unmatched-desc">
                Si le N° de série est inconnu en base, une proposition est faite sur le même code
                article avec un équipement sans N° de série.
              </p>
              <div className="eq-import-table-wrap" style={{ maxHeight: 300 }}>
                <Table className="eq-import-table">
                  <thead>
                    <tr>
                      <th>N° Intervention</th>
                      <th>Code</th>
                      <th>Article</th>
                      <th>N° Série</th>
                      <th>Proposition</th>
                      <th>Équipement lié</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.unmatchedItems.map((item) => {
                      const linked = manualLinks[item.index];
                      const linkedEquip = linked
                        ? preview.equipmentList?.find((e) => e.id === linked)
                        : null;
                      const suggestedList = suggestedEquipmentByIndex[item.index] || [];
                      const suggested = suggestedList[0] || null;
                      return (
                        <tr key={item.index}>
                          <td className="sav-import-mono">{item.intervention}</td>
                          <td>{item.code}</td>
                          <td className="eq-import-name-cell">{item.nom}</td>
                          <td className="sav-import-small">{item.serial}</td>
                          <td>
                            {suggested ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => {
                                  setManualLinks((prev) => ({
                                    ...prev,
                                    [item.index]: suggested.id,
                                  }));
                                }}
                                title="Lier à la proposition"
                              >
                                Proposer: {suggested.name}
                              </Button>
                            ) : (
                              <span className="sav-import-small">—</span>
                            )}
                          </td>
                          <td>
                            {linkedEquip ? (
                              <div className="sav-import-linked">
                                <span className="sav-import-linked-name">
                                  ✅ {linkedEquip.name}
                                </span>
                                <Button
                                  variant="ghost"
                                  className="sav-import-unlink-btn"
                                  onClick={() => {
                                    const next = { ...manualLinks };
                                    delete next[item.index];
                                    setManualLinks(next);
                                  }}
                                  title="Retirer le lien"
                                >
                                  <X size={12} />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                size="xs"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => {
                                  setLinkingIndex(item.index);
                                  setLinkSearch('');
                                }}
                              >
                                <Link2 size={11} /> Lier
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          )}

          {/* Popup de sélection d'équipement pour liaison manuelle */}
          {linkingIndex !== null && (
            <Modal
              open={linkingIndex !== null}
              onClose={() => setLinkingIndex(null)}
              size="md"
              className="sav-import-link-modal"
            >
              <ModalHeader icon={<Link2 size={18} />} onClose={() => setLinkingIndex(null)}>
                Lier à un équipement
              </ModalHeader>
              <ModalBody>
                {(() => {
                  const item = preview.unmatchedItems?.find((u) => u.index === linkingIndex);
                  return item ? (
                    <div className="sav-import-link-info">
                      <strong>{item.intervention}</strong> — {item.nom}{' '}
                      {item.serial ? `(S/N: ${item.serial})` : ''}
                    </div>
                  ) : null;
                })()}
                <div className="sav-import-link-search-wrap">
                  <Search size={14} className="sav-import-link-search-icon" />
                  <Input
                    type="text"
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder="Chercher par nom, référence ou N° série..."
                    className="sav-import-link-input"
                    autoFocus
                  />
                </div>
                <div className="sav-import-link-list">
                  {filteredEquipment.map((eq) => (
                    <div
                      key={eq.id}
                      className="sav-import-link-item"
                      onClick={() => {
                        setManualLinks((prev) => ({ ...prev, [linkingIndex]: eq.id }));
                        setLinkingIndex(null);
                      }}
                    >
                      <strong>{eq.name}</strong>
                      <span className="sav-import-link-ref">
                        {eq.reference ? `Réf: ${eq.reference}` : ''}{' '}
                        {eq.serial_number ? `S/N: ${eq.serial_number}` : ''}
                      </span>
                    </div>
                  ))}
                  {!linkSearch &&
                    (suggestedEquipmentByIndex[linkingIndex] || [])
                      .filter((eq) => !filteredEquipment.some((f) => f.id === eq.id))
                      .map((eq) => (
                        <div
                          key={`suggested-${eq.id}`}
                          className="sav-import-link-item"
                          onClick={() => {
                            setManualLinks((prev) => ({ ...prev, [linkingIndex]: eq.id }));
                            setLinkingIndex(null);
                          }}
                        >
                          <strong>{eq.name}</strong>
                          <span className="sav-import-link-ref">
                            Proposition • {eq.reference ? `Réf: ${eq.reference}` : ''}{' '}
                            {eq.serial_number ? `S/N: ${eq.serial_number}` : 'S/N: non renseigné'}
                          </span>
                        </div>
                      ))}
                  {filteredEquipment.length === 0 && (
                    <div className="sav-import-link-empty">
                      {linkSearch ? 'Aucun résultat' : 'Tapez pour chercher...'}
                    </div>
                  )}
                </div>
              </ModalBody>
            </Modal>
          )}
        </div>
      )}

      {/* Étape 3 : Import en cours */}
      {step === 'importing' && (
        <div className="eq-import-progress">
          <Spinner size="xl" />
          <h4>Import en cours...</h4>
          <p>Création des tickets SAV et liaison avec les équipements...</p>
        </div>
      )}

      {/* Étape 4 : Résultat */}
      {step === STATUS.DONE && result && (
        <div className="eq-import-result">
          <CheckCircle size={48} className="eq-import-success-icon" />
          <h4>Import terminé !</h4>
          <div className="eq-import-result-stats">
            <div className="eq-import-result-stat">
              <span className="eq-import-result-value">{result.created}</span>
              <span>Interventions importées</span>
            </div>
            <div className="eq-import-result-stat">
              <span className="eq-import-result-value" style={{ color: STATUS_COLORS.success }}>
                {result.createdLinked}
              </span>
              <span>✅ Liées à un équipement</span>
            </div>
            {result.createdUnlinked > 0 && (
              <div className="eq-import-result-stat eq-import-result-skipped">
                <span className="eq-import-result-value">{result.createdUnlinked}</span>
                <span>⚠️ Non liées (à traiter)</span>
              </div>
            )}
            {result.updatedDuplicates > 0 && (
              <div className="eq-import-result-stat">
                <span className="eq-import-result-value" style={{ color: STATUS_COLORS.info }}>
                  {result.updatedDuplicates}
                </span>
                <span>🔄 Tickets mis à jour</span>
              </div>
            )}
            {result.skippedDuplicates > 0 && (
              <div className="eq-import-result-stat">
                <span
                  className="eq-import-result-value"
                  style={{ color: 'var(--theme-text-gray)' }}
                >
                  {result.skippedDuplicates}
                </span>
                <span>🔁 Doublons ignorés</span>
              </div>
            )}
            {result.resolved > 0 && (
              <div className="eq-import-result-stat">
                <span className="eq-import-result-value" style={{ color: STATUS_COLORS.success }}>
                  {result.resolved}
                </span>
                <span>📤 Sorties SAV détectées</span>
              </div>
            )}
            {result.autoClosedMissing > 0 && (
              <div className="eq-import-result-stat">
                <span className="eq-import-result-value" style={{ color: STATUS_COLORS.warning }}>
                  {result.autoClosedMissing}
                </span>
                <span>📦 Clôturés car absents du fichier</span>
              </div>
            )}
          </div>
          {result.createdUnlinked > 0 && (
            <p className="sav-import-note">
              Les interventions non liées sont accessibles depuis l'onglet SAV pour liaison
              manuelle.
            </p>
          )}
        </div>
      )}
    </ModalLayout>
  );
};

export default SavImportModal;
