// ============================================================
// SupplierCatalogPanel.jsx — Articles Fournisseurs eM@g
// Import catalogues PDF, consultation, filtres, suppression
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Search, Upload, Trash2, X, ChevronLeft, ChevronRight, Package, Filter, History, BarChart3, AlertCircle, DatabaseZap, Settings, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import './SupplierCatalogPanel.css';
import { useToast } from '../../hooks/useToast';
import { extractTextFromPDF, extractPDFMeta } from '../../utils/pdfParser';
import { parseCatalog, detectSupplier, AVAILABLE_PARSERS } from '../../utils/catalogParsers';
import CatalogSettingsPanel from './CatalogSettingsPanel';
import EntityCombobox from '../ui/EntityCombobox';

const PAGE_SIZE = 50;

export default function SupplierCatalogPanel({ currentUser }) {
  const toast = useToast();

  // ── State principal ──
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Filtres dynamiques
  const [filterOptions, setFilterOptions] = useState({ brands: [], families: [], categories: [] });
  const [suppliers, setSuppliers] = useState([]);

  // Sous-vues
  const [view, setView] = useState('articles'); // 'articles' | 'imports' | 'stats' | 'settings'
  const [imports, setImports] = useState([]);
  const [stats, setStats] = useState(null);

  // Modal import
  const [showImport, setShowImport] = useState(false);

  const isAdmin = currentUser?.isAdmin;
  const canWrite = isAdmin || currentUser?.permissions?.can_manage_catalog === true;

  // ── Charger les filtres dynamiques ──
  useEffect(() => {
    const params = {};
    if (supplierFilter) params.supplier_id = supplierFilter;
    api.getSupplierArticleFilters(params)
      .then(f => {
        setFilterOptions(f || { brands: [], families: [], categories: [] });
        if (f?.suppliers) setSuppliers(f.suppliers);
      })
      .catch(() => {});
  }, [supplierFilter]);

  // ── Charger les articles ──
  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (search) params.search = search;
      if (supplierFilter) params.supplier_id = supplierFilter;
      if (brandFilter) params.brand_id = brandFilter;
      if (familyFilter) params.family = familyFilter;
      if (categoryFilter) params.category = categoryFilter;
      const data = await api.getSupplierArticles(params);
      setArticles(data.articles || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error('Erreur chargement articles fournisseurs');
    } finally {
      setLoading(false);
    }
  }, [page, search, supplierFilter, brandFilter, familyFilter, categoryFilter]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  // ── Charger les imports ──
  const loadImports = useCallback(async () => {
    try {
      const data = await api.getCatalogImports(supplierFilter ? { supplier_id: supplierFilter } : {});
      setImports(data || []);
    } catch { /* ignore */ }
  }, [supplierFilter]);

  useEffect(() => {
    if (view === 'imports') loadImports();
  }, [view, loadImports]);

  // ── Charger les stats ──
  useEffect(() => {
    if (view === 'stats') {
      api.getSupplierArticleStats().then(s => setStats(s)).catch(() => {});
    }
  }, [view]);

  // ── Pagination ──
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const resetPage = () => setPage(0);

  // ── Suppression d'un article ──
  const handleDeleteArticle = async (id) => {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      await api.deleteSupplierArticle(id);
      toast.success('Article supprimé');
      loadArticles();
    } catch {
      toast.error('Erreur suppression');
    }
  };

  // ── Suppression d'un import (+ ses articles) ──
  const handleDeleteImport = async (imp) => {
    if (!confirm(`Supprimer l'import "${imp.filename}" et ses ${imp.items_count} articles ?`)) return;
    try {
      await api.deleteCatalogImport(imp.id);
      toast.success(`Import supprimé (${imp.items_count} articles)`);
      loadImports();
      loadArticles();
    } catch {
      toast.error('Erreur suppression import');
    }
  };

  // ── Purge totale ──
  const handlePurge = async () => {
    if (!confirm(`⚠️ Supprimer TOUS les ${total} articles fournisseurs et l'historique d'imports ?\n\nCette action est irréversible.`)) return;
    try {
      const result = await api.purgeSupplierArticles();
      toast.success(`Base vidée : ${result.deletedArticles} articles, ${result.deletedImports} imports supprimés`);
      loadArticles();
      if (view === 'imports') loadImports();
      if (view === 'stats') api.getSupplierArticleStats().then(s => setStats(s)).catch(() => {});
    } catch {
      toast.error('Erreur lors de la purge');
    }
  };

  // ── Rafraîchir les marques (détection auto dans les désignations) ──
  const [refreshingBrands, setRefreshingBrands] = useState(false);
  const handleRefreshBrands = async () => {
    setRefreshingBrands(true);
    try {
      const result = await api.refreshSupplierArticleBrands();
      toast.success(`Marques mises à jour : ${result.brandDetected || result.updated} détectées, ${result.familyMapped || 0} familles mappées (${result.scanned} articles scannés)`);
      loadArticles();
      // Recharger les filtres pour avoir les nouvelles marques
      const params = {};
      if (supplierFilter) params.supplier_id = supplierFilter;
      api.getSupplierArticleFilters(params).then(f => {
        setFilterOptions(f || { brands: [], families: [], categories: [] });
      }).catch(() => {});
    } catch {
      toast.error('Erreur lors de la mise à jour des marques');
    } finally {
      setRefreshingBrands(false);
    }
  };

  // ── Callback après import réussi ──
  const handleImportDone = () => {
    setShowImport(false);
    loadArticles();
    if (view === 'imports') loadImports();
    if (view === 'stats') api.getSupplierArticleStats().then(s => setStats(s)).catch(() => {});
  };

  // ── Prix formaté ──
  const fmtPrice = (v) => {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  };

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div className="catalog-panel supplier-articles-panel">
      {/* ── Header ── */}
      <div className="panel-header">
        <h2><FileText size={24} /> Articles Fournisseurs</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Sous-navigation */}
          <button
            className={`catalog-btn ${view === 'articles' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('articles')}
          >
            <Package size={16} /> Articles
          </button>
          <button
            className={`catalog-btn ${view === 'imports' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('imports')}
          >
            <History size={16} /> Imports
          </button>
          <button
            className={`catalog-btn ${view === 'stats' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('stats')}
          >
            <BarChart3 size={16} /> Stats
          </button>
          <button
            className={`catalog-btn ${view === 'settings' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('settings')}
          >
            <Settings size={16} /> Paramètres
          </button>
          {canWrite && (
            <button className="catalog-btn catalog-btn-primary" onClick={() => setShowImport(true)}>
              <Upload size={16} /> Importer PDF
            </button>
          )}
          {canWrite && total > 0 && (
            <button className="catalog-btn catalog-btn-secondary" onClick={handleRefreshBrands} disabled={refreshingBrands} title="Détecter automatiquement les marques dans les désignations">
              <RefreshCw size={16} className={refreshingBrands ? 'spin' : ''} /> Màj marques
            </button>
          )}
          {canWrite && total > 0 && (
            <button className="catalog-btn catalog-btn-danger" onClick={handlePurge} title="Vider toute la base articles fournisseurs">
              <DatabaseZap size={16} /> Vider la base
            </button>
          )}
        </div>
      </div>

      {/* ═══ VUE ARTICLES ═══ */}
      {view === 'articles' && (
        <>
          {/* Toolbar filtres */}
          <div className="catalog-toolbar">
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={16} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--theme-text-secondary)' }} />
              <input
                type="text"
                placeholder="Rechercher (réf, désignation, marque, modèle)…"
                value={search}
                onChange={e => { setSearch(e.target.value); resetPage(); }}
                style={{ paddingLeft: 30, width: '100%' }}
              />
            </div>
            <EntityCombobox
              value={supplierFilter}
              onChange={val => { setSupplierFilter(val); setBrandFilter(''); setFamilyFilter(''); setCategoryFilter(''); resetPage(); }}
              options={suppliers}
              placeholder="Tous fournisseurs"
              allowClear
            />
            <EntityCombobox
              value={brandFilter}
              onChange={val => { setBrandFilter(val); resetPage(); }}
              options={filterOptions.brands}
              placeholder="Toutes marques"
              allowClear
            />
            <EntityCombobox
              value={familyFilter}
              onChange={val => { setFamilyFilter(val); resetPage(); }}
              options={filterOptions.families.map(f => ({ id: f, name: f }))}
              placeholder="Toutes familles"
              allowClear
            />
            {filterOptions.categories.length > 0 && (
              <EntityCombobox
                value={categoryFilter}
                onChange={val => { setCategoryFilter(val); resetPage(); }}
                options={filterOptions.categories.map(c => ({ id: c, name: c }))}
                placeholder="Toutes catégories"
                allowClear
              />
            )}
            <span style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)', whiteSpace: 'nowrap' }}>
              {total} article{total > 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>Chargement…</div>
          ) : articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--theme-text-secondary)' }}>
              <Package size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Aucun article fournisseur</p>
              {canWrite && <p style={{ fontSize: '0.85rem' }}>Importez un catalogue PDF pour commencer</p>}
            </div>
          ) : (
            <div className="catalog-table-wrapper">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Désignation</th>
                    <th>Marque</th>
                    <th>Modèle</th>
                    <th>Famille</th>
                    <th style={{ textAlign: 'right' }}>Prix HT</th>
                    <th>Fournisseur</th>
                    {canWrite && <th style={{ width: 50 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {articles.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.supplier_ref || '—'}</td>
                      <td>{a.designation}</td>
                      <td>{(a.brand_canonical || a.brand) && <span className="catalog-badge">{a.brand_canonical || a.brand}</span>}</td>
                      <td style={{ fontSize: '0.85rem' }}>{a.model || ''}</td>
                      <td style={{ fontSize: '0.85rem' }}>{a.family || ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtPrice(a.price_ht)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{a.supplier_name || ''}</td>
                      {canWrite && (
                        <td>
                          <button className="catalog-btn catalog-btn-danger" style={{ padding: '0.25rem' }} onClick={() => handleDeleteArticle(a.id)} title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="catalog-btn catalog-btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.85rem' }}>Page {page + 1} / {totalPages}</span>
              <button className="catalog-btn catalog-btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══ VUE IMPORTS ═══ */}
      {view === 'imports' && (
        <div>
          {imports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--theme-text-secondary)' }}>
              <History size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Aucun import réalisé</p>
            </div>
          ) : (
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fichier</th>
                  <th>Fournisseur</th>
                  <th>Pages</th>
                  <th>Articles</th>
                  <th>Importé par</th>
                  {canWrite && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {imports.map(imp => (
                  <tr key={imp.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Date(imp.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><FileText size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />{imp.filename}</td>
                    <td>{imp.supplier_name || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{imp.page_count || '?'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{imp.items_count}</td>
                    <td style={{ fontSize: '0.85rem' }}>{imp.imported_by_name || '—'}</td>
                    {canWrite && (
                      <td>
                        <button className="catalog-btn catalog-btn-danger" style={{ padding: '0.25rem' }} onClick={() => handleDeleteImport(imp)} title="Supprimer import + articles">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ VUE STATS ═══ */}
      {view === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div className="supplier-stat-card">
            <h3>Vue d'ensemble</h3>
            <div className="supplier-stat-number">{stats.totalArticles}</div>
            <div className="supplier-stat-label">articles fournisseurs</div>
            <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
              {stats.totalImports} import{stats.totalImports > 1 ? 's' : ''} réalisé{stats.totalImports > 1 ? 's' : ''}
            </div>
          </div>

          <div className="supplier-stat-card">
            <h3>Par fournisseur</h3>
            {stats.bySupplier?.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--theme-border-light)' }}>
                <span>{s.name}</span>
                <strong>{s.count}</strong>
              </div>
            ))}
          </div>

          <div className="supplier-stat-card">
            <h3>Top marques</h3>
            {stats.byBrand?.slice(0, 10).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--theme-border-light)' }}>
                <span>{b.brand}</span>
                <strong>{b.count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ VUE PARAMÈTRES ═══ */}
      {view === 'settings' && <CatalogSettingsPanel />}

      {/* ═══ MODAL IMPORT PDF ═══ */}
      {showImport && (
        <ImportPDFModal
          onDone={handleImportDone}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL D'IMPORT PDF
// ═══════════════════════════════════════════════════════════
function ImportPDFModal({ onDone, onClose }) {
  const toast = useToast();
  const [step, setStep] = useState('select'); // 'select' | 'parsing' | 'preview' | 'importing'
  const [supplierId, setSupplierId] = useState('');
  const [files, setFiles] = useState([]); // Tableau de fichiers
  const [parserId, setParserId] = useState('auto');
  const [parseResults, setParseResults] = useState([]); // Résultats par fichier: [{ file, meta, result }]
  const [parseProgress, setParseProgress] = useState('');
  const [error, setError] = useState('');
  const [allSuppliers, setAllSuppliers] = useState([]);

  useEffect(() => {
    api.getSuppliers().then(data => setAllSuppliers(data || [])).catch(() => {});
  }, []);

  const selectedSupplier = allSuppliers.find(s => String(s.id) === String(supplierId));

  // Totaux combinés
  const totalItems = parseResults.reduce((sum, r) => sum + (r.result?.items?.length || 0), 0);
  const totalSkipped = parseResults.reduce((sum, r) => sum + (r.result?.stats?.skipped || 0), 0);

  // ── Étape 1 → 2 : Parser les PDFs ──
  const handleParse = async () => {
    if (!supplierId) { setError('Sélectionnez un fournisseur'); return; }
    if (files.length === 0) { setError('Sélectionnez au moins un fichier PDF'); return; }
    setError('');
    setStep('parsing');
    const results = [];

    try {
      const forceId = parserId === 'auto' ? undefined : parserId;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setParseProgress(`Analyse de ${f.name} (${i + 1}/${files.length})…`);
        const meta = await extractPDFMeta(f);
        const result = parseCatalog(meta.text, forceId);
        results.push({ file: f, meta, result });
      }
      setParseResults(results);
      setStep('preview');
    } catch (e) {
      setError('Erreur lors de l\'analyse : ' + e.message);
      setStep('select');
    }
  };

  // ── Étape 3 : Envoyer au serveur ──
  const handleImport = async () => {
    if (totalItems === 0) return;
    setStep('importing');
    let totalInserted = 0, totalUpdated = 0, importedCount = 0;
    try {
      for (const { file, meta, result } of parseResults) {
        if (!result?.items?.length) continue;
        setParseProgress(`Import de ${file.name} (${importedCount + 1}/${parseResults.length})…`);
        const res = await api.importSupplierArticles({
          supplier_id: parseInt(supplierId),
          filename: file.name,
          file_size: file.size,
          page_count: meta?.pageCount || 0,
          articles: result.items,
        });
        totalInserted += res.inserted;
        totalUpdated += res.updated;
        importedCount++;
      }
      toast.success(`Import réussi (${importedCount} catalogue${importedCount > 1 ? 's' : ''}) : ${totalInserted} insérés, ${totalUpdated} mis à jour`);
      onDone();
    } catch (e) {
      setError('Erreur import: ' + (e.message || 'erreur serveur'));
      setStep('preview');
    }
  };

  // Supprimer un fichier de la liste
  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="catalog-modal-overlay" onClick={e => e.target === e.currentTarget && step !== 'parsing' && step !== 'importing' && onClose()}>
      <div className="catalog-modal" style={{ maxWidth: 900 }}>
        {/* ── Header ── */}
        <div className="catalog-modal-header">
          <h3><Upload size={20} /> Importer {files.length > 1 ? 'des catalogues' : 'un catalogue'} PDF</h3>
          {step !== 'parsing' && step !== 'importing' && (
            <button className="catalog-btn catalog-btn-secondary" onClick={onClose}><X size={16} /></button>
          )}
        </div>

        {/* ── Body ── */}
        <div className="catalog-modal-body">
          {error && (
            <div className="catalog-import-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* ── STEP: SELECT ── */}
          {step === 'select' && (
            <>
              <div className="catalog-form-row">
                <div className="catalog-form-group">
                  <label>Fournisseur</label>
                  <EntityCombobox
                    value={supplierId}
                    onChange={val => setSupplierId(val)}
                    options={allSuppliers}
                    placeholder="— Choisir un fournisseur —"
                  />
                </div>
                <div className="catalog-form-group">
                  <label>Parser</label>
                  <select value={parserId} onChange={e => setParserId(e.target.value)}>
                    {AVAILABLE_PARSERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="catalog-form-group">
                <label>Fichier(s) PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={e => {
                    const newFiles = Array.from(e.target.files || []);
                    if (newFiles.length) setFiles(prev => [...prev, ...newFiles]);
                  }}
                />
                {files.length > 0 && (
                  <div className="catalog-import-files-list">
                    {files.map((f, i) => (
                      <div key={i} className="catalog-import-file-item">
                        <FileText size={14} />
                        <span>{f.name}</span>
                        <span className="catalog-import-file-size">{(f.size / 1024 / 1024).toFixed(1)} Mo</span>
                        <button className="catalog-btn-icon" onClick={() => handleRemoveFile(i)} title="Retirer">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <span className="catalog-import-hint">
                      {files.length} fichier{files.length > 1 ? 's' : ''} — {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} Mo total
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP: PARSING ── */}
          {step === 'parsing' && (
            <div className="catalog-import-loading">
              <div className="loading-spinner"></div>
              <p>{parseProgress || 'Analyse en cours…'}</p>
              <p className="catalog-import-hint">Cela peut prendre un moment pour les gros fichiers</p>
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && parseResults.length > 0 && (
            <>
              {/* Résumé global */}
              <div className="catalog-import-stats">
                <span><strong>Fournisseur :</strong> {selectedSupplier?.name}</span>
                <span><strong>Catalogues :</strong> {parseResults.length}</span>
                <span><strong>Total articles :</strong> <em className="catalog-import-count">{totalItems}</em></span>
                <span><strong>Ignorées :</strong> {totalSkipped}</span>
              </div>

              {totalItems === 0 ? (
                <div className="catalog-import-empty">
                  <AlertCircle size={36} />
                  <p>Aucun article détecté dans les PDFs.</p>
                  <p className="catalog-import-hint">Essayez un autre parser ou vérifiez le format des catalogues.</p>
                </div>
              ) : (
                parseResults.map((pr, idx) => (
                  <div key={idx} className="catalog-import-file-section">
                    <div className="catalog-import-file-header">
                      <FileText size={16} />
                      <strong>{pr.file.name}</strong>
                      <span className="catalog-import-hint">
                        {pr.result.items.length} article{pr.result.items.length > 1 ? 's' : ''} — {pr.meta?.pageCount || '?'} page{(pr.meta?.pageCount || 0) > 1 ? 's' : ''} — Parser : {pr.result.parserLabel}
                      </span>
                    </div>
                    {pr.result.items.length > 0 && (
                      <div className="catalog-import-preview">
                        <table className="catalog-table">
                          <thead>
                            <tr>
                              <th>Réf.</th>
                              <th>Désignation</th>
                              <th>Marque</th>
                              <th>Modèle</th>
                              <th>Famille</th>
                              <th style={{ textAlign: 'right' }}>Prix HT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pr.result.items.slice(0, 20).map((a, i) => (
                              <tr key={i}>
                                <td className="catalog-import-ref">{a.supplierRef || a.supplier_ref || '—'}</td>
                                <td>{a.designation}</td>
                                <td>{a.brand || ''}</td>
                                <td>{a.model || ''}</td>
                                <td>{a.family || ''}</td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {(a.priceHt ?? a.price_ht) != null
                                    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(a.priceHt ?? a.price_ht)
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {pr.result.items.length > 20 && (
                          <p className="catalog-import-hint" style={{ textAlign: 'center', marginTop: 4 }}>
                            …et {pr.result.items.length - 20} autres articles
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* ── STEP: IMPORTING ── */}
          {step === 'importing' && (
            <div className="catalog-import-loading">
              <div className="loading-spinner"></div>
              <p>{parseProgress || `Import en cours (${totalItems} articles)…`}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step === 'select' && (
          <div className="catalog-modal-footer">
            <button className="catalog-btn catalog-btn-secondary" onClick={onClose}>Annuler</button>
            <button className="catalog-btn catalog-btn-primary" onClick={handleParse} disabled={!supplierId || files.length === 0}>
              Analyser {files.length > 1 ? `les ${files.length} PDFs` : 'le PDF'}
            </button>
          </div>
        )}
        {step === 'preview' && totalItems > 0 && (
          <div className="catalog-modal-footer">
            <button className="catalog-btn catalog-btn-secondary" onClick={() => { setStep('select'); setParseResults([]); }}>
              ← Retour
            </button>
            <button className="catalog-btn catalog-btn-primary" onClick={handleImport}>
              <Upload size={16} /> Importer {totalItems} articles ({parseResults.length} catalogue{parseResults.length > 1 ? 's' : ''})
            </button>
          </div>
        )}
        {step === 'preview' && totalItems === 0 && (
          <div className="catalog-modal-footer">
            <button className="catalog-btn catalog-btn-secondary" onClick={() => setStep('select')}>← Retour</button>
          </div>
        )}
      </div>
    </div>
  );
}
