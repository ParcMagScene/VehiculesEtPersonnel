/**
 * SAVImportUpload — Étape 1 : drag-drop ou sélection d'un fichier CSV LocMat.
 * Lance le preview et passe le résultat au parent via `onPreviewReady`.
 *
 * Usage :
 *   <SAVImportUpload onPreviewReady={(file, previewResp) => ...} />
 */
import { FileText, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { Button, InlineAlert, Input, Spinner } from '@/design-system';

import api from '../../utils/api';

export default function SAVImportUpload({ onPreviewReady }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Veuillez sélectionner un fichier .csv');
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const launchPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.savImportPreview(file);
      if (!resp.success) throw new Error(resp.error || 'Erreur preview');
      onPreviewReady(file, resp);
    } catch (e) {
      setError(e.message || 'Erreur lors du preview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 12px 0' }}>Import SAV depuis LocMat</h3>
      <p style={{ marginTop: 0, color: '#666', fontSize: 14 }}>
        Glissez-déposez un fichier CSV exporté depuis LocMat, ou cliquez pour sélectionner.
        <br />
        Colonnes attendues :{' '}
        <code>Code Libre;Code Article;Nom Article;Numéro de série;Début;Fin;Coût;A</code>
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed ' + (dragOver ? '#3b82f6' : '#d1d5db'),
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#eff6ff' : '#f9fafb',
          transition: 'all 0.15s',
        }}
      >
        <Upload size={32} color="#6b7280" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: '#374151' }}>
          {file ? (
            <>
              <FileText size={16} style={{ verticalAlign: 'middle' }} />{' '}
              <strong>{file.name}</strong>{' '}
              <span style={{ color: '#9ca3af' }}>({Math.round(file.size / 1024)} Ko)</span>
            </>
          ) : (
            'Cliquer ou glisser un fichier CSV ici'
          )}
        </div>
        <Input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div style={{ marginTop: 12 }}>
          <InlineAlert type="error">{error}</InlineAlert>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="primary" disabled={!file || loading} onClick={launchPreview}>
          {loading ? <Spinner size="sm" /> : 'Analyser le fichier'}
        </Button>
      </div>
    </div>
  );
}
