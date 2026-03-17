// ============================================================
// MODAL IMPORT CSV PERSONNEL — MagLog 1.0
// Import avec détection des collisions (code libre, nom+prénom)
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  Upload, FileText, AlertTriangle, CheckCircle, X,
  ChevronDown, ChevronRight, Eye, Download, Loader,
  Users, UserCheck, UserPlus, AlertCircle, RefreshCw,
} from 'lucide-react';
import api from '../../utils/api';
import './PersonnelImportModal.css';

// Colonnes CSV attendues (séparateur ;)
const EXPECTED_HEADERS = ['Code Libre', 'Nom', 'Prénom', 'CP', 'Ville', 'Portable', 'Type'];

const HEADER_MAP = {
  'code libre': 'code_libre',
  'nom': 'nom',
  'prénom': 'prenom',
  'prenom': 'prenom',
  'cp': 'cp',
  'code postal': 'cp',
  'ville': 'ville',
  'portable': 'portable',
  'téléphone': 'portable',
  'telephone': 'portable',
  'phone': 'portable',
  'type': 'type_csv',
};

function parseCSV(text, separator = ';') {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], error: 'Le fichier doit contenir au moins un en-tête et une ligne de données' };

  // Détecter si la première ligne est un titre (pas de séparateur ou pas assez de champs)
  let headerIndex = 0;
  const firstSplit = lines[0].split(separator);
  if (firstSplit.length < 3) {
    headerIndex = 1; // Première ligne = titre, skip
  }

  if (headerIndex >= lines.length) {
    return { headers: [], rows: [], error: 'Format CSV invalide' };
  }

  const rawHeaders = lines[headerIndex].split(separator).map(h => h.trim());
  const mappedHeaders = rawHeaders.map(h => {
    const lower = h.toLowerCase().replace(/[*]/g, '').trim();
    return HEADER_MAP[lower] || lower.replace(/\s+/g, '_');
  });

  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(separator);
    if (values.every(v => !v.trim())) continue; // ligne vide
    const row = {};
    for (let j = 0; j < mappedHeaders.length; j++) {
      row[mappedHeaders[j]] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return { headers: rawHeaders, mappedHeaders, rows, error: null };
}

const PersonnelImportModal = ({ onClose, onImportDone }) => {
  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCollisions, setShowCollisions] = useState(false);
  const [filterAction, setFilterAction] = useState('all'); // all | create | update | conflict

  // Stats par type dans le CSV
  const typeStats = useMemo(() => {
    if (!csvData?.rows) return {};
    const stats = {};
    for (const row of csvData.rows) {
      const t = (row.type_csv || 'Non défini').trim();
      stats[t] = (stats[t] || 0) + 1;
    }
    return stats;
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

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
      const input = document.getElementById('personnel-csv-file-input');
      const dt = new DataTransfer();
      dt.items.add(f);
      input.files = dt.files;
      handleFileSelect({ target: input });
    }
  }, [handleFileSelect]);

  const handlePreview = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.importPersonnelCsv(csvData.rows, 'preview');
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
      setError(null);
      setStep('importing');
      const result = await api.importPersonnelCsv(csvData.rows, 'import');
      setResult(result);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // Filtrer l'analyse
  const filteredAnalysis = useMemo(() => {
    if (!preview?.analysis) return [];
    if (filterAction === 'all') return preview.analysis;
    return preview.analysis.filter(a => a.action === filterAction);
  }, [preview, filterAction]);

  return (
    <div className="eq-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal pi-import-modal">
        <div className="eq-modal-header">
          <h3><Upload size={18} /> Import CSV Personnel</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="eq-modal-body pi-import-body">
          {error && (
            <div className="eq-import-error">
              <AlertTriangle size={16} /> {error}
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}

          {/* Étape 1 : Upload */}
          {step === 'upload' && (
            <div className="eq-import-upload">
              <div
                className="eq-import-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <Users size={48} strokeWidth={1} />
                <h4>Glissez un fichier CSV ici</h4>
                <p>ou cliquez pour sélectionner un fichier</p>
                <p className="eq-import-hint">Format attendu : CSV séparé par <code>;</code></p>
                <p className="eq-import-hint">Colonnes : {EXPECTED_HEADERS.join(', ')}</p>
                <input
                  id="personnel-csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                />
                <button className="eq-btn-primary" onClick={() => document.getElementById('personnel-csv-file-input').click()}>
                  <Upload size={14} /> Choisir un fichier
                </button>
              </div>
            </div>
          )}

          {/* Étape 2 : Aperçu */}
          {step === 'preview' && csvData && (
            <div className="pi-import-preview">
              {/* Stats générales */}
              <div className="eq-import-summary">
                <div className="eq-import-stat">
                  <span className="eq-import-stat-value">{csvData.rows.length}</span>
                  <span className="eq-import-stat-label">Lignes</span>
                </div>
                {Object.entries(typeStats).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="eq-import-stat">
                    <span className="eq-import-stat-value">{count}</span>
                    <span className="eq-import-stat-label">{type}</span>
                  </div>
                ))}
              </div>

              {/* Aperçu des données */}
              <div className="eq-import-section">
                <h4><Eye size={14} /> Aperçu des données (10 premières lignes)</h4>
                <div className="eq-import-table-wrap">
                  <table className="eq-import-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Code Libre</th>
                        <th>Nom</th>
                        <th>Prénom</th>
                        <th>CP</th>
                        <th>Ville</th>
                        <th>Portable</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><code>{row.code_libre}</code></td>
                          <td className="eq-import-name-cell">{row.nom}</td>
                          <td>{row.prenom}</td>
                          <td>{row.cp}</td>
                          <td>{row.ville}</td>
                          <td>{row.portable}</td>
                          <td><span className={`pi-type-tag pi-type-${(row.type_csv || '').toLowerCase().replace(/[^a-z]/g, '')}`}>{row.type_csv}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.rows.length > 10 && (
                  <p className="eq-import-more">... et {csvData.rows.length - 10} lignes supplémentaires</p>
                )}
              </div>

              {/* Analyse des collisions */}
              {preview && (
                <div className="eq-import-section">
                  <h4><AlertCircle size={14} /> Analyse des collisions</h4>
                  <div className="pi-collision-summary">
                    <button
                      className={`pi-collision-stat ${filterAction === 'all' ? 'active' : ''}`}
                      onClick={() => setFilterAction('all')}
                    >
                      <span className="pi-collision-count">{preview.analysis.length}</span>
                      <span>Total</span>
                    </button>
                    <button
                      className={`pi-collision-stat create ${filterAction === 'create' ? 'active' : ''}`}
                      onClick={() => setFilterAction('create')}
                    >
                      <UserPlus size={16} />
                      <span className="pi-collision-count">{preview.toCreate}</span>
                      <span>À créer</span>
                    </button>
                    <button
                      className={`pi-collision-stat update ${filterAction === 'update' ? 'active' : ''}`}
                      onClick={() => setFilterAction('update')}
                    >
                      <RefreshCw size={16} />
                      <span className="pi-collision-count">{preview.toUpdate}</span>
                      <span>À mettre à jour</span>
                    </button>
                    {preview.conflicts > 0 && (
                      <button
                        className={`pi-collision-stat conflict ${filterAction === 'conflict' ? 'active' : ''}`}
                        onClick={() => setFilterAction('conflict')}
                      >
                        <AlertTriangle size={16} />
                        <span className="pi-collision-count">{preview.conflicts}</span>
                        <span>Conflits</span>
                      </button>
                    )}
                    <div className="pi-collision-stat info">
                      <span className="pi-collision-count">{preview.existingCount}</span>
                      <span>Déjà en base</span>
                    </div>
                  </div>

                  {/* Détail des collisions */}
                  <div className="pi-collision-detail">
                    <div className="pi-collision-header" onClick={() => setShowCollisions(!showCollisions)}>
                      {showCollisions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>Détail ({filteredAnalysis.length} entrées)</span>
                    </div>
                    {showCollisions && (
                      <div className="pi-collision-list">
                        <table className="eq-import-table">
                          <thead>
                            <tr>
                              <th>Action</th>
                              <th>Code</th>
                              <th>Nom</th>
                              <th>Prénom</th>
                              <th>Type</th>
                              <th>Collision avec</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAnalysis.slice(0, 50).map((entry, i) => (
                              <tr key={i} className={`pi-row-${entry.action}`}>
                                <td>
                                  <span className={`pi-action-badge ${entry.action}`}>
                                    {entry.action === 'create' && <><UserPlus size={12} /> Créer</>}
                                    {entry.action === 'update' && <><RefreshCw size={12} /> MAJ</>}
                                    {entry.action === 'conflict' && <><AlertTriangle size={12} /> Conflit</>}
                                  </span>
                                </td>
                                <td><code>{entry.code_libre}</code></td>
                                <td className="eq-import-name-cell">{entry.nom}</td>
                                <td>{entry.prenom}</td>
                                <td><span className={`pi-type-tag pi-type-${(entry.type_csv || '').toLowerCase().replace(/[^a-z]/g, '')}`}>{entry.type_csv}</span></td>
                                <td>
                                  {entry.collision ? (
                                    <span className="pi-collision-match">
                                      {entry.collision.first_name} {entry.collision.last_name}
                                      <span className="pi-collision-via"> (via {entry.collision.collisionType === 'code_libre' ? 'code' : 'nom'})</span>
                                    </span>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filteredAnalysis.length > 50 && (
                          <p className="eq-import-more">... et {filteredAnalysis.length - 50} entrées supplémentaires</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bouton Analyser si preview pas encore faite */}
              {!preview && (
                <div className="pi-analyze-cta">
                  <button className="eq-btn-primary" onClick={handlePreview} disabled={loading}>
                    {loading ? <><Loader size={14} className="eq-spinner" /> Analyse...</> : <><AlertCircle size={14} /> Analyser les collisions</>}
                  </button>
                  <p className="pi-analyze-hint">Vérifie les doublons avant l'import</p>
                </div>
              )}
            </div>
          )}

          {/* Étape 3 : Import en cours */}
          {step === 'importing' && (
            <div className="eq-import-progress">
              <Loader size={48} className="eq-spinner" />
              <h4>Import en cours...</h4>
              <p>Création et mise à jour des fiches personnel...</p>
            </div>
          )}

          {/* Étape 4 : Résultat */}
          {step === 'done' && result && (
            <div className="eq-import-result">
              <CheckCircle size={48} className="eq-import-success-icon" />
              <h4>Import terminé avec succès !</h4>
              <div className="eq-import-result-stats">
                <div className="eq-import-result-stat">
                  <span className="eq-import-result-value">{result.created}</span>
                  <span>Personnes créées</span>
                </div>
                <div className="eq-import-result-stat">
                  <span className="eq-import-result-value">{result.updated}</span>
                  <span>Mises à jour</span>
                </div>
                {result.skipped > 0 && (
                  <div className="eq-import-result-stat eq-import-result-skipped">
                    <span className="eq-import-result-value">{result.skipped}</span>
                    <span>Ignorées (conflits)</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="eq-modal-footer">
          {step === 'upload' && (
            <button className="eq-btn-cancel" onClick={onClose}>Fermer</button>
          )}
          {step === 'preview' && (
            <>
              <button className="eq-btn-cancel" onClick={() => { setStep('upload'); setCsvData(null); setFile(null); setPreview(null); setFilterAction('all'); }}>
                ← Retour
              </button>
              {preview && (
                <button className="eq-btn-save" onClick={handleImport} disabled={loading}>
                  <Download size={14} /> Importer {preview.toCreate + preview.toUpdate} personnes
                  {preview.conflicts > 0 && ` (${preview.conflicts} conflits ignorés)`}
                </button>
              )}
            </>
          )}
          {step === 'done' && (
            <button className="eq-btn-save" onClick={() => { onImportDone(); onClose(); }}>
              <CheckCircle size={14} /> Terminé
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonnelImportModal;
