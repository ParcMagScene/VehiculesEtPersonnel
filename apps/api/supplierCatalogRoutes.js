// ============================================================
// MODULE ARTICLES FOURNISSEURS — eM@g
// Routes REST : supplier_articles, catalog_imports
// Import PDF catalogues fournisseurs
// ============================================================

import db, { addToHistory } from './database.js';
import logger from './logger.js';
import { normalizeBrand, enrichArticle, linkBrandIds, applyUnifiedFamilyBatch, invalidateBrandCache, listBrandsWithStats } from './brandHelpers.js';
import { supplierImportSchema, validate } from './schemas/imports.js';

// ============ ARTICLES FOURNISSEURS ============

export function setupSupplierCatalogRoutes(app, authenticateToken, requireWriteAccess) {

  // GET /api/supplier-articles — Liste avec filtres + pagination
  app.get('/api/supplier-articles', authenticateToken, (req, res) => {
    try {
      const { supplier_id, brand, family, subfamily, category, search, import_id, limit, offset } = req.query;
      let query = `SELECT sa.*, s.name as supplier_name,
          b.name as brand_canonical, b.slug as brand_slug
        FROM supplier_articles sa
        LEFT JOIN suppliers s ON sa.supplier_id = s.id
        LEFT JOIN brands b ON sa.brand_id = b.id
        WHERE 1=1`;
      const params = [];

      if (supplier_id) { query += ' AND sa.supplier_id = ?'; params.push(supplier_id); }
      if (brand) {
        // Supporte brand_id (numérique) ou nom texte
        if (/^\d+$/.test(brand)) {
          query += ' AND sa.brand_id = ?'; params.push(parseInt(brand));
        } else {
          query += ' AND (sa.brand = ? OR b.name = ?)'; params.push(brand, brand);
        }
      }
      if (family) { query += ' AND sa.family = ?'; params.push(family); }
      if (subfamily) { query += ' AND sa.subfamily = ?'; params.push(subfamily); }
      if (category) { query += ' AND sa.category = ?'; params.push(category); }
      if (import_id) { query += ' AND sa.import_id = ?'; params.push(import_id); }
      if (search) {
        query += ' AND (sa.designation LIKE ? OR sa.supplier_ref LIKE ? OR sa.brand LIKE ? OR sa.model LIKE ? OR s.name LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }

      // Count total
      const countQuery = query.replace(/SELECT sa\.\*, s\.name as supplier_name/, 'SELECT COUNT(*) as total');
      const { total } = db.prepare(countQuery).get(...params);

      query += ' ORDER BY sa.supplier_id, sa.family NULLS LAST, sa.brand NULLS LAST, sa.designation';

      const lim = Math.min(parseInt(limit) || 50, 200);
      const off = parseInt(offset) || 0;
      query += ' LIMIT ? OFFSET ?';
      params.push(lim, off);

      const articles = db.prepare(query).all(...params);
      res.json({ articles, total, limit: lim, offset: off });
    } catch (error) {
      logger.error('Erreur GET supplier-articles:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/supplier-articles/filters — Valeurs distinctes pour filtres
  app.get('/api/supplier-articles/filters', authenticateToken, (req, res) => {
    try {
      const { supplier_id } = req.query;
      const cond = supplier_id ? ' WHERE supplier_id = ?' : '';
      const and = supplier_id ? ' AND' : ' WHERE';
      const params = supplier_id ? [supplier_id] : [];

      const suppliers = db.prepare(`
        SELECT DISTINCT s.id, s.name FROM supplier_articles sa
        JOIN suppliers s ON sa.supplier_id = s.id
        ORDER BY s.name
      `).all();
      const brands = db.prepare(`
        SELECT DISTINCT COALESCE(b.name, sa.brand) as brand, sa.brand_id
        FROM supplier_articles sa
        LEFT JOIN brands b ON sa.brand_id = b.id
        ${cond ? 'WHERE sa.supplier_id = ?' : 'WHERE 1=1'}
        AND sa.brand IS NOT NULL
        ORDER BY brand
      `).all(...params).map(r => ({ name: r.brand, id: r.brand_id }));
      const families = db.prepare(`SELECT DISTINCT family FROM supplier_articles${cond}${and} family IS NOT NULL ORDER BY family`)
        .all(...params).map(r => r.family);
      const categories = db.prepare(`SELECT DISTINCT category FROM supplier_articles${cond}${and} category IS NOT NULL ORDER BY category`)
        .all(...params).map(r => r.category);

      res.json({ suppliers, brands, families, categories });
    } catch (error) {
      logger.error('Erreur GET supplier-articles/filters:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/supplier-articles/stats — Stats globales
  app.get('/api/supplier-articles/stats', authenticateToken, (req, res) => {
    try {
      const totalArticles = db.prepare('SELECT COUNT(*) as c FROM supplier_articles').get().c;
      const totalImports = db.prepare('SELECT COUNT(*) as c FROM catalog_imports').get().c;
      const bySupplier = db.prepare(`
        SELECT s.name, COUNT(sa.id) as count
        FROM supplier_articles sa
        JOIN suppliers s ON sa.supplier_id = s.id
        GROUP BY sa.supplier_id ORDER BY count DESC
      `).all();
      const byBrand = db.prepare(`
        SELECT COALESCE(b.name, sa.brand) as brand, sa.brand_id, COUNT(*) as count
        FROM supplier_articles sa
        LEFT JOIN brands b ON sa.brand_id = b.id
        WHERE sa.brand IS NOT NULL
        GROUP BY COALESCE(b.name, sa.brand) ORDER BY count DESC LIMIT 20
      `).all();
      res.json({ totalArticles, totalImports, bySupplier, byBrand });
    } catch (error) {
      logger.error('Erreur GET supplier-articles/stats:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/supplier-articles/refresh-brands — Détection auto des marques dans les désignations
  // + conversion codes Algam → vrais noms de marques + liaison brand_id via brands table
  // NOTE: doit être AVANT /:id sinon Express capture "refresh-brands" comme un id
  app.post('/api/supplier-articles/refresh-brands', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      // ── Mapping codes internes Algam → noms réels ──
      const ALGAM_BRAND_MAP = {
        SAH: 'Allen & Heath', SMA: 'Mackie', SMK: 'Mackie',
        SQS: 'QSC', SQC: 'QSC',
        SSP: 'Shure', SSR: 'Shure', SSX: 'Shure', SSI: 'Shure', SSE: 'Shure',
        SHK: 'Sennheiser', SHL: 'HK Audio', SHP: 'L-Acoustics',
        SRA: 'Radial', SDE: 'Denon', SDA: 'Audinate', SFC: 'SoundTube',
        SLT: 'Alto', SSL: 'SSL',
        IPA: 'Panasonic', IPB: 'Panasonic',
        IBM: 'Blackmagic', IDK: 'IDK', IBA: 'Barco',
        IMU: 'MuxLab', IAV: 'AVer', ING: 'Extron',
        LCL: 'Clay Paky', LSU: 'Luminex', LMA: 'Luminex', LMP: 'Luminex',
        LUN: 'Unilumin', LMR: 'Martin', LSF: 'Look Solutions',
        RFC: 'Focal', RFR: 'Focusrite', RFO: 'Focusrite',
        RSL: 'SSL', RHA: 'Heritage Audio', RAZ: 'Audeze',
        SAU: 'Ecler', SPG: 'Apart', SPT: 'SoundTube',
        IPC: 'Projecta', ISK: 'SKB',
        LAV: 'Avolites', LAL: 'Algam Lighting',
        HGF: 'Gator',
        TCH: 'Chief', TKM: 'K&M', TEU: 'EuroMet', TQA: 'Quiklok',
        EAU: 'IsoAcoustics', ECL: 'Procab', ENE: 'Neutrik', EPC: 'APG',
        SAF: 'Fohhn',
      };
      const algamCodeRx = /^[A-Z]{2,3}$/;

      // ── Construire la regex dynamique depuis la table brands + aliases ──
      const allBrandNames = [];
      try {
        db.prepare('SELECT name FROM brands WHERE is_active = 1').all().forEach(b => allBrandNames.push(b.name));
        db.prepare('SELECT alias FROM brand_aliases').all().forEach(a => allBrandNames.push(a.alias));
      } catch { /* brands table may not exist yet */ }
      // Sort longest first to avoid partial matches
      allBrandNames.sort((a, b) => b.length - a.length);
      const brandRx = allBrandNames.length > 0
        ? new RegExp('\\b(' + allBrandNames.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i')
        : null;

      const articles = db.prepare('SELECT id, brand, designation FROM supplier_articles').all();
      const updateStmt = db.prepare('UPDATE supplier_articles SET brand = ?, brand_id = ? WHERE id = ?');
      let brandDetected = 0;

      const run = db.transaction(() => {
        for (const art of articles) {
          const currentBrand = art.brand?.trim() || null;

          // 1) Code Algam → nom réel
          if (currentBrand && algamCodeRx.test(currentBrand) && ALGAM_BRAND_MAP[currentBrand]) {
            const resolved = normalizeBrand(ALGAM_BRAND_MAP[currentBrand]);
            updateStmt.run(resolved.brand, resolved.brand_id, art.id);
            brandDetected++;
            continue;
          }

          // 2) Marque existante → normaliser casse + lier brand_id
          if (currentBrand && !algamCodeRx.test(currentBrand)) {
            const resolved = normalizeBrand(currentBrand);
            if (resolved.brand_id && resolved.brand !== currentBrand) {
              updateStmt.run(resolved.brand, resolved.brand_id, art.id);
              brandDetected++;
            } else if (resolved.brand_id) {
              // Just link brand_id if brand text already correct
              db.prepare('UPDATE supplier_articles SET brand_id = ? WHERE id = ? AND brand_id IS NULL')
                .run(resolved.brand_id, art.id);
            }
            continue;
          }

          // 3) Pas de marque → détecter code Algam dans la désignation
          if (!currentBrand) {
            const codeMatch = art.designation?.match(/(?:^\d+\s+)?([A-Z]{2,3})\s/);
            if (codeMatch && ALGAM_BRAND_MAP[codeMatch[1]]) {
              const resolved = normalizeBrand(ALGAM_BRAND_MAP[codeMatch[1]]);
              updateStmt.run(resolved.brand, resolved.brand_id, art.id);
              brandDetected++;
              continue;
            }
            // 4) Détecter un nom de marque connu dans la désignation
            if (brandRx) {
              const match = art.designation?.match(brandRx);
              if (match) {
                const resolved = normalizeBrand(match[1]);
                updateStmt.run(resolved.brand, resolved.brand_id, art.id);
                brandDetected++;
              }
            }
          }
        }
      });
      run();

      // Also apply unified_family on newly detected brands
      const { mapped } = applyUnifiedFamilyBatch();

      invalidateBrandCache();
      logger.info(`🏷️ Refresh marques: ${brandDetected}/${articles.length} articles mis à jour, ${mapped} unified_family mappés`);
      res.json({ success: true, scanned: articles.length, brandDetected, familyMapped: mapped });
    } catch (error) {
      logger.error('Erreur POST refresh-brands:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/supplier-articles/taxonomy — Analyse des familles/catégories existantes
  // NOTE: doit être AVANT /:id sinon Express capture "taxonomy" comme un id
  app.get('/api/supplier-articles/taxonomy', authenticateToken, (req, res) => {
    try {
      const families = db.prepare(`
        SELECT family as name, COUNT(*) as count,
          GROUP_CONCAT(DISTINCT s.name) as suppliers
        FROM supplier_articles sa
        LEFT JOIN suppliers s ON sa.supplier_id = s.id
        WHERE family IS NOT NULL AND family != ''
        GROUP BY family ORDER BY count DESC
      `).all();

      const categories = db.prepare(`
        SELECT category as name, COUNT(*) as count,
          GROUP_CONCAT(DISTINCT s.name) as suppliers
        FROM supplier_articles sa
        LEFT JOIN suppliers s ON sa.supplier_id = s.id
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category ORDER BY count DESC
      `).all();

      const familyGroups = suggestGroups(families);
      const categoryGroups = suggestGroups(categories);

      res.json({
        families,
        categories,
        suggestions: { familyGroups, categoryGroups },
        totalArticles: db.prepare('SELECT COUNT(*) as c FROM supplier_articles').get().c,
        withFamily: db.prepare('SELECT COUNT(*) as c FROM supplier_articles WHERE family IS NOT NULL AND family != \'\'').get().c,
        withCategory: db.prepare('SELECT COUNT(*) as c FROM supplier_articles WHERE category IS NOT NULL AND category != \'\'').get().c,
      });
    } catch (error) {
      logger.error('Erreur GET supplier-articles/taxonomy:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/supplier-articles/:id
  app.get('/api/supplier-articles/:id', authenticateToken, (req, res) => {
    try {
      const article = db.prepare(`
        SELECT sa.*, s.name as supplier_name
        FROM supplier_articles sa
        LEFT JOIN suppliers s ON sa.supplier_id = s.id
        WHERE sa.id = ?
      `).get(req.params.id);
      if (!article) return res.status(404).json({ error: 'Article non trouvé' });
      res.json(article);
    } catch (error) {
      logger.error('Erreur GET supplier-articles/:id:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/supplier-articles/import — Import bulk depuis parsing PDF frontend
  // [AUDIT FIX I1] Validation Zod mandatory
  app.post('/api/supplier-articles/import', authenticateToken, requireWriteAccess, validate(supplierImportSchema), (req, res) => {
    try {
      const { supplier_id, filename, file_size, page_count, articles } = req.body;

      // Créer l'entrée d'import
      const importResult = db.prepare(`
        INSERT INTO catalog_imports (supplier_id, filename, file_size, page_count, items_count, imported_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(supplier_id, filename, file_size || 0, page_count || 0, articles.length, req.user.id);
      const importId = importResult.lastInsertRowid;

      // Insert articles en transaction
      const insertStmt = db.prepare(`
        INSERT INTO supplier_articles (supplier_id, supplier_ref, brand, brand_id, model, designation, description, family, subfamily, category, price_ht, currency, weight, dimensions, unit, metadata, import_id, unified_family)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const upsertStmt = db.prepare(`
        UPDATE supplier_articles SET
          brand = ?, brand_id = ?, model = ?, designation = ?, description = ?, family = ?, subfamily = ?,
          category = ?, price_ht = ?, currency = ?, weight = ?, dimensions = ?, unit = ?,
          metadata = ?, import_id = ?, unified_family = COALESCE(?, unified_family), updated_at = CURRENT_TIMESTAMP
        WHERE supplier_id = ? AND supplier_ref = ?
      `);

      let inserted = 0, updated = 0, skipped = 0;

      // Helper: garantir que chaque valeur est bindable par SQLite (string|number|null)
      const s = (v) => (v == null || v === '') ? null : String(v);
      const n = (v) => (v == null || v === '') ? null : Number(v) || null;
      const j = (v) => {
        if (v == null) return null;
        if (typeof v === 'string') return v || null;
        return JSON.stringify(v);
      };

      const runImport = db.transaction(() => {
        for (const rawArt of articles) {
          if (!rawArt.designation) { skipped++; continue; }

          // Auto-enrichir : normaliser marque + résoudre unified_family
          const art = enrichArticle(rawArt);

          // Si supplier_ref existe, tenter un upsert
          if (art.supplier_ref) {
            const existing = db.prepare(
              'SELECT id FROM supplier_articles WHERE supplier_id = ? AND supplier_ref = ?'
            ).get(supplier_id, art.supplier_ref);

            if (existing) {
              upsertStmt.run(
                s(art.brand), art.brand_id || null, s(art.model), art.designation,
                s(art.description), s(art.family), s(art.subfamily),
                s(art.category), n(art.price_ht), s(art.currency) || 'EUR',
                s(art.weight), j(art.dimensions),
                s(art.unit) || 'u', j(art.metadata),
                importId, art.unified_family || null, supplier_id, art.supplier_ref
              );
              updated++;
              continue;
            }
          }

          insertStmt.run(
            supplier_id, s(art.supplier_ref), s(art.brand), art.brand_id || null,
            s(art.model), art.designation, s(art.description),
            s(art.family), s(art.subfamily), s(art.category),
            n(art.price_ht), s(art.currency) || 'EUR',
            s(art.weight), j(art.dimensions),
            s(art.unit) || 'u', j(art.metadata),
            importId, art.unified_family || null
          );
          inserted++;
        }
      });
      runImport();

      // Mettre à jour le count réel
      db.prepare('UPDATE catalog_imports SET items_count = ? WHERE id = ?')
        .run(inserted + updated, importId);

      addToHistory('supplier_articles', importId, 'import',
        { filename, supplier_id, inserted, updated, skipped }, req.user.id, req.user.name);

      logger.info(`📦 Import catalogue: ${filename} — ${inserted} insérés, ${updated} mis à jour, ${skipped} ignorés`);
      res.json({ importId, inserted, updated, skipped, total: articles.length });
    } catch (error) {
      logger.error('Erreur POST supplier-articles/import:', error);
      // [AUDIT FIX H1] Ne pas exposer error.message au client
      res.status(500).json({ error: 'Erreur lors de l\'import du catalogue' });
    }
  });

  // DELETE /api/supplier-articles — Purger TOUS les articles + imports
  app.delete('/api/supplier-articles', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const purge = db.transaction(() => {
        const artCount = db.prepare('DELETE FROM supplier_articles').run().changes;
        const impCount = db.prepare('DELETE FROM catalog_imports').run().changes;
        return { artCount, impCount };
      });
      const { artCount, impCount } = purge();

      addToHistory('supplier_articles', 0, 'purge',
        { deleted_articles: artCount, deleted_imports: impCount }, req.user.id, req.user.name);

      logger.info(`🗑️ Purge catalogue fournisseurs: ${artCount} articles, ${impCount} imports supprimés`);
      res.json({ success: true, deletedArticles: artCount, deletedImports: impCount });
    } catch (error) {
      logger.error('Erreur DELETE supplier-articles (purge):', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/supplier-articles/:id
  app.delete('/api/supplier-articles/:id', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const result = db.prepare('DELETE FROM supplier_articles WHERE id = ?').run(req.params.id);
      if (result.changes === 0) return res.status(404).json({ error: 'Article non trouvé' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Erreur DELETE supplier-articles:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/catalog-imports/:id — Supprimer un import et ses articles
  app.delete('/api/catalog-imports/:id', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const imp = db.prepare('SELECT * FROM catalog_imports WHERE id = ?').get(req.params.id);
      if (!imp) return res.status(404).json({ error: 'Import non trouvé' });

      const deleteAll = db.transaction(() => {
        const del = db.prepare('DELETE FROM supplier_articles WHERE import_id = ?').run(req.params.id);
        db.prepare('DELETE FROM catalog_imports WHERE id = ?').run(req.params.id);
        return del.changes;
      });
      const deletedCount = deleteAll();

      logger.info(`🗑️ Import ${imp.filename} supprimé (${deletedCount} articles)`);
      res.json({ success: true, deletedArticles: deletedCount });
    } catch (error) {
      logger.error('Erreur DELETE catalog-imports:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/catalog-imports — Historique des imports
  app.get('/api/catalog-imports', authenticateToken, (req, res) => {
    try {
      const { supplier_id } = req.query;
      let query = `SELECT ci.*, s.name as supplier_name, u.username as imported_by_name
        FROM catalog_imports ci
        LEFT JOIN suppliers s ON ci.supplier_id = s.id
        LEFT JOIN users u ON ci.imported_by = u.id`;
      const params = [];
      if (supplier_id) { query += ' WHERE ci.supplier_id = ?'; params.push(supplier_id); }
      query += ' ORDER BY ci.created_at DESC';
      const imports = db.prepare(query).all(...params);
      res.json(imports);
    } catch (error) {
      logger.error('Erreur GET catalog-imports:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ============ APPRENTISSAGE PARSERS ============

  // POST /api/supplier-articles/analyze — Analyse un résultat de parsing (sans import)
  // Le frontend envoie les articles parsés + le texte brut pour analyse
  app.post('/api/supplier-articles/analyze', authenticateToken, (req, res) => {
    try {
      const { items, totalLines, parserId, text } = req.body;
      if (!items || !totalLines) {
        return res.status(400).json({ error: 'items et totalLines requis' });
      }

      const lines = (text || '').split('\n').filter(l => l.trim());

      // ── Métriques de base ──
      const parseRate = totalLines > 0 ? (items.length / totalLines * 100) : 0;
      const withRef = items.filter(a => a.supplier_ref).length;
      const withPrice = items.filter(a => a.price_ht != null).length;
      const withDesignation = items.filter(a => a.designation && a.designation.length > 2).length;
      const withFamily = items.filter(a => a.family).length;
      const withBrand = items.filter(a => a.brand).length;

      // ── Détection de faux positifs ──
      const falsePositives = [];

      for (const art of items) {
        const issues = [];

        // Désignation trop courte (< 3 chars) ou trop longue (> 200 chars)
        if (art.designation && (art.designation.length < 3 || art.designation.length > 200)) {
          issues.push('designation_length');
        }

        // Réf qui ressemble à un numéro de page ou une dimension
        if (art.supplier_ref && /^\d{1,3}$/.test(art.supplier_ref)) {
          issues.push('ref_looks_like_page_number');
        }

        // Prix aberrant (< 0.01€ ou > 100 000€)
        if (art.price_ht != null && (art.price_ht < 0.01 || art.price_ht > 100000)) {
          issues.push('price_aberrant');
        }

        // Désignation = en-tête ou texte parasite
        if (art.designation && /^(page|total|sous-total|catalogue|tarif|conditions|contact|www\.|http)/i.test(art.designation)) {
          issues.push('designation_is_header');
        }

        // Doublons de réf
        const dupes = items.filter(b => b.supplier_ref && b.supplier_ref === art.supplier_ref);
        if (dupes.length > 1) {
          issues.push('duplicate_ref');
        }

        if (issues.length > 0) {
          falsePositives.push({
            supplier_ref: art.supplier_ref,
            designation: art.designation?.substring(0, 80),
            price_ht: art.price_ht,
            issues,
          });
        }
      }

      // ── Échantillon de lignes ignorées ──
      const parsedRefs = new Set(items.map(a => a.supplier_ref).filter(Boolean));
      const skippedSample = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 5) continue;
        // Vérifie si cette ligne contient un prix mais n'a pas été parsée
        if (/\d+[,.]?\d*\s*€/.test(trimmed)) {
          const refMatch = trimmed.match(/^([\w\-\/.]{2,30})/);
          if (refMatch && !parsedRefs.has(refMatch[1])) {
            skippedSample.push(trimmed.substring(0, 120));
            if (skippedSample.length >= 20) break;
          }
        }
      }

      // ── Familles et catégories détectées ──
      const familyCounts = {};
      const categoryCounts = {};
      for (const art of items) {
        if (art.family) familyCounts[art.family] = (familyCounts[art.family] || 0) + 1;
        if (art.category) categoryCounts[art.category] = (categoryCounts[art.category] || 0) + 1;
      }

      const uniqueFP = [];
      const seenFP = new Set();
      for (const fp of falsePositives) {
        const k = fp.supplier_ref || fp.designation;
        if (!seenFP.has(k)) { seenFP.add(k); uniqueFP.push(fp); }
      }

      res.json({
        metrics: {
          totalLines,
          parsedCount: items.length,
          parseRate: Math.round(parseRate * 100) / 100,
          withRef,
          withPrice,
          withDesignation,
          withFamily,
          withBrand,
          refRate: items.length > 0 ? Math.round(withRef / items.length * 100) : 0,
          priceRate: items.length > 0 ? Math.round(withPrice / items.length * 100) : 0,
        },
        falsePositives: uniqueFP.slice(0, 30),
        falsePositiveCount: uniqueFP.length,
        skippedWithPrice: skippedSample,
        families: Object.entries(familyCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
        categories: Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      });
    } catch (error) {
      logger.error('Erreur POST supplier-articles/analyze:', error);
      // [AUDIT FIX H1] Ne pas exposer error.message au client
      res.status(500).json({ error: 'Erreur lors de l\'analyse du catalogue' });
    }
  });

  // ============ NORMALISATION FAMILLES & CATÉGORIES ============

  // POST /api/supplier-articles/taxonomy/apply — Appliquer une normalisation
  app.post('/api/supplier-articles/taxonomy/apply', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const { rules } = req.body;
      // rules = [{ type: 'family'|'category', from: 'old value', to: 'new value' }, ...]
      if (!rules?.length) {
        return res.status(400).json({ error: 'rules requis (tableau de { type, from, to })' });
      }

      let totalChanged = 0;

      const applyRules = db.transaction(() => {
        for (const rule of rules) {
          if (!rule.from || !rule.to || !['family', 'category'].includes(rule.type)) continue;
          const col = rule.type; // 'family' or 'category' — safe, validated above
          const result = db.prepare(
            `UPDATE supplier_articles SET ${col} = ?, updated_at = CURRENT_TIMESTAMP WHERE ${col} = ?`
          ).run(rule.to, rule.from);
          totalChanged += result.changes;
        }
      });
      applyRules();

      addToHistory('supplier_articles', 0, 'taxonomy_normalize',
        { rules: rules.length, totalChanged }, req.user?.id, req.user?.name);

      logger.info(`📋 Normalisation taxonomie: ${rules.length} règles, ${totalChanged} articles modifiés`);
      res.json({ success: true, totalChanged, rulesApplied: rules.length });
    } catch (error) {
      logger.error('Erreur POST taxonomy/apply:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ============ BRANDS API ============

  // GET /api/brands — Liste des marques avec stats
  app.get('/api/brands', authenticateToken, (req, res) => {
    try {
      const brands = listBrandsWithStats();
      res.json(brands);
    } catch (error) {
      logger.error('Erreur GET brands:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/brands/resolve — Résoudre une marque texte → brand_id + nom canonique
  // NOTE: doit être AVANT /api/brands/:id sinon Express capture "resolve" comme un id
  app.post('/api/brands/resolve', authenticateToken, (req, res) => {
    try {
      const { brand: brandText } = req.body;
      const result = normalizeBrand(brandText);
      res.json(result);
    } catch (error) {
      logger.error('Erreur POST brands/resolve:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/brands/:id — Détail d'une marque + aliases + famille
  app.get('/api/brands/:id', authenticateToken, (req, res) => {
    try {
      const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
      if (!brand) return res.status(404).json({ error: 'Marque non trouvée' });

      brand.aliases = db.prepare('SELECT * FROM brand_aliases WHERE brand_id = ?').all(req.params.id);
      brand.families = db.prepare(`
        SELECT bfm.*, ec.name as family_name, ec.icon, ec.color
        FROM brand_family_mapping bfm
        JOIN equipment_categories ec ON bfm.family_id = ec.id
        WHERE bfm.brand_id = ?
      `).all(req.params.id);

      res.json(brand);
    } catch (error) {
      logger.error('Erreur GET brands/:id:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/brands/:id/aliases — Ajouter un alias à une marque
  app.post('/api/brands/:id/aliases', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const { alias } = req.body;
      if (!alias?.trim()) return res.status(400).json({ error: 'alias requis' });

      const brand = db.prepare('SELECT id FROM brands WHERE id = ?').get(req.params.id);
      if (!brand) return res.status(404).json({ error: 'Marque non trouvée' });

      const slug = alias.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existing = db.prepare('SELECT id FROM brand_aliases WHERE alias_slug = ?').get(slug);
      if (existing) return res.status(409).json({ error: 'Alias déjà existant' });

      db.prepare('INSERT INTO brand_aliases (brand_id, alias, alias_slug, source) VALUES (?, ?, ?, ?)')
        .run(req.params.id, alias.trim(), slug, 'manual');

      invalidateBrandCache();
      res.json({ success: true });
    } catch (error) {
      logger.error('Erreur POST brands/:id/aliases:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/supplier-articles/link-brand-ids — Lier brand_id en batch
  app.post('/api/supplier-articles/link-brand-ids', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const sa = linkBrandIds('supplier_articles');
      const eq = linkBrandIds('equipment');
      logger.info(`🔗 Link brand_ids: ${sa.linked} articles, ${eq.linked} equipment liés`);
      res.json({ success: true, supplier_articles: sa, equipment: eq });
    } catch (error) {
      logger.error('Erreur POST link-brand-ids:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/supplier-articles/apply-unified-family — Appliquer unified_family en batch
  app.post('/api/supplier-articles/apply-unified-family', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const result = applyUnifiedFamilyBatch();
      logger.info(`📋 Apply unified_family: ${result.mapped}/${result.total} articles mappés`);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Erreur POST apply-unified-family:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
}

// ── Helper: suggestions de regroupement ──
function suggestGroups(items) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const base = items[i];
    const normalized = normalizeForComparison(base.name);
    const group = { canonical: base.name, members: [base], totalCount: base.count };

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const other = items[j];
      const otherNorm = normalizeForComparison(other.name);

      if (areSimilar(normalized, otherNorm)) {
        group.members.push(other);
        group.totalCount += other.count;
        used.add(j);
      }
    }

    if (group.members.length > 1) {
      // Le canonical est le membre avec le plus d'articles
      group.canonical = group.members.sort((a, b) => b.count - a.count)[0].name;
      groups.push(group);
    }
    used.add(i);
  }

  return groups.sort((a, b) => b.members.length - a.members.length);
}

function normalizeForComparison(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areSimilar(a, b) {
  if (a === b) return true;
  // Un contient l'autre
  if (a.includes(b) || b.includes(a)) return true;
  // Distance de Levenshtein normalisée < 0.3
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;
  const dist = levenshtein(a, b);
  if (dist / maxLen < 0.3) return true;
  // Même mots (ordre différent)
  const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 2));
  if (wordsA.size > 0 && wordsB.size > 0) {
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    if (intersection / union > 0.6) return true;
  }
  return false;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
