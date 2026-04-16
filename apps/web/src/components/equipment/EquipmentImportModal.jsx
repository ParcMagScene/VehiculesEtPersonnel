import { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Download,
} from 'lucide-react';
import { Button, ModalLayout, Table, Spinner, InlineAlert } from '@/design-system';
import api from '../../utils/api';
import { STATUS } from '../../constants';

import './EquipmentImportModal.css';

// Colonnes CSV attendues (séparateur ;)
const EXPECTED_HEADERS = [
  'Code Libre',
  'Nom',
  'Famille',
  'Sous-famille',
  'Catégorie',
  'Zone',
  'Stock',
  'Marque',
  'Numéro de série',
];

const HEADER_MAP = {
  'code libre': 'code_libre',
  nom: 'nom',
  famille: 'famille',
  'sous-famille': 'sous_famille',
  'sous famille': 'sous_famille',
  catégorie: 'categorie',
  categorie: 'categorie',
  zone: 'zone',
  stock: 'stock',
  marque: 'marque',
  'numéro de série': 'numero_serie',
  'numero de serie': 'numero_serie',
  'n° de série': 'numero_serie',
  'n° serie': 'numero_serie',
  serial: 'numero_serie',
};

function parseCSV(text, separator = ';') {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2)
    return {
      headers: [],
      rows: [],
      error: 'Le fichier doit contenir au moins un en-tête et une ligne de données',
    };

  const rawHeaders = lines[0].split(separator).map((h) => h.trim());
  const mappedHeaders = rawHeaders.map((h) => {
    const lower = h.toLowerCase().replace(/[*]/g, '');
    return HEADER_MAP[lower] || lower.replace(/\s+/g, '_');
  });

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator);
    if (values.every((v) => !v.trim())) continue; // ligne vide
    const row = {};
    for (let j = 0; j < mappedHeaders.length; j++) {
      row[mappedHeaders[j]] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return { headers: rawHeaders, mappedHeaders, rows, error: null };
}

const EquipmentImportModal = ({ onClose, onImportDone }) => {
  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [_file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [_preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState(new Set());

  // Analyse du CSV et extraction des hiérarchies
  const hierarchy = useMemo(() => {
    if (!csvData?.rows) return null;
    const families = new Map();
    for (const row of csvData.rows) {
      const fam = (row.famille || '').trim();
      const sf = (row.sous_famille || '').trim();
      const cat = (row.categorie || '').trim();
      if (!fam) continue;

      if (!families.has(fam)) families.set(fam, new Map());
      const subMap = families.get(fam);
      if (sf && !subMap.has(sf)) subMap.set(sf, new Set());
      if (sf && cat) subMap.get(sf).add(cat);
    }
    return families;
  }, [csvData]);

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
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
      setStep('preview');
    };
    reader.readAsText(f, 'UTF-8');
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
        const input = document.getElementById('csv-file-input');
        const dt = new DataTransfer();
        dt.items.add(f);
        input.files = dt.files;
        handleFileSelect({ target: input });
      }
    },
    [handleFileSelect],
  );

  const _handlePreview = async () => {
    try {
      setLoading(true);
      const result = await api.importEquipmentCsv(csvData.rows, 'preview');
      setPreview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      setStep('importing');
      const result = await api.importEquipmentCsv(csvData.rows, 'import');
      setResult(result);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const toggleFamily = (name) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="Import CSV Mat\u00e9riel"
      icon={<Upload size={18} />}
      size="lg"
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
                  setFile(null);
                }}
              >
                ← Retour
              </Button>
              <Button variant="primary" onClick={handleImport} disabled={loading}>
                <Download size={14} /> Importer {csvData.rows.length} équipements
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
      {step === 'upload' && (
        <div className="eq-import-upload">
          <div
            className="eq-import-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <FileText size={48} strokeWidth={1} />
            <h4>Glissez un fichier CSV ici</h4>
            <p>ou cliquez pour sélectionner un fichier</p>
            <p className="eq-import-hint">
              Format attendu : CSV séparé par <code>;</code>
            </p>
            <p className="eq-import-hint">Colonnes : {EXPECTED_HEADERS.join(', ')}</p>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
            />
            <Button
              variant="primary"
              onClick={() => document.getElementById('csv-file-input').click()}
            >
              <Upload size={14} /> Choisir un fichier
            </Button>
          </div>
        </div>
      )}

      {/* Étape 2 : Aperçu */}
      {step === 'preview' && csvData && (
        <div className="eq-import-preview">
          <div className="eq-import-summary">
            <div className="eq-import-stat">
              <span className="eq-import-stat-value">{csvData.rows.length}</span>
              <span className="eq-import-stat-label">Lignes</span>
            </div>
            <div className="eq-import-stat">
              <span className="eq-import-stat-value">{hierarchy?.size || 0}</span>
              <span className="eq-import-stat-label">Familles</span>
            </div>
            <div className="eq-import-stat">
              <span className="eq-import-stat-value">
                {hierarchy ? [...hierarchy.values()].reduce((sum, sf) => sum + sf.size, 0) : 0}
              </span>
              <span className="eq-import-stat-label">Sous-familles</span>
            </div>
            <div className="eq-import-stat">
              <span className="eq-import-stat-value">
                {hierarchy
                  ? [...hierarchy.values()].reduce(
                      (sum, sf) => [...sf.values()].reduce((s, cats) => s + cats.size, 0) + sum,
                      0,
                    )
                  : 0}
              </span>
              <span className="eq-import-stat-label">Catégories</span>
            </div>
          </div>

          {/* Hiérarchie Familles > Sous-familles > Catégories */}
          <div className="eq-import-section">
            <h4>📂 Hiérarchie des catégories</h4>
            <div className="eq-import-tree">
              {hierarchy &&
                [...hierarchy.entries()]
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([family, subfamilies]) => (
                    <div key={family} className="eq-tree-family">
                      <div
                        className="eq-tree-item eq-tree-level-1"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleFamily(family)}
                      >
                        {expandedFamilies.has(family) ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                        <strong>{family}</strong>
                        <span className="eq-tree-count">{subfamilies.size} sous-familles</span>
                      </div>
                      {expandedFamilies.has(family) &&
                        [...subfamilies.entries()]
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .map(([sf, cats]) => (
                            <div key={sf} className="eq-tree-subfamily">
                              <div className="eq-tree-item eq-tree-level-2">
                                <span>↳ {sf}</span>
                                <span className="eq-tree-count">{cats.size} catégorie(s)</span>
                              </div>
                              <div className="eq-tree-categories">
                                {[...cats].sort().map((cat) => (
                                  <span key={cat} className="eq-tree-cat-tag">
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                    </div>
                  ))}
            </div>
          </div>

          {/* Aperçu des données */}
          <div className="eq-import-section">
            <h4>
              <Eye size={14} /> Aperçu des données (10 premières lignes)
            </h4>
            <div className="eq-import-table-wrap">
              <Table className="eq-import-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Famille</th>
                    <th>Sous-famille</th>
                    <th>Catégorie</th>
                    <th>Marque</th>
                    <th>N° Série</th>
                    <th>Stock</th>
                    <th>Zone</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.rows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{row.code_libre}</td>
                      <td className="eq-import-name-cell">{row.nom}</td>
                      <td>{row.famille}</td>
                      <td>{row.sous_famille}</td>
                      <td>{row.categorie}</td>
                      <td>{row.marque}</td>
                      <td>{row.numero_serie}</td>
                      <td>{row.stock}</td>
                      <td>{row.zone}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {csvData.rows.length > 10 && (
              <p className="eq-import-more">
                ... et {csvData.rows.length - 10} lignes supplémentaires
              </p>
            )}
          </div>
        </div>
      )}

      {/* Étape 3 : Import en cours */}
      {step === 'importing' && (
        <div className="eq-import-progress">
          <Spinner size="xl" />
          <h4>Import en cours...</h4>
          <p>Création des familles, sous-familles, catégories et équipements...</p>
        </div>
      )}

      {/* Étape 4 : Résultat */}
      {step === STATUS.DONE && result && (
        <div className="eq-import-result">
          <CheckCircle size={48} className="eq-import-success-icon" />
          <h4>Import terminé avec succès !</h4>
          <div className="eq-import-result-stats">
            <div className="eq-import-result-stat">
              <span className="eq-import-result-value">{result.created}</span>
              <span>Équipements créés</span>
            </div>
            <div className="eq-import-result-stat">
              <span className="eq-import-result-value">{result.familiesCreated}</span>
              <span>Familles créées</span>
            </div>
            <div className="eq-import-result-stat">
              <span className="eq-import-result-value">{result.subfamiliesCreated}</span>
              <span>Sous-familles créées</span>
            </div>
            <div className="eq-import-result-stat">
              <span className="eq-import-result-value">{result.categoriesCreated}</span>
              <span>Catégories créées</span>
            </div>
            {result.skipped > 0 && (
              <div className="eq-import-result-stat eq-import-result-skipped">
                <span className="eq-import-result-value">{result.skipped}</span>
                <span>Ignorées (sans nom)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalLayout>
  );
};

export default EquipmentImportModal;
