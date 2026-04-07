/**
 * BLBatchAnalysis — Rapport d'analyse batch de PDFs
 * Phase 6 : Scanner plusieurs BL, afficher couverture de parsing et statistiques
 */
import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, BarChart2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, ModalLayout } from '@/design-system';
import { batchParsePDFs, getDocTypeLabel } from '../../utils/pdfParser';
import './BLBatchAnalysis.css';

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
    <ModalLayout
      open
      onClose={onClose}
      title="Analyse batch des BL"
      icon={<BarChart2 size={20} />}
      size="xl"
    >
          {/* Sélection fichiers */}
          <div className="bl-batch-file-select">
            <label className="bl-batch-upload-label">
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
            <Button variant="ghost"               onClick={handleAnalyze}
              disabled={files.length === 0 || running}
              className="bl-batch-analyze-btn"
            >
              {running ? `Analyse… ${progress.current}/${progress.total}` : 'Analyser'}
            </Button>
          </div>

          {/* Barre de progression */}
          {running && (
            <div className="bl-batch-progress-track">
              <div className="bl-batch-progress-fill" style={{
                width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%`
              }} />
            </div>
          )}

          {/* Rapport statistique */}
          {stats && (
            <div className="bl-batch-stats">
              <h4 className="bl-batch-stats-header">
                <BarChart2 size={16} className="bl-batch-stats-header-icon" />
                Rapport ({stats.total} fichier(s))
              </h4>

              {/* KPIs */}
              <div className="bl-batch-kpi-grid">
                <KPICard label="Succès" value={stats.success} total={stats.total} color="#10b981" />
                <KPICard label="Erreurs" value={stats.errors} total={stats.total} color="#ef4444" />
                <KPICard label="Confiance moy." value={`${stats.avgConfidence}%`} color="#3b82f6" />
                <KPICard label="Champs moy." value={`${stats.avgFieldsFound}/${stats.avgFieldsTotal}`} color="#8b5cf6" />
              </div>

              {/* Types détectés */}
              <div className="bl-batch-section">
                <h5 className="bl-batch-section-title">Types de documents</h5>
                <div className="bl-batch-tags">
                  {Object.entries(stats.byDocType).map(([type, count]) => (
                    <span key={type} className="bl-batch-tag">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Couverture par champ */}
              <div className="bl-batch-section">
                <h5 className="bl-batch-section-title">Couverture par champ</h5>
                {FIELD_KEYS.map(k => {
                  const pct = stats.fieldCoverage[k];
                  const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={k} className="bl-batch-field-row">
                      <span className="bl-batch-field-label">{FIELD_LABELS[k]}</span>
                      <div className="bl-batch-field-bar-track">
                        <div className="bl-batch-field-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <span className="bl-batch-field-pct" style={{ color: barColor }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Résultats par fichier */}
          {results && (
            <div>
              <h4 className="bl-batch-detail-title">Détail par fichier</h4>
              {results.map((r, idx) => {
                const isExpanded = expandedIdx === idx;
                const fc = r._fieldConfidence || {};
                return (
                  <div key={idx} className={`bl-batch-result-card ${r.error ? 'bl-batch-result-card--error' : 'bl-batch-result-card--ok'}`}>
                    {/* Ligne résumé */}
                    <div
                      className="bl-batch-result-summary"
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <FileText size={14} style={{ color: r.error ? '#ef4444' : '#3b82f6', flexShrink: 0 }} />
                      <span className="bl-batch-result-filename">
                        {r.file.name}
                      </span>
                      {r.error ? (
                        <span className="bl-batch-result-error-text">
                          <AlertTriangle size={12} /> Erreur
                        </span>
                      ) : (
                        <>
                          <span className="bl-batch-result-doctype">
                            {r.docTypeLabel}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: r.confidence >= 70 ? '#10b981' : '#f59e0b' }}>
                            {r.confidence}%
                          </span>
                          <span className="bl-batch-result-fields">
                            {r.fieldsFound}/{r.fieldsTotal}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Détail expansible */}
                    {isExpanded && !r.error && (
                      <div className="bl-batch-detail-panel">
                        <div className="bl-batch-detail-grid">
                          {FIELD_KEYS.filter(k => k !== 'items').map(k => {
                            const val = r[k];
                            const conf = fc[k];
                            return (
                              <div key={k} className="bl-batch-detail-field-row">
                                <span className="bl-batch-detail-conf-dot" style={{ color: conf ? CONF_COLORS[conf] : 'var(--theme-text-muted)' }}>●</span>
                                <span className="bl-batch-detail-field-label">{FIELD_LABELS[k]}</span>
                                <span style={{ fontWeight: val ? 500 : 300, color: val ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {val || '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Articles count */}
                        {r.items && r.items.length > 0 && (
                          <div className="bl-batch-items-count">
                            📦 {r.items.length} article(s)
                            {r.sections && r.sections.length > 0 && <> • 📂 {r.sections.length} section(s)</>}
                          </div>
                        )}
                      </div>
                    )}
                    {isExpanded && r.error && (
                      <div className="bl-batch-error-detail">
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
            <div className="bl-batch-empty">
              <BarChart2 size={48} strokeWidth={1} />
              <p className="bl-batch-empty-text">
                Sélectionnez des fichiers PDF pour lancer l'analyse batch.
              </p>
              <p className="bl-batch-empty-hint">
                Le rapport affichera la couverture de parsing, les types détectés et les champs extraits.
              </p>
            </div>
          )}
    </ModalLayout>
  );
}

function KPICard({ label, value, total, color }) {
  return (
    <div className="bl-batch-kpi-card" style={{ background: `${color}08` }}>
      <div className="bl-batch-kpi-value" style={{ color }}>{value}</div>
      <div className="bl-batch-kpi-label">
        {label}{total !== undefined ? ` / ${total}` : ''}
      </div>
    </div>
  );
}
