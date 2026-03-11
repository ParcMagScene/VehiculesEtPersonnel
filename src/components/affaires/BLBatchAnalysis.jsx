/**
 * BLBatchAnalysis — Rapport d'analyse batch de PDFs
 * Phase 6 : Scanner plusieurs BL, afficher couverture de parsing et statistiques
 */
import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, BarChart2, ChevronDown, ChevronRight } from 'lucide-react';
import { batchParsePDFs, getDocTypeLabel } from '../../utils/pdfParser';

const CONF_COLORS = { high: '#10b981', medium: '#f59e0b', low: '#ef4444' };

const FIELD_KEYS = [
  'numero', 'client', 'date', 'type', 'nomAffaire',
  'interlocuteur', 'adresse', 'devis', 'tel', 'items'
];

const FIELD_LABELS = {
  numero: 'N° Affaire', client: 'Client', date: 'Date', type: 'Type',
  nomAffaire: 'Nom', interlocuteur: 'Interlocuteur', adresse: 'Adresse',
  devis: 'Devis', tel: 'Tél', items: 'Articles'
};

export default function BLBatchAnalysis({ onClose }) {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [running, setRunning] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const handleFiles = useCallback((e) => {
    const selected = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    setFiles(selected);
    setResults(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (files.length === 0) return;
    setRunning(true);
    setProgress({ current: 0, total: files.length });
    setResults(null);

    const batchResults = await batchParsePDFs(files, (current, total) => {
      setProgress({ current, total });
    });

    setResults(batchResults);
    setRunning(false);
  }, [files]);

  // Calcul des statistiques
  const stats = results ? (() => {
    const total = results.length;
    const errors = results.filter(r => r.error).length;
    const success = total - errors;
    const byDocType = {};
    const fieldCoverage = {};
    FIELD_KEYS.forEach(k => { fieldCoverage[k] = 0; });

    let totalConfidence = 0;
    let totalFieldsFound = 0;
    let totalFieldsTotal = 0;

    results.forEach(r => {
      if (r.error) return;
      const dt = r.docTypeLabel || 'Inconnu';
      byDocType[dt] = (byDocType[dt] || 0) + 1;
      totalConfidence += r.confidence || 0;
      totalFieldsFound += r.fieldsFound || 0;
      totalFieldsTotal += r.fieldsTotal || 0;

      FIELD_KEYS.forEach(k => {
        const v = r[k];
        if (v && (Array.isArray(v) ? v.length > 0 : true)) {
          fieldCoverage[k]++;
        }
      });
    });

    return {
      total, success, errors,
      avgConfidence: success > 0 ? Math.round(totalConfidence / success) : 0,
      avgFieldsFound: success > 0 ? Math.round(totalFieldsFound / success * 10) / 10 : 0,
      avgFieldsTotal: success > 0 ? Math.round(totalFieldsTotal / success * 10) / 10 : 0,
      byDocType,
      fieldCoverage: Object.fromEntries(
        FIELD_KEYS.map(k => [k, success > 0 ? Math.round(fieldCoverage[k] / success * 100) : 0])
      ),
    };
  })() : null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-content"
        style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--theme-border)' }}>
          <BarChart2 size={20} style={{ color: 'var(--theme-primary)' }} />
          <h3 style={{ flex: 1, margin: 0, fontSize: '1.1rem' }}>Analyse batch des BL</h3>
          <button onClick={onClose} className="modal-close-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {/* Sélection fichiers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                border: '2px dashed var(--theme-border)', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.85rem', color: 'var(--theme-text-secondary)', flex: 1, justifyContent: 'center'
              }}
            >
              <Upload size={16} />
              {files.length > 0 ? `${files.length} PDF(s) sélectionné(s)` : 'Sélectionner des fichiers PDF…'}
              <input
                type="file"
                accept=".pdf"
                multiple
                style={{ display: 'none' }}
                onChange={handleFiles}
              />
            </label>
            <button
              onClick={handleAnalyze}
              disabled={files.length === 0 || running}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: 'var(--theme-primary)', color: 'var(--theme-text-inverse)', cursor: files.length > 0 && !running ? 'pointer' : 'not-allowed',
                opacity: files.length === 0 || running ? 0.5 : 1, fontSize: '0.85rem', fontWeight: 600
              }}
            >
              {running ? `Analyse… ${progress.current}/${progress.total}` : 'Analyser'}
            </button>
          </div>

          {/* Barre de progression */}
          {running && (
            <div style={{ height: 4, background: 'var(--theme-border)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--theme-primary)', borderRadius: 2,
                width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          )}

          {/* Rapport statistique */}
          {stats && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={16} style={{ color: 'var(--theme-primary)' }} />
                Rapport ({stats.total} fichier(s))
              </h4>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                <KPICard label="Succès" value={stats.success} total={stats.total} color="#10b981" />
                <KPICard label="Erreurs" value={stats.errors} total={stats.total} color="#ef4444" />
                <KPICard label="Confiance moy." value={`${stats.avgConfidence}%`} color="#3b82f6" />
                <KPICard label="Champs moy." value={`${stats.avgFieldsFound}/${stats.avgFieldsTotal}`} color="#8b5cf6" />
              </div>

              {/* Types détectés */}
              <div style={{ marginBottom: 12 }}>
                <h5 style={{ fontSize: '0.82rem', margin: '0 0 6px' }}>Types de documents</h5>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(stats.byDocType).map(([type, count]) => (
                    <span key={type} style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 500,
                      background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)'
                    }}>
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Couverture par champ */}
              <div style={{ marginBottom: 12 }}>
                <h5 style={{ fontSize: '0.82rem', margin: '0 0 6px' }}>Couverture par champ</h5>
                {FIELD_KEYS.map(k => {
                  const pct = stats.fieldCoverage[k];
                  const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: '0.78rem', width: 90, color: 'var(--theme-text-secondary)' }}>{FIELD_LABELS[k]}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--theme-border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', width: 35, textAlign: 'right', color: barColor, fontWeight: 600 }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Résultats par fichier */}
          {results && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Détail par fichier</h4>
              {results.map((r, idx) => {
                const isExpanded = expandedIdx === idx;
                const fc = r._fieldConfidence || {};
                return (
                  <div key={idx} style={{
                    border: '1px solid var(--theme-border)', borderRadius: 8, marginBottom: 6,
                    background: r.error ? '#fef2f210' : 'var(--theme-bg-card)'
                  }}>
                    {/* Ligne résumé */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                        fontSize: '0.82rem'
                      }}
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <FileText size={14} style={{ color: r.error ? '#ef4444' : '#3b82f6', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.file.name}
                      </span>
                      {r.error ? (
                        <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>
                          <AlertTriangle size={12} /> Erreur
                        </span>
                      ) : (
                        <>
                          <span style={{
                            padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 500,
                            background: 'var(--theme-primary-light)', color: 'var(--theme-primary)'
                          }}>
                            {r.docTypeLabel}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: r.confidence >= 70 ? '#10b981' : '#f59e0b' }}>
                            {r.confidence}%
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--theme-text-secondary)' }}>
                            {r.fieldsFound}/{r.fieldsTotal}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Détail expansible */}
                    {isExpanded && !r.error && (
                      <div style={{ padding: '0 12px 10px', borderTop: '1px solid var(--theme-border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 8 }}>
                          {FIELD_KEYS.filter(k => k !== 'items').map(k => {
                            const val = r[k];
                            const conf = fc[k];
                            return (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                                <span style={{ color: conf ? CONF_COLORS[conf] : 'var(--theme-text-muted)', fontSize: '0.6rem' }}>●</span>
                                <span style={{ color: 'var(--theme-text-secondary)', minWidth: 70 }}>{FIELD_LABELS[k]}</span>
                                <span style={{ fontWeight: val ? 500 : 300, color: val ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {val || '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Articles count */}
                        {r.items && r.items.length > 0 && (
                          <div style={{ fontSize: '0.78rem', marginTop: 6, color: 'var(--theme-text-secondary)' }}>
                            📦 {r.items.length} article(s)
                            {r.sections && r.sections.length > 0 && <> • 📂 {r.sections.length} section(s)</>}
                          </div>
                        )}
                      </div>
                    )}
                    {isExpanded && r.error && (
                      <div style={{ padding: '6px 12px 10px', borderTop: '1px solid var(--theme-border)', fontSize: '0.78rem', color: '#ef4444' }}>
                        {r.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* État vide */}
          {!results && !running && files.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--theme-text-secondary)' }}>
              <BarChart2 size={48} strokeWidth={1} />
              <p style={{ marginTop: 8, fontSize: '0.85rem' }}>
                Sélectionnez des fichiers PDF pour lancer l'analyse batch.
              </p>
              <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                Le rapport affichera la couverture de parsing, les types détectés et les champs extraits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, total, color }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, border: '1px solid var(--theme-border)',
      background: `${color}08`, textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--theme-text-secondary)' }}>
        {label}{total !== undefined ? ` / ${total}` : ''}
      </div>
    </div>
  );
}
