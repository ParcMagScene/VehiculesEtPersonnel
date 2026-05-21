// ============================================================
// SupplierCatalogPanel.jsx — Articles Fournisseurs eM@g
// Import catalogues PDF, consultation, filtres, suppression
// ============================================================

import './SupplierCatalogPanel.css';

import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  FileText,
  History,
  Package,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button, EntityCombobox, InlineAlert, Input, ModalLayout, SearchBar, Select, Spinner, Table, Tag, Tooltip } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { AVAILABLE_PARSERS, parseCatalog } from '../../utils/catalogParsers';
import { formatDateTime } from '../../utils/formatUtils';
import { extractPDFMeta } from '../../utils/pdfParser';
import { refreshBus } from '../../utils/refresh-bus';
import CatalogSettingsPanel from './CatalogSettingsPanel';

const PAGE_SIZE = 50;

export function SupplierCatalogPanel({ currentUser }) {
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
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const isAdmin = currentUser?.isAdmin;
  const canWrite = isAdmin || currentUser?.permissions?.canManageCatalog === true;

  // ── Charger les filtres dynamiques ──
  useEffect(() => {
    const params = {};
    if (supplierFilter) params.supplier_id = supplierFilter;
    api
      .getSupplierArticleFilters(params)
      .then((f) => {
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
  }, [page, search, supplierFilter, brandFilter, familyFilter, categoryFilter, toast]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // ── Charger les imports ──
  const loadImports = useCallback(async () => {
    try {
      const data = await api.getCatalogImports(
        supplierFilter ? { supplier_id: supplierFilter } : {},
      );
      setImports(data || []);
    } catch {
      /* ignore */
    }
  }, [supplierFilter]);

  useEffect(() => {
    if (view === 'imports') loadImports();
  }, [view, loadImports]);

  // ── Charger les stats ──
  useEffect(() => {
    if (view === 'stats') {
      api
        .getSupplierArticleStats()
        .then((s) => setStats(s))
        .catch(() => {});
    }
  }, [view]);

  // ── Pagination ──
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const resetPage = () => setPage(0);

  // ── Suppression d'un article ──
  const handleDeleteArticle = (id) => {
    confirm({
      title: "Supprimer l'article",
      message: 'Supprimer cet article ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteSupplierArticle(id);
          toast.success('Article supprimé');
          refreshBus.publish('orders');
          loadArticles();
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  };

  // ── Suppression d'un import (+ ses articles) ──
  const handleDeleteImport = (imp) => {
    confirm({
      title: "Supprimer l'import",
      message: `Supprimer l'import "${imp.filename}" et ses ${imp.items_count} articles ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteCatalogImport(imp.id);
          toast.success(`Import supprimé (${imp.items_count} articles)`);
          loadImports();
          loadArticles();
        } catch {
          toast.error('Erreur suppression import');
        }
      },
    });
  };

  // ── Purge totale ──
  const handlePurge = () => {
    confirm({
      title: 'Purger la base',
      message: `⚠️ Supprimer TOUS les ${total} articles fournisseurs et l'historique d'imports ?\n\nCette action est irréversible.`,
      variant: 'danger',
      confirmLabel: 'Purger',
      onConfirm: async () => {
        try {
          const result = await api.purgeSupplierArticles();
          toast.success(
            `Base vidée : ${result.deletedArticles} articles, ${result.deletedImports} imports supprimés`,
          );
          loadArticles();
          if (view === 'imports') loadImports();
          if (view === 'stats')
            api
              .getSupplierArticleStats()
              .then((s) => setStats(s))
              .catch(() => {});
        } catch {
          toast.error('Erreur lors de la purge');
        }
      },
    });
  };

  // ── Rafraîchir les marques (détection auto dans les désignations) ──
  const [refreshingBrands, setRefreshingBrands] = useState(false);
  const handleRefreshBrands = async () => {
    setRefreshingBrands(true);
    try {
      const result = await api.refreshSupplierArticleBrands();
      toast.success(
        `Marques mises à jour : ${result.brandDetected || result.updated} détectées, ${result.familyMapped || 0} familles mappées (${result.scanned} articles scannés)`,
      );
      loadArticles();
      // Recharger les filtres pour avoir les nouvelles marques
      const params = {};
      if (supplierFilter) params.supplier_id = supplierFilter;
      api
        .getSupplierArticleFilters(params)
        .then((f) => {
          setFilterOptions(f || { brands: [], families: [], categories: [] });
        })
        .catch(() => {});
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
    if (view === 'stats')
      api
        .getSupplierArticleStats()
        .then((s) => setStats(s))
        .catch(() => {});
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
        <h2>
          <FileText size={24} /> Articles Fournisseurs
        </h2>
        <div className="u-flex-center u-gap-2">
          {/* Sous-navigation */}
          <Button
            variant="ghost"
            className={`catalog-btn ${view === 'articles' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('articles')}
          >
            <Package size={16} /> Articles
          </Button>
          <Button
            variant="ghost"
            className={`catalog-btn ${view === 'imports' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('imports')}
          >
            <History size={16} /> Imports
          </Button>
          <Button
            variant="ghost"
            className={`catalog-btn ${view === 'stats' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('stats')}
          >
            <BarChart3 size={16} /> Stats
          </Button>
          <Button
            variant="ghost"
            className={`catalog-btn ${view === 'settings' ? 'catalog-btn-primary' : 'catalog-btn-secondary'}`}
            onClick={() => setView('settings')}
          >
            <Settings size={16} /> Paramètres
          </Button>
          {canWrite && (
            <Button variant="primary" onClick={() => setShowImport(true)}>
              <Upload size={16} /> Importer PDF
            </Button>
          )}
          {canWrite && total > 0 && (
            <Tooltip
              content="Détecter automatiquement les marques dans les désignations"
              position="bottom"
            >
              <Button variant="secondary" onClick={handleRefreshBrands} disabled={refreshingBrands}>
                <RefreshCw size={16} className={refreshingBrands ? 'spin' : ''} /> Màj marques
              </Button>
            </Tooltip>
          )}
          {canWrite && total > 0 && (
            <Tooltip content="Vider toute la base articles fournisseurs" position="bottom">
              <Button variant="danger" onClick={handlePurge}>
                <DatabaseZap size={16} /> Vider la base
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ═══ VUE ARTICLES ═══ */}
      {view === 'articles' && (
        <>
          {/* Toolbar filtres */}
          <div className="catalog-toolbar">
            <SearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                resetPage();
              }}
              placeholder="Rechercher (réf, désignation, marque, modèle)…"
              className="scp-search"
              style={{ flex: '1 1 200px' }}
            />
            <EntityCombobox
              value={supplierFilter}
              onChange={(val) => {
                setSupplierFilter(val);
                setBrandFilter('');
                setFamilyFilter('');
                setCategoryFilter('');
                resetPage();
              }}
              options={suppliers}
              placeholder="Tous fournisseurs"
              allowClear
            />
            <EntityCombobox
              value={brandFilter}
              onChange={(val) => {
                setBrandFilter(val);
                resetPage();
              }}
              options={filterOptions.brands}
              placeholder="Toutes marques"
              allowClear
            />
            <EntityCombobox
              value={familyFilter}
              onChange={(val) => {
                setFamilyFilter(val);
                resetPage();
              }}
              options={filterOptions.families.map((f) => ({ id: f, name: f }))}
              placeholder="Toutes familles"
              allowClear
            />
            {filterOptions.categories.length > 0 && (
              <EntityCombobox
                value={categoryFilter}
                onChange={(val) => {
                  setCategoryFilter(val);
                  resetPage();
                }}
                options={filterOptions.categories.map((c) => ({ id: c, name: c }))}
                placeholder="Toutes catégories"
                allowClear
              />
            )}
            <span className="u-text-secondary u-font-sm u-nowrap">
              {total} article{total > 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div className="u-text-center u-p-12">Chargement…</div>
          ) : articles.length === 0 ? (
            <div className="u-text-center u-text-secondary u-p-12">
              <Package size={48} className="u-opacity-30 u-mb-4" />
              <p>Aucun article fournisseur</p>
              {canWrite && <p className="u-font-sm">Importez un catalogue PDF pour commencer</p>}
            </div>
          ) : (
            <div className="catalog-table-wrapper">
              <Table className="catalog-table">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Désignation</th>
                    <th>Marque</th>
                    <th>Modèle</th>
                    <th>Famille</th>
                    <th className="u-text-right">Prix HT</th>
                    <th>Fournisseur</th>
                    {canWrite && <th style={{ width: 50 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td className="u-font-mono u-font-xs">{a.supplier_ref || '—'}</td>
                      <td>{a.designation}</td>
                      <td>
                        {(a.brand_canonical || a.brand) && (
                          <Tag color="primary" size="sm">
                            {a.brand_canonical || a.brand}
                          </Tag>
                        )}
                      </td>
                      <td className="u-font-sm">{a.model || ''}</td>
                      <td className="u-font-sm">{a.family || ''}</td>
                      <td className="u-text-right u-font-semibold u-nowrap">
                        {fmtPrice(a.price_ht)}
                      </td>
                      <td className="u-font-sm">{a.supplier_name || ''}</td>
                      {canWrite && (
                        <td>
                          <Tooltip content="Supprimer">
                            <Button
                              variant="danger"
                              size="sm"
                              iconOnly
                              className="u-p-1"
                              aria-label="Supprimer"
                              onClick={() => handleDeleteArticle(a.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </Tooltip>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination u-flex-center u-gap-3 u-mt-4 u-justify-center">
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="u-font-sm">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ═══ VUE IMPORTS ═══ */}
      {view === 'imports' && (
        <div>
          {imports.length === 0 ? (
            <div className="u-text-center u-text-secondary u-p-12">
              <History size={48} className="u-opacity-30 u-mb-4" />
              <p>Aucun import réalisé</p>
            </div>
          ) : (
            <Table className="catalog-table">
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
                {imports.map((imp) => (
                  <tr key={imp.id}>
                    <td className="u-nowrap u-font-sm">{formatDateTime(imp.created_at)}</td>
                    <td>
                      <FileText
                        size={14}
                        style={{ marginRight: 4, verticalAlign: 'text-bottom' }}
                      />
                      {imp.filename}
                    </td>
                    <td>{imp.supplier_name || '—'}</td>
                    <td className="u-text-center">{imp.page_count || '?'}</td>
                    <td className="u-text-center u-font-semibold">{imp.items_count}</td>
                    <td className="u-font-sm">{imp.imported_by_name || '—'}</td>
                    {canWrite && (
                      <td>
                        <Tooltip content="Supprimer import + articles">
                          <Button
                            variant="danger"
                            size="sm"
                            iconOnly
                            className="u-p-1"
                            aria-label="Supprimer"
                            onClick={() => handleDeleteImport(imp)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </Tooltip>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}

      {/* ═══ VUE STATS ═══ */}
      {view === 'stats' && stats && (
        <div
          className="u-gap-6"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
        >
          <div className="supplier-stat-card">
            <h3>Vue d'ensemble</h3>
            <div className="supplier-stat-number">{stats.totalArticles}</div>
            <div className="supplier-stat-label">articles fournisseurs</div>
            <div className="u-text-secondary u-mt-2" style={{ fontSize: '0.85rem' }}>
              {stats.totalImports} import{stats.totalImports > 1 ? 's' : ''} réalisé
              {stats.totalImports > 1 ? 's' : ''}
            </div>
          </div>

          <div className="supplier-stat-card">
            <h3>Par fournisseur</h3>
            {stats.bySupplier?.map((s, i) => (
              <div
                key={i}
                className="u-flex"
                style={{
                  justifyContent: 'space-between',
                  padding: '0.25rem 0',
                  borderBottom: '1px solid var(--theme-border-light)',
                }}
              >
                <span>{s.name}</span>
                <strong>{s.count}</strong>
              </div>
            ))}
          </div>

          <div className="supplier-stat-card">
            <h3>Top marques</h3>
            {stats.byBrand?.slice(0, 10).map((b, i) => (
              <div
                key={i}
                className="u-flex"
                style={{
                  justifyContent: 'space-between',
                  padding: '0.25rem 0',
                  borderBottom: '1px solid var(--theme-border-light)',
                }}
              >
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
        <ImportPDFModal onDone={handleImportDone} onClose={() => setShowImport(false)} />
      )}
      {ConfirmDialogRenderer}
    </div>
  );
}

export default SupplierCatalogPanel;

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
    api
      .getSuppliers()
      .then((data) => setAllSuppliers(data || []))
      .catch(() => {});
  }, []);

  const selectedSupplier = allSuppliers.find((s) => String(s.id) === String(supplierId));

  // Totaux combinés
  const totalItems = parseResults.reduce((sum, r) => sum + (r.result?.items?.length || 0), 0);
  const totalSkipped = parseResults.reduce((sum, r) => sum + (r.result?.stats?.skipped || 0), 0);

  // ── Étape 1 → 2 : Parser les PDFs ──
  const handleParse = async () => {
    if (!supplierId) {
      setError('Sélectionnez un fournisseur');
      return;
    }
    if (files.length === 0) {
      setError('Sélectionnez au moins un fichier PDF');
      return;
    }
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
      setError("Erreur lors de l'analyse : " + e.message);
      setStep('select');
    }
  };

  // ── Étape 3 : Envoyer au serveur ──
  const handleImport = async () => {
    if (totalItems === 0) return;
    setStep('importing');
    let totalInserted = 0,
      totalUpdated = 0,
      importedCount = 0;
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
      toast.success(
        `Import réussi (${importedCount} catalogue${importedCount > 1 ? 's' : ''}) : ${totalInserted} insérés, ${totalUpdated} mis à jour`,
      );
      onDone();
    } catch (e) {
      setError('Erreur import: ' + (e.message || 'erreur serveur'));
      setStep('preview');
    }
  };

  // Supprimer un fichier de la liste
  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <ModalLayout
      open
      onClose={() => {
        if (step !== 'parsing' && step !== 'importing') onClose();
      }}
      title={`Importer ${files.length > 1 ? 'des catalogues' : 'un catalogue'} PDF`}
      icon={<Upload size={20} />}
      size="xl"
      footer={
        step === 'select' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleParse}
              disabled={!supplierId || files.length === 0}
            >
              Analyser {files.length > 1 ? `les ${files.length} PDFs` : 'le PDF'}
            </Button>
          </>
        ) : step === 'preview' && totalItems > 0 ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('select');
                setParseResults([]);
              }}
            >
              ← Retour
            </Button>
            <Button variant="primary" onClick={handleImport}>
              <Upload size={16} /> Importer {totalItems} articles ({parseResults.length} catalogue
              {parseResults.length > 1 ? 's' : ''})
            </Button>
          </>
        ) : step === 'preview' && totalItems === 0 ? (
          <Button variant="ghost" onClick={() => setStep('select')}>
            ← Retour
          </Button>
        ) : null
      }
    >
      {/* ── Body ── */}
      <div className="catalog-modal-body">
        {error && <InlineAlert>{error}</InlineAlert>}

        {/* ── STEP: SELECT ── */}
        {step === 'select' && (
          <>
            <div className="catalog-form-row">
              <div className="catalog-form-group">
                <label>Fournisseur</label>
                <EntityCombobox
                  value={supplierId}
                  onChange={(val) => setSupplierId(val)}
                  options={allSuppliers}
                  placeholder="— Choisir un fournisseur —"
                />
              </div>
              <div className="catalog-form-group">
                <label>Parser</label>
                <Select value={parserId} onChange={(e) => setParserId(e.target.value)}>
                  {AVAILABLE_PARSERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="catalog-form-group">
              <label>Fichier(s) PDF</label>
              <Input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files || []);
                  if (newFiles.length) setFiles((prev) => [...prev, ...newFiles]);
                }}
              />
              {files.length > 0 && (
                <div className="catalog-import-files-list">
                  {files.map((f, i) => (
                    <div key={i} className="catalog-import-file-item">
                      <FileText size={14} />
                      <span>{f.name}</span>
                      <span className="catalog-import-file-size">
                        {(f.size / 1024 / 1024).toFixed(1)} Mo
                      </span>
                      <Tooltip content="Retirer">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Retirer"
                          onClick={() => handleRemoveFile(i)}
                        >
                          <X size={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  ))}
                  <span className="catalog-import-hint">
                    {files.length} fichier{files.length > 1 ? 's' : ''} —{' '}
                    {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} Mo total
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── STEP: PARSING ── */}
        {step === 'parsing' && (
          <div className="catalog-import-loading">
            <Spinner size="lg" />
            <p>{parseProgress || 'Analyse en cours…'}</p>
            <p className="catalog-import-hint">
              Cela peut prendre un moment pour les gros fichiers
            </p>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && parseResults.length > 0 && (
          <>
            {/* Résumé global */}
            <div className="catalog-import-stats">
              <span>
                <strong>Fournisseur :</strong> {selectedSupplier?.name}
              </span>
              <span>
                <strong>Catalogues :</strong> {parseResults.length}
              </span>
              <span>
                <strong>Total articles :</strong>{' '}
                <em className="catalog-import-count">{totalItems}</em>
              </span>
              <span>
                <strong>Ignorées :</strong> {totalSkipped}
              </span>
            </div>

            {totalItems === 0 ? (
              <div className="catalog-import-empty">
                <AlertCircle size={36} />
                <p>Aucun article détecté dans les PDFs.</p>
                <p className="catalog-import-hint">
                  Essayez un autre parser ou vérifiez le format des catalogues.
                </p>
              </div>
            ) : (
              parseResults.map((pr, idx) => (
                <div key={idx} className="catalog-import-file-section">
                  <div className="catalog-import-file-header">
                    <FileText size={16} />
                    <strong>{pr.file.name}</strong>
                    <span className="catalog-import-hint">
                      {pr.result.items.length} article{pr.result.items.length > 1 ? 's' : ''} —{' '}
                      {pr.meta?.pageCount || '?'} page{(pr.meta?.pageCount || 0) > 1 ? 's' : ''} —
                      Parser : {pr.result.parserLabel}
                    </span>
                  </div>
                  {pr.result.items.length > 0 && (
                    <div className="catalog-import-preview">
                      <Table className="catalog-table">
                        <thead>
                          <tr>
                            <th>Réf.</th>
                            <th>Désignation</th>
                            <th>Marque</th>
                            <th>Modèle</th>
                            <th>Famille</th>
                            <th className="u-text-right">Prix HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pr.result.items.slice(0, 20).map((a, i) => (
                            <tr key={i}>
                              <td className="catalog-import-ref">
                                {a.supplierRef || a.supplier_ref || '—'}
                              </td>
                              <td>{a.designation}</td>
                              <td>{a.brand || ''}</td>
                              <td>{a.model || ''}</td>
                              <td>{a.family || ''}</td>
                              <td className="u-text-right" style={{ whiteSpace: 'nowrap' }}>
                                {(a.priceHt ?? a.price_ht) != null
                                  ? new Intl.NumberFormat('fr-FR', {
                                      style: 'currency',
                                      currency: 'EUR',
                                    }).format(a.priceHt ?? a.price_ht)
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      {pr.result.items.length > 20 && (
                        <p className="catalog-import-hint u-text-center u-mt-1">
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
            <Spinner size="lg" />
            <p>{parseProgress || `Import en cours (${totalItems} articles)…`}</p>
          </div>
        )}
      </div>
    </ModalLayout>
  );
}
