// ============================================================
// CatalogSettingsPanel.jsx — Apprentissage parsers & normalisation taxonomie
// ============================================================
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  RefreshCw,
  Tags,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import {
  Accordion,
  Button,
  Checkbox,
  Input,
  Select,
  Spinner,
  Tab,
  Table,
  TabList,
  TabPanel,
  Tabs,
  Tag,
} from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { AVAILABLE_PARSERS, parseCatalog } from '../../utils/catalogParsers';
import { extractPDFMeta } from '../../utils/pdfParser';

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — Onglets Parsers / Taxonomie
// ═══════════════════════════════════════════════════════════
export default function CatalogSettingsPanel() {
  return (
    <div className="catalog-settings">
      <Tabs defaultValue="parsers">
        <TabList className="catalog-settings-tabs">
          <Tab value="parsers" icon={<Zap size={16} />}>
            Apprentissage Parsers
          </Tab>
          <Tab value="taxonomy" icon={<Tags size={16} />}>
            Familles &amp; Catégories
          </Tab>
        </TabList>
        <TabPanel value="parsers">
          <ParserLearningTab />
        </TabPanel>
        <TabPanel value="taxonomy">
          <TaxonomyTab />
        </TabPanel>
      </Tabs>
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
    if (!file) {
      toast.error('Sélectionnez un fichier PDF');
      return;
    }
    setAnalyzing(true);
    setReport(null);
    setAllReports([]);

    try {
      const meta = await extractPDFMeta(file);
      const totalLines = meta.text.split('\n').filter((l) => l.trim()).length;

      if (compareMode) {
        // Multi-parser : tester tous les parsers
        const reports = [];
        const parsers = AVAILABLE_PARSERS.filter((p) => p.id !== 'auto');
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
            reports.push({
              parserId: p.id,
              label: p.label,
              result: null,
              analysis: null,
              error: true,
            });
          }
        }
        setAllReports(
          reports.sort(
            (a, b) =>
              (b.analysis?.metrics?.parsedCount || 0) - (a.analysis?.metrics?.parsedCount || 0),
          ),
        );
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
      <h3>
        <Zap size={18} /> Analyseur de performance des parsers
      </h3>
      <p className="catalog-settings-desc">
        Testez vos PDF catalogues avec différents parsers pour analyser le taux de réussite,
        détecter les faux positifs et les lignes ignorées contenant des prix.
      </p>

      {/* ── Sélection fichier + parser ── */}
      <div className="catalog-form-row" style={{ alignItems: 'flex-end' }}>
        <div className="catalog-form-group" style={{ flex: 2 }}>
          <label>Fichier PDF à analyser</label>
          <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file && (
            <small>
              {file.name} — {(file.size / 1024 / 1024).toFixed(1)} Mo
            </small>
          )}
        </div>
        {!compareMode && (
          <div className="catalog-form-group u-flex-1">
            <label>Parser</label>
            <Select value={parserId} onChange={(e) => setParserId(e.target.value)}>
              {AVAILABLE_PARSERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="catalog-form-group">
          <label className="catalog-checkbox-label">
            <Checkbox checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
            Comparer tous les parsers
          </label>
        </div>
      </div>

      <Button
        variant="ghost"
        className="catalog-btn catalog-btn-primary u-mt-2"
        onClick={handleAnalyze}
        disabled={!file || analyzing}
      >
        {analyzing ? (
          <>
            <RefreshCw size={16} className="spin" /> Analyse en cours…
          </>
        ) : (
          <>
            <BarChart3 size={16} /> Lancer l'analyse
          </>
        )}
      </Button>

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

  if (!m) return null;

  return (
    <div className="parser-report">
      <h4>Résultats : {parserLabel}</h4>

      {/* Métriques principales */}
      <div className="parser-metrics-grid">
        <MetricCard label="Articles détectés" value={m.parsedCount} />
        <MetricCard label="Lignes traitées" value={m.totalLines} />
        <MetricCard
          label="Taux de parsing"
          value={`${m.parseRate}%`}
          color={m.parseRate > 5 ? 'green' : m.parseRate > 1 ? 'orange' : 'red'}
        />
        <MetricCard
          label="Avec référence"
          value={`${m.refRate}%`}
          color={m.refRate > 80 ? 'green' : 'orange'}
        />
        <MetricCard
          label="Avec prix"
          value={`${m.priceRate}%`}
          color={m.priceRate > 60 ? 'green' : 'orange'}
        />
        <MetricCard
          label="Faux positifs"
          value={analysis.falsePositiveCount}
          color={analysis.falsePositiveCount > 5 ? 'red' : 'green'}
        />
      </div>

      {/* Familles détectées */}
      {analysis.families?.length > 0 && (
        <div className="parser-section">
          <h5>
            <Tags size={14} /> Familles détectées ({analysis.families.length})
          </h5>
          <div className="parser-tags">
            {analysis.families.slice(0, 15).map((f, i) => (
              <Tag key={i} color="neutral" size="sm">
                {f.name} ({f.count})
              </Tag>
            ))}
            {analysis.families.length > 15 && (
              <Tag color="neutral" size="sm">
                +{analysis.families.length - 15} autres
              </Tag>
            )}
          </div>
        </div>
      )}

      {/* Faux positifs */}
      {analysis.falsePositiveCount > 0 && (
        <div className="parser-section">
          <Accordion
            title={
              <>
                <AlertTriangle size={14} /> {analysis.falsePositiveCount} faux positifs potentiels
              </>
            }
          >
            <Table className="catalog-table u-mt-2">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Désignation</th>
                  <th>Prix</th>
                  <th>Problèmes</th>
                </tr>
              </thead>
              <tbody>
                {analysis.falsePositives.map((fp, i) => (
                  <tr key={i}>
                    <td>{fp.supplierRef || '—'}</td>
                    <td>{fp.designation || '—'}</td>
                    <td className="text-right">{fp.priceHt != null ? `${fp.priceHt} €` : '—'}</td>
                    <td>
                      {fp.issues?.map((issue, j) => (
                        <Tag key={j} color="warning" size="sm" style={{ marginRight: 4 }}>
                          {issueLabel(issue)}
                        </Tag>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Accordion>
        </div>
      )}

      {/* Lignes ignorées avec prix */}
      {analysis.skippedWithPrice?.length > 0 && (
        <div className="parser-section">
          <Accordion
            title={
              <>
                <Eye size={14} /> {analysis.skippedWithPrice.length} lignes ignorées contenant un
                prix
              </>
            }
          >
            <div className="parser-skipped-lines">
              {analysis.skippedWithPrice.map((line, i) => (
                <div key={i} className="parser-skipped-line">
                  {line}
                </div>
              ))}
            </div>
          </Accordion>
        </div>
      )}

      {/* Aperçu articles */}
      {result?.items?.length > 0 && (
        <div className="parser-section">
          <h5>Aperçu des 10 premiers articles</h5>
          <Table className="catalog-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Désignation</th>
                <th>Marque</th>
                <th>Famille</th>
                <th className="text-right">Prix HT</th>
              </tr>
            </thead>
            <tbody>
              {result.items.slice(0, 10).map((a, i) => (
                <tr key={i}>
                  <td>{a.supplier_ref || '—'}</td>
                  <td>{a.designation || '—'}</td>
                  <td>{a.brand || ''}</td>
                  <td>{a.family || ''}</td>
                  <td className="text-right">{a.price_ht != null ? `${a.price_ht} €` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
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
      <h4>
        <BarChart3 size={18} /> Comparaison des parsers
      </h4>
      <Table className="catalog-table">
        <thead>
          <tr>
            <th>Parser</th>
            <th className="text-right">Articles</th>
            <th className="text-right">Taux</th>
            <th className="text-right">Avec réf.</th>
            <th className="text-right">Avec prix</th>
            <th className="text-right">Faux pos.</th>
            <th>Qualité</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r, i) => {
            const m = r.analysis?.metrics;
            if (!m)
              return (
                <tr key={i} className="u-opacity-50">
                  <td>{r.label}</td>
                  <td colSpan={6} className="text-center">
                    Erreur ou aucun résultat
                  </td>
                </tr>
              );

            const score = computeQualityScore(m, r.analysis.falsePositiveCount);
            const best = i === 0;

            return (
              <React.Fragment key={i}>
                <tr className={best ? 'parser-best-row' : ''}>
                  <td>
                    {best && (
                      <CheckCircle2 size={14} className="icon-success" style={{ marginRight: 4 }} />
                    )}
                    {r.label}
                  </td>
                  <td className="text-right">
                    <strong>{m.parsedCount}</strong>
                  </td>
                  <td className="text-right">{m.parseRate}%</td>
                  <td className="text-right">{m.refRate}%</td>
                  <td className="text-right">{m.priceRate}%</td>
                  <td className="text-right">{r.analysis.falsePositiveCount}</td>
                  <td>
                    <div className="parser-quality-bar" title={`Score: ${score}/100`}>
                      <div
                        className="parser-quality-fill"
                        style={{
                          width: `${score}%`,
                          background:
                            score > 70
                              ? 'var(--theme-success)'
                              : score > 40
                                ? 'var(--theme-warning)'
                                : 'var(--theme-error)',
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      className="catalog-btn catalog-btn-secondary u-font-xs"
                      style={{ padding: '2px 8px' }}
                      onClick={() => setExpandedParser(expandedParser === i ? null : i)}
                    >
                      {expandedParser === i ? 'Masquer' : 'Détails'}
                    </Button>
                  </td>
                </tr>
                {expandedParser === i && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <div style={{ padding: '1rem' }}>
                        <SingleParserReport
                          report={{ result: r.result, analysis: r.analysis, parserLabel: r.label }}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </Table>
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

  useEffect(() => {
    loadTaxonomy();
  }, [loadTaxonomy]);

  const toggleRule = (type, from, to) => {
    setSelectedRules((prev) => {
      const exists = prev.find((r) => r.type === type && r.from === from);
      if (exists) return prev.filter((r) => !(r.type === type && r.from === from));
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

  if (loading)
    return (
      <div className="catalog-import-loading">
        <Spinner size="lg" />
        <p>Chargement de la taxonomie…</p>
      </div>
    );
  if (!taxonomy) return null;

  const groups =
    activeSection === 'families'
      ? taxonomy.suggestions?.familyGroups
      : taxonomy.suggestions?.categoryGroups;
  const items = activeSection === 'families' ? taxonomy.families : taxonomy.categories;

  return (
    <div className="catalog-settings-section">
      <h3>
        <Tags size={18} /> Normalisation des familles &amp; catégories
      </h3>
      <p className="catalog-settings-desc">
        Le système détecte automatiquement les variantes similaires (casse, accents, formulation).
        Sélectionnez les regroupements à appliquer puis cliquez sur « Appliquer ».
      </p>

      {/* Stats globales */}
      <div className="parser-metrics-grid u-mb-4">
        <MetricCard label="Articles total" value={taxonomy.totalArticles} />
        <MetricCard label="Avec famille" value={taxonomy.withFamily} />
        <MetricCard label="Avec catégorie" value={taxonomy.withCategory} />
        <MetricCard label="Familles distinctes" value={taxonomy.families?.length || 0} />
        <MetricCard label="Catégories distinctes" value={taxonomy.categories?.length || 0} />
        <MetricCard
          label="Groupes suggérés"
          value={
            (taxonomy.suggestions?.familyGroups?.length || 0) +
            (taxonomy.suggestions?.categoryGroups?.length || 0)
          }
          color="orange"
        />
      </div>

      {/* Onglets famille/catégorie */}
      <div className="catalog-toggle-tabs">
        <Button
          variant="ghost"
          className={`catalog-btn ${activeSection === 'families' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
          onClick={() => setActiveSection('families')}
        >
          Familles ({taxonomy.families?.length || 0})
        </Button>
        <Button
          variant="ghost"
          className={`catalog-btn ${activeSection === 'categories' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
          onClick={() => setActiveSection('categories')}
        >
          Catégories ({taxonomy.categories?.length || 0})
        </Button>
      </div>

      {/* Suggestions de regroupement */}
      {groups?.length > 0 ? (
        <div className="taxonomy-suggestions">
          <h4>
            <AlertTriangle size={16} className="icon-warning" />
            {groups.length} regroupement{groups.length > 1 ? 's' : ''} suggéré
            {groups.length > 1 ? 's' : ''}
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
        <div className="catalog-import-empty u-text-center" style={{ padding: '2rem' }}>
          <CheckCircle2 size={36} className="icon-success" />
          <p>Aucun regroupement suggéré — la taxonomie semble propre !</p>
        </div>
      )}

      {/* Liste complète */}
      <details className="taxonomy-full-list">
        <summary>
          Voir toutes les {activeSection === 'families' ? 'familles' : 'catégories'} (
          {items?.length || 0})
        </summary>
        <Table className="catalog-table u-mt-2">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="text-right">Articles</th>
              <th>Fournisseurs</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td className="text-right">{item.count}</td>
                <td>
                  <small>{item.suppliers}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </details>

      {/* Bouton appliquer */}
      {selectedRules.length > 0 && (
        <div className="taxonomy-apply-bar">
          <span>
            {selectedRules.length} règle{selectedRules.length > 1 ? 's' : ''} sélectionnée
            {selectedRules.length > 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            className="catalog-btn catalog-btn-primary"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? (
              <>
                <RefreshCw size={16} className="spin" /> Application…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Appliquer les regroupements
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Groupe de taxonomie ──
function TaxonomyGroup({ group, type, selectedRules, onToggle }) {
  return (
    <Accordion
      title={
        <>
          <strong>{group.canonical}</strong>{' '}
          <Tag color="neutral" size="sm">
            {group.members.length} variantes
          </Tag>{' '}
          <Tag color="neutral" size="sm">
            {group.totalCount} articles
          </Tag>
        </>
      }
      defaultOpen
      className="taxonomy-group"
    >
      <div className="taxonomy-group-members">
        {group.members.map((member, mi) => {
          const isCanonical = member.name === group.canonical;
          const isSelected = selectedRules.some((r) => r.type === type && r.from === member.name);
          return (
            <div
              key={mi}
              className={`taxonomy-member ${isCanonical ? 'taxonomy-member-canonical' : ''}`}
            >
              {!isCanonical ? (
                <label className="taxonomy-member-label">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggle(type, member.name, group.canonical)}
                  />
                  <span className="taxonomy-member-name">{member.name}</span>
                  <ArrowRight size={12} className="u-opacity-50" />
                  <span className="taxonomy-member-target">{group.canonical}</span>
                  <Tag color="neutral" size="sm" className="u-ml-auto">
                    {member.count}
                  </Tag>
                </label>
              ) : (
                <div className="taxonomy-canonical-content">
                  <CheckCircle2 size={14} className="icon-success" />
                  <span className="taxonomy-member-name">
                    <strong>{member.name}</strong> (référence)
                  </span>
                  <Tag color="neutral" size="sm" className="u-ml-auto">
                    {member.count}
                  </Tag>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Accordion>
  );
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function MetricCard({ label, value, color }) {
  const colorMap = {
    green: 'var(--theme-success)',
    orange: 'var(--theme-warning)',
    red: 'var(--theme-error)',
  };
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
  const fpPenalty = Math.min((fpCount / metrics.parsedCount) * 100, 50);
  const score =
    metrics.refRate * 0.3 +
    metrics.priceRate * 0.3 +
    Math.min(metrics.parseRate * 10, 30) +
    10 -
    fpPenalty;
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
