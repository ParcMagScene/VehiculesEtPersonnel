// ============================================================
// CatalogSettingsPanel.jsx — Apprentissage parsers & normalisation taxonomie
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Upload, AlertTriangle, CheckCircle2, BarChart3, Tags, ArrowRight, RefreshCw, Zap, Eye, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { extractPDFMeta } from '../../utils/pdfParser';
import { parseCatalog, AVAILABLE_PARSERS } from '../../utils/catalogParsers';

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — Onglets Parsers / Taxonomie
// ═══════════════════════════════════════════════════════════
export default function CatalogSettingsPanel() {
  const [tab, setTab] = useState('parsers'); // 'parsers' | 'taxonomy'

  return (
    <div className="catalog-settings">
      <div className="catalog-settings-tabs">
        <button
          className={`catalog-btn ${tab === 'parsers' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
          onClick={() => setTab('parsers')}
        >
          <Zap size={16} /> Apprentissage Parsers
        </button>
        <button
          className={`catalog-btn ${tab === 'taxonomy' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
          onClick={() => setTab('taxonomy')}
        >
          <Tags size={16} /> Familles &amp; Catégories
        </button>
      </div>

      {tab === 'parsers' && <ParserLearningTab />}
      {tab === 'taxonomy' && <TaxonomyTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ONGLET 1 — APPRENTISSAGE PARSERS
// ═══════════════════════════════════════════════════════════
function ParserLearningTab() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [parserId, setParserId] = useState('auto');
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [allReports, setAllReports] = useState([]); // multi-parser comparison

  const handleAnalyze = async () => {
    if (!file) { toast.error('Sélectionnez un fichier PDF'); return; }
    setAnalyzing(true);
    setReport(null);
    setAllReports([]);

    try {
      const meta = await extractPDFMeta(file);
      const totalLines = meta.text.split('\n').filter(l => l.trim()).length;

      if (compareMode) {
        // Multi-parser : tester tous les parsers
        const reports = [];
        const parsers = AVAILABLE_PARSERS.filter(p => p.id !== 'auto');
        for (const p of parsers) {
          try {
            const result = parseCatalog(meta.text, p.id);
            const analysis = await api.analyzeParserResults({
              items: result.items,
              totalLines,
              parserId: p.id,
              text: meta.text,
            });
            reports.push({ parserId: p.id, label: p.label, result, analysis });
          } catch {
            reports.push({ parserId: p.id, label: p.label, result: null, analysis: null, error: true });
          }
        }
        setAllReports(reports.sort((a, b) =>
          (b.analysis?.metrics?.parsedCount || 0) - (a.analysis?.metrics?.parsedCount || 0)
        ));
      } else {
        // Mono-parser
        const forceId = parserId === 'auto' ? undefined : parserId;
        const result = parseCatalog(meta.text, forceId);
        const analysis = await api.analyzeParserResults({
          items: result.items,
          totalLines,
          parserId: result.parserId || parserId,
          text: meta.text,
        });
        setReport({ result, analysis, parserLabel: result.parserLabel });
      }
    } catch (e) {
      toast.error('Erreur analyse: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="catalog-settings-section">
      <h3><Zap size={18} /> Analyseur de performance des parsers</h3>
      <p className="catalog-settings-desc">
        Testez vos PDF catalogues avec différents parsers pour analyser le taux de réussite,
        détecter les faux positifs et les lignes ignorées contenant des prix.
      </p>

      {/* ── Sélection fichier + parser ── */}
      <div className="catalog-form-row" style={{ alignItems: 'flex-end' }}>
        <div className="catalog-form-group" style={{ flex: 2 }}>
          <label>Fichier PDF à analyser</label>
          <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file && <small>{file.name} — {(file.size / 1024 / 1024).toFixed(1)} Mo</small>}
        </div>
        {!compareMode && (
          <div className="catalog-form-group" style={{ flex: 1 }}>
            <label>Parser</label>
            <select value={parserId} onChange={e => setParserId(e.target.value)}>
              {AVAILABLE_PARSERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        )}
        <div className="catalog-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} />
            Comparer tous les parsers
          </label>
        </div>
      </div>

      <button
        className="catalog-btn catalog-btn-primary"
        onClick={handleAnalyze}
        disabled={!file || analyzing}
        style={{ marginTop: '0.5rem' }}
      >
        {analyzing ? <><RefreshCw size={16} className="spin" /> Analyse en cours…</> : <><BarChart3 size={16} /> Lancer l'analyse</>}
      </button>

      {/* ── Résultat mono-parser ── */}
      {report && <SingleParserReport report={report} />}

      {/* ── Résultat multi-parser (comparaison) ── */}
      {allReports.length > 0 && <MultiParserComparison reports={allReports} />}
    </div>
  );
}

// ── Rapport d'un seul parser ──
function SingleParserReport({ report }) {
  const { result, analysis, parserLabel } = report;
  const m = analysis?.metrics;
  const [showFP, setShowFP] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  if (!m) return null;

  return (
    <div className="parser-report">
      <h4>Résultats : {parserLabel}</h4>

      {/* Métriques principales */}
      <div className="parser-metrics-grid">
        <MetricCard label="Articles détectés" value={m.parsedCount} />
        <MetricCard label="Lignes traitées" value={m.totalLines} />
        <MetricCard label="Taux de parsing" value={`${m.parseRate}%`} color={m.parseRate > 5 ? 'green' : m.parseRate > 1 ? 'orange' : 'red'} />
        <MetricCard label="Avec référence" value={`${m.refRate}%`} color={m.refRate > 80 ? 'green' : 'orange'} />
        <MetricCard label="Avec prix" value={`${m.priceRate}%`} color={m.priceRate > 60 ? 'green' : 'orange'} />
        <MetricCard label="Faux positifs" value={analysis.falsePositiveCount} color={analysis.falsePositiveCount > 5 ? 'red' : 'green'} />
      </div>

      {/* Familles détectées */}
      {analysis.families?.length > 0 && (
        <div className="parser-section">
          <h5><Tags size={14} /> Familles détectées ({analysis.families.length})</h5>
          <div className="parser-tags">
            {analysis.families.slice(0, 15).map((f, i) => (
              <span key={i} className="catalog-badge">{f.name} ({f.count})</span>
            ))}
            {analysis.families.length > 15 && <span className="catalog-badge">+{analysis.families.length - 15} autres</span>}
          </div>
        </div>
      )}

      {/* Faux positifs */}
      {analysis.falsePositiveCount > 0 && (
        <div className="parser-section">
          <button className="catalog-btn catalog-btn-secondary" onClick={() => setShowFP(!showFP)}>
            {showFP ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <AlertTriangle size={14} /> {analysis.falsePositiveCount} faux positifs potentiels
          </button>
          {showFP && (
            <table className="catalog-table" style={{ marginTop: 8 }}>
              <thead>
                <tr><th>Réf.</th><th>Désignation</th><th>Prix</th><th>Problèmes</th></tr>
              </thead>
              <tbody>
                {analysis.falsePositives.map((fp, i) => (
                  <tr key={i}>
                    <td>{fp.supplierRef || '—'}</td>
                    <td>{fp.designation || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{fp.priceHt != null ? `${fp.priceHt} €` : '—'}</td>
                    <td>
                      {fp.issues?.map((issue, j) => (
                        <span key={j} className="catalog-badge catalog-badge-warning" style={{ marginRight: 4 }}>
                          {issueLabel(issue)}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Lignes ignorées avec prix */}
      {analysis.skippedWithPrice?.length > 0 && (
        <div className="parser-section">
          <button className="catalog-btn catalog-btn-secondary" onClick={() => setShowSkipped(!showSkipped)}>
            {showSkipped ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Eye size={14} /> {analysis.skippedWithPrice.length} lignes ignorées contenant un prix
          </button>
          {showSkipped && (
            <div className="parser-skipped-lines">
              {analysis.skippedWithPrice.map((line, i) => (
                <div key={i} className="parser-skipped-line">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aperçu articles */}
      {result?.items?.length > 0 && (
        <div className="parser-section">
          <h5>Aperçu des 10 premiers articles</h5>
          <table className="catalog-table">
            <thead>
              <tr><th>Réf.</th><th>Désignation</th><th>Marque</th><th>Famille</th><th style={{ textAlign: 'right' }}>Prix HT</th></tr>
            </thead>
            <tbody>
              {result.items.slice(0, 10).map((a, i) => (
                <tr key={i}>
                  <td>{a.supplier_ref || '—'}</td>
                  <td>{a.designation || '—'}</td>
                  <td>{a.brand || ''}</td>
                  <td>{a.family || ''}</td>
                  <td style={{ textAlign: 'right' }}>{a.price_ht != null ? `${a.price_ht} €` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Comparaison multi-parsers ──
function MultiParserComparison({ reports }) {
  const [expandedParser, setExpandedParser] = useState(null);

  return (
    <div className="parser-comparison">
      <h4><BarChart3 size={18} /> Comparaison des parsers</h4>
      <table className="catalog-table">
        <thead>
          <tr>
            <th>Parser</th>
            <th style={{ textAlign: 'right' }}>Articles</th>
            <th style={{ textAlign: 'right' }}>Taux</th>
            <th style={{ textAlign: 'right' }}>Avec réf.</th>
            <th style={{ textAlign: 'right' }}>Avec prix</th>
            <th style={{ textAlign: 'right' }}>Faux pos.</th>
            <th>Qualité</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r, i) => {
            const m = r.analysis?.metrics;
            if (!m) return (
              <tr key={i} style={{ opacity: 0.5 }}>
                <td>{r.label}</td>
                <td colSpan={6} style={{ textAlign: 'center' }}>Erreur ou aucun résultat</td>
              </tr>
            );

            const score = computeQualityScore(m, r.analysis.falsePositiveCount);
            const best = i === 0;

            return (
              <React.Fragment key={i}>
                <tr className={best ? 'parser-best-row' : ''}>
                  <td>
                    {best && <CheckCircle2 size={14} style={{ color: 'var(--theme-success)', marginRight: 4 }} />}
                    {r.label}
                  </td>
                  <td style={{ textAlign: 'right' }}><strong>{m.parsedCount}</strong></td>
                  <td style={{ textAlign: 'right' }}>{m.parseRate}%</td>
                  <td style={{ textAlign: 'right' }}>{m.refRate}%</td>
                  <td style={{ textAlign: 'right' }}>{m.priceRate}%</td>
                  <td style={{ textAlign: 'right' }}>{r.analysis.falsePositiveCount}</td>
                  <td>
                    <div className="parser-quality-bar" title={`Score: ${score}/100`}>
                      <div className="parser-quality-fill" style={{ width: `${score}%`, background: score > 70 ? 'var(--theme-success)' : score > 40 ? 'var(--theme-warning)' : 'var(--theme-error)' }} />
                    </div>
                  </td>
                  <td>
                    <button
                      className="catalog-btn catalog-btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={() => setExpandedParser(expandedParser === i ? null : i)}
                    >
                      {expandedParser === i ? 'Masquer' : 'Détails'}
                    </button>
                  </td>
                </tr>
                {expandedParser === i && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <div style={{ padding: '1rem' }}>
                        <SingleParserReport report={{ result: r.result, analysis: r.analysis, parserLabel: r.label }} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ONGLET 2 — NORMALISATION FAMILLES & CATÉGORIES
// ═══════════════════════════════════════════════════════════
function TaxonomyTab() {
  const toast = useToast();
  const [taxonomy, setTaxonomy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selectedRules, setSelectedRules] = useState([]); // { type, from, to }
  const [activeSection, setActiveSection] = useState('families'); // 'families' | 'categories'

  const loadTaxonomy = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTaxonomy();
      setTaxonomy(data);
      setSelectedRules([]);
    } catch {
      toast.error('Erreur chargement taxonomie');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTaxonomy(); }, [loadTaxonomy]);

  const toggleRule = (type, from, to) => {
    setSelectedRules(prev => {
      const exists = prev.find(r => r.type === type && r.from === from);
      if (exists) return prev.filter(r => !(r.type === type && r.from === from));
      return [...prev, { type, from, to }];
    });
  };

  const handleApply = async () => {
    if (!selectedRules.length) return;
    setApplying(true);
    try {
      const result = await api.applyTaxonomyRules(selectedRules);
      toast.success(`Normalisation appliquée : ${result.totalChanged} articles modifiés`);
      await loadTaxonomy();
    } catch (e) {
      toast.error('Erreur normalisation: ' + (e.message || 'erreur'));
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="catalog-import-loading"><div className="loading-spinner" /><p>Chargement de la taxonomie…</p></div>;
  if (!taxonomy) return null;

  const groups = activeSection === 'families' ? taxonomy.suggestions?.familyGroups : taxonomy.suggestions?.categoryGroups;
  const items = activeSection === 'families' ? taxonomy.families : taxonomy.categories;

  return (
    <div className="catalog-settings-section">
      <h3><Tags size={18} /> Normalisation des familles &amp; catégories</h3>
      <p className="catalog-settings-desc">
        Le système détecte automatiquement les variantes similaires (casse, accents, formulation).
        Sélectionnez les regroupements à appliquer puis cliquez sur « Appliquer ».
      </p>

      {/* Stats globales */}
      <div className="parser-metrics-grid" style={{ marginBottom: '1rem' }}>
        <MetricCard label="Articles total" value={taxonomy.totalArticles} />
        <MetricCard label="Avec famille" value={taxonomy.withFamily} />
        <MetricCard label="Avec catégorie" value={taxonomy.withCategory} />
        <MetricCard label="Familles distinctes" value={taxonomy.families?.length || 0} />
        <MetricCard label="Catégories distinctes" value={taxonomy.categories?.length || 0} />
        <MetricCard label="Groupes suggérés" value={(taxonomy.suggestions?.familyGroups?.length || 0) + (taxonomy.suggestions?.categoryGroups?.length || 0)} color="orange" />
      </div>

      {/* Onglets famille/catégorie */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          className={`catalog-btn ${activeSection === 'families' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
          onClick={() => setActiveSection('families')}
        >
          Familles ({taxonomy.families?.length || 0})
        </button>
        <button
          className={`catalog-btn ${activeSection === 'categories' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
          onClick={() => setActiveSection('categories')}
        >
          Catégories ({taxonomy.categories?.length || 0})
        </button>
      </div>

      {/* Suggestions de regroupement */}
      {groups?.length > 0 ? (
        <div className="taxonomy-suggestions">
          <h4>
            <AlertTriangle size={16} style={{ color: 'var(--theme-warning)' }} />
            {groups.length} regroupement{groups.length > 1 ? 's' : ''} suggéré{groups.length > 1 ? 's' : ''}
          </h4>
          {groups.map((group, gi) => (
            <TaxonomyGroup
              key={gi}
              group={group}
              type={activeSection === 'families' ? 'family' : 'category'}
              selectedRules={selectedRules}
              onToggle={toggleRule}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-import-empty" style={{ padding: '2rem', textAlign: 'center' }}>
          <CheckCircle2 size={36} style={{ color: 'var(--theme-success)' }} />
          <p>Aucun regroupement suggéré — la taxonomie semble propre !</p>
        </div>
      )}

      {/* Liste complète */}
      <details className="taxonomy-full-list">
        <summary>Voir toutes les {activeSection === 'families' ? 'familles' : 'catégories'} ({items?.length || 0})</summary>
        <table className="catalog-table" style={{ marginTop: 8 }}>
          <thead>
            <tr><th>Nom</th><th style={{ textAlign: 'right' }}>Articles</th><th>Fournisseurs</th></tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td style={{ textAlign: 'right' }}>{item.count}</td>
                <td><small>{item.suppliers}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {/* Bouton appliquer */}
      {selectedRules.length > 0 && (
        <div className="taxonomy-apply-bar">
          <span>{selectedRules.length} règle{selectedRules.length > 1 ? 's' : ''} sélectionnée{selectedRules.length > 1 ? 's' : ''}</span>
          <button
            className="catalog-btn catalog-btn-primary"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? <><RefreshCw size={16} className="spin" /> Application…</> : <><CheckCircle2 size={16} /> Appliquer les regroupements</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Groupe de taxonomie ──
function TaxonomyGroup({ group, type, selectedRules, onToggle }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="taxonomy-group">
      <div className="taxonomy-group-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <strong>{group.canonical}</strong>
        <span className="catalog-badge">{group.members.length} variantes</span>
        <span className="catalog-badge">{group.totalCount} articles</span>
      </div>
      {open && (
        <div className="taxonomy-group-members">
          {group.members.map((member, mi) => {
            const isCanonical = member.name === group.canonical;
            const isSelected = selectedRules.some(r => r.type === type && r.from === member.name);
            return (
              <div key={mi} className={`taxonomy-member ${isCanonical ? 'taxonomy-member-canonical' : ''}`}>
                {!isCanonical ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(type, member.name, group.canonical)}
                    />
                    <span className="taxonomy-member-name">{member.name}</span>
                    <ArrowRight size={12} style={{ opacity: 0.5 }} />
                    <span className="taxonomy-member-target">{group.canonical}</span>
                    <span className="catalog-badge" style={{ marginLeft: 'auto' }}>{member.count}</span>
                  </label>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--theme-success)' }} />
                    <span className="taxonomy-member-name"><strong>{member.name}</strong> (référence)</span>
                    <span className="catalog-badge" style={{ marginLeft: 'auto' }}>{member.count}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function MetricCard({ label, value, color }) {
  const colorMap = { green: 'var(--theme-success)', orange: 'var(--theme-warning)', red: 'var(--theme-error)' };
  return (
    <div className="parser-metric-card">
      <div className="parser-metric-value" style={color ? { color: colorMap[color] } : {}}>
        {value}
      </div>
      <div className="parser-metric-label">{label}</div>
    </div>
  );
}

function computeQualityScore(metrics, fpCount) {
  if (!metrics.parsedCount) return 0;
  const fpPenalty = Math.min(fpCount / metrics.parsedCount * 100, 50);
  const score = (metrics.refRate * 0.3 + metrics.priceRate * 0.3 + Math.min(metrics.parseRate * 10, 30) + 10) - fpPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function issueLabel(issue) {
  const labels = {
    designation_length: 'Désignation invalide',
    ref_looks_like_page_number: 'Réf. = n° page ?',
    price_aberrant: 'Prix aberrant',
    designation_is_header: 'En-tête parasite',
    duplicate_ref: 'Réf. dupliquée',
  };
  return labels[issue] || issue;
}
