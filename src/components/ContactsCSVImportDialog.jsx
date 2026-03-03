import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import api from '../utils/api';
import './ContactsCSVImportDialog.css';

/**
 * Parse un fichier CSV contacts Locmat (séparateur ;).
 * Format attendu : Code Libre;Nom Prénom;Téléphone;Portable;E-Mail;
 */
function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());

  // Trouver la ligne d'en-tête (contient "Code Libre" ou "Nom")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('code libre') || lower.includes('nom') || lower.includes('e-mail')) {
      headerIdx = i;
      break;
    }
  }

  // Si pas d'en-tête trouvé, vérifier si la 1ère ligne est un titre (ex: "Contacts")
  if (headerIdx === -1) {
    // Ligne sans séparateur ';' ou ligne avec un seul champ = titre
    if (!lines[0].includes(';') || lines[0].split(';').filter(Boolean).length <= 1) {
      headerIdx = 1; // header est la 2e ligne
    } else {
      headerIdx = 0; // header est la 1ère ligne
    }
  }

  const dataLines = lines.slice(headerIdx + 1);

  return dataLines.map(line => {
    const parts = line.split(';').map(p => p.trim());
    return {
      codeFree: parts[0] || '',
      nom_prenom: parts[1] || '',
      telephone: parts[2] || '',
      portable: parts[3] || '',
      email: parts[4] || '',
    };
  }).filter(row => row.codeFree || row.nom_prenom || row.email);
}

/**
 * Convertit les rows parsées vers le format attendu par le backend.
 */
function toBackendFormat(rows) {
  return rows.map(r => ({
    codeFree: r.codeFree,
    name: r.nom_prenom,
    phone: r.telephone,
    mobile: r.portable,
    email: r.email,
  }));
}

export default function ContactsCSVImportDialog({ onClose, onSuccess, toast }) {
  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [parsedRows, setParsedRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let text = e.target.result;

        // Tenter plusieurs encodages si le texte contient des caractères corrompus
        if (text.includes('�')) {
          // Re-lire en latin1
          const reader2 = new FileReader();
          reader2.onload = (e2) => {
            processText(e2.target.result);
          };
          reader2.readAsText(file, 'iso-8859-1');
          return;
        }

        processText(text);
      } catch (err) {
        setError('Erreur de lecture du fichier : ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const processText = useCallback(async (text) => {
    try {
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setError('Aucune donnée trouvée dans le fichier CSV');
        return;
      }
      setParsedRows(rows);

      // Demander un preview au serveur
      const backendData = toBackendFormat(rows);
      const prev = await api.importContactsCsv(backendData, 'preview');
      setPreview(prev);
      setStep('preview');
    } catch (err) {
      setError('Erreur lors de l\'analyse du fichier : ' + err.message);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain')) {
      handleFile(file);
    } else {
      setError('Veuillez déposer un fichier .csv');
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e) => {
    handleFile(e.target.files[0]);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    setStep('importing');
    setError(null);
    try {
      const backendData = toBackendFormat(parsedRows);
      const res = await api.importContactsCsv(backendData, 'import');
      setResult(res);
      setStep('done');
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError('Erreur lors de l\'import : ' + err.message);
      setStep('preview');
    }
  }, [parsedRows, onSuccess]);

  return (
    <div className="csv-import-overlay" onClick={onClose}>
      <div className="csv-import-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="csv-import-header">
          <div className="csv-import-title">
            <Upload size={20} />
            <h3>Import CSV Contacts</h3>
          </div>
          <button className="csv-import-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="csv-import-content">
          {/* ── ÉTAPE 1 : Upload ── */}
          {step === 'upload' && (
            <div className="csv-upload-zone">
              <div
                className={`csv-dropzone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={40} className="dropzone-icon" />
                <p className="dropzone-text">
                  Glissez-déposez un fichier CSV ici<br />
                  <span className="dropzone-sub">ou cliquez pour sélectionner</span>
                </p>
                <p className="dropzone-format">
                  Format attendu : <code>Code Libre;Nom Prénom;Téléphone;Portable;E-Mail;</code>
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* ── ÉTAPE 2 : Preview ── */}
          {step === 'preview' && preview && (
            <div className="csv-preview-zone">
              <div className="csv-preview-info">
                <FileText size={16} />
                <span><strong>{fileName}</strong> — {parsedRows.length} contacts détectés</span>
              </div>

              <div className="csv-preview-table-wrapper">
                <table className="csv-preview-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Téléphone</th>
                      <th>Portable</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i}>
                        <td className="code-cell">{row.code_libre || '—'}</td>
                        <td><strong>{row.last_name || '—'}</strong></td>
                        <td>{row.first_name || '—'}</td>
                        <td>{row.phone || '—'}</td>
                        <td>{row.phone2 || '—'}</td>
                        <td className="email-cell">{row.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.totalRows > 30 && (
                <p className="csv-preview-more">
                  … et {preview.totalRows - 30} contacts supplémentaires
                </p>
              )}
            </div>
          )}

          {/* ── ÉTAPE 3 : Import en cours ── */}
          {step === 'importing' && (
            <div className="csv-importing-zone">
              <div className="csv-spinner" />
              <p>Import en cours… {parsedRows.length} contacts</p>
            </div>
          )}

          {/* ── ÉTAPE 4 : Résultat ── */}
          {step === 'done' && result && (
            <div className="csv-result-zone">
              <CheckCircle size={40} className="result-icon success" />
              <h4>Import terminé</h4>
              <div className="result-stats">
                <div className="result-stat">
                  <span className="stat-number created">{result.imported}</span>
                  <span className="stat-label">créés</span>
                </div>
                <div className="result-stat">
                  <span className="stat-number updated">{result.updated}</span>
                  <span className="stat-label">mis à jour</span>
                </div>
                <div className="result-stat">
                  <span className="stat-number skipped">{result.skipped}</span>
                  <span className="stat-label">ignorés</span>
                </div>
                {result.errors > 0 && (
                  <div className="result-stat">
                    <span className="stat-number errored">{result.errors}</span>
                    <span className="stat-label">erreurs</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Erreur ── */}
          {error && (
            <div className="csv-error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="csv-import-footer">
          {step === 'upload' && (
            <button className="btn-secondary" onClick={onClose}>Annuler</button>
          )}
          {step === 'preview' && (
            <>
              <button className="btn-secondary" onClick={() => { setStep('upload'); setParsedRows([]); setPreview(null); setError(null); }}>
                ← Retour
              </button>
              <button className="btn-primary" onClick={handleImport}>
                <Download size={15} /> Importer {parsedRows.length} contacts
              </button>
            </>
          )}
          {step === 'done' && (
            <button className="btn-primary" onClick={onClose}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}
