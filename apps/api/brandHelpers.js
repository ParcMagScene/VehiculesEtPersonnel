// ═══════════════════════════════════════════════════════════════
// brandHelpers.js — Fonctions de normalisation des marques
// Lookup brand_id par nom/alias, résolution unified_family,
// normalisation automatique des valeurs entrantes
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';

// ── Cache interne (rechargé à la demande) ──
let _brandCache = null;   // Map<lowercase → { id, name }>
let _cacheTs = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Charger / recharger le cache brands + aliases
 * @returns {Map<string, {id: number, name: string}>}
 */
function getBrandCache() {
  const now = Date.now();
  if (_brandCache && (now - _cacheTs) < CACHE_TTL) return _brandCache;

  _brandCache = new Map();
  try {
    const brands = db.prepare('SELECT id, name FROM brands WHERE is_active = 1').all();
    for (const b of brands) {
      _brandCache.set(b.name.toLowerCase(), { id: b.id, name: b.name });
    }
    const aliases = db.prepare(`
      SELECT ba.alias, ba.brand_id, b.name
      FROM brand_aliases ba JOIN brands b ON ba.brand_id = b.id
      WHERE b.is_active = 1
    `).all();
    for (const a of aliases) {
      _brandCache.set(a.alias.toLowerCase(), { id: a.brand_id, name: a.name });
    }
    _cacheTs = now;
  } catch (e) {
    // Tables may not exist yet (pre-migration)
    logger.warn('brandHelpers: cache load failed:', e.message);
    _brandCache = new Map();
  }
  return _brandCache;
}

/**
 * Invalider le cache (après ajout d'une marque ou alias)
 */
export function invalidateBrandCache() {
  _brandCache = null;
  _cacheTs = 0;
}

/**
 * Résoudre une marque texte → { id, name } canonique
 * @param {string|null|undefined} brandText
 * @returns {{ id: number, name: string } | null}
 */
export function resolveBrand(brandText) {
  if (!brandText || typeof brandText !== 'string') return null;
  const key = brandText.trim().toLowerCase();
  if (!key) return null;
  return getBrandCache().get(key) || null;
}

/**
 * Normaliser et lier une marque texte → { brand_id, brand (canonique) }
 * Si la marque n'est pas trouvée, retourne le texte original sans brand_id
 * @param {string|null} brandText
 * @returns {{ brand: string|null, brand_id: number|null }}
 */
export function normalizeBrand(brandText) {
  if (!brandText) return { brand: null, brand_id: null };
  const resolved = resolveBrand(brandText);
  if (resolved) return { brand: resolved.name, brand_id: resolved.id };
  return { brand: brandText.trim(), brand_id: null };
}

/**
 * Appliquer le mapping unified_family sur un article
 * Utilise taxonomy_family_mapping (priorité décroissante)
 * @param {object} article - { family, subfamily, category, brand, designation }
 * @returns {string|null} unified_family name or null
 */
export function resolveUnifiedFamily(article) {
  try {
    const rules = db.prepare(`
      SELECT tfm.pattern, tfm.source_field, ec.name as family_name
      FROM taxonomy_family_mapping tfm
      JOIN equipment_categories ec ON tfm.family_id = ec.id
      ORDER BY tfm.priority DESC, tfm.id ASC
    `).all();

    // Build search string per source_field
    const fields = {
      brand: (article.brand || '').toLowerCase(),
      family: (article.family || '').toLowerCase(),
      subfamily: (article.subfamily || '').toLowerCase(),
      category: (article.category || '').toLowerCase(),
      designation: (article.designation || '').toLowerCase(),
    };
    // Composite: all fields concatenated for 'any' matching
    const composite = Object.values(fields).join(' ');

    for (const rule of rules) {
      try {
        const rx = new RegExp(rule.pattern, 'i');
        const target = rule.source_field === 'any' ? composite : (fields[rule.source_field] || composite);
        if (rx.test(target)) {
          return rule.family_name;
        }
      } catch { /* invalid regex, skip */ }
    }
  } catch (e) {
    // taxonomy_family_mapping may not exist yet
  }
  return null;
}

/**
 * Normaliser ET mapper un article complet (brand + unified_family)
 * Utilisé lors de l'import pour enrichir automatiquement
 * @param {object} article - objet article brut (from parsed PDF/CSV)
 * @returns {object} article enrichi avec brand normalisé + brand_id + unified_family
 */
export function enrichArticle(article) {
  const { brand, brand_id } = normalizeBrand(article.brand);
  const enriched = { ...article, brand, brand_id };
  // Resolve unified_family if not already set
  if (!enriched.unified_family) {
    enriched.unified_family = resolveUnifiedFamily(enriched);
  }
  return enriched;
}

/**
 * Lier brand_id en batch sur des articles sans brand_id mais avec brand texte
 * @param {string} table - 'equipment' | 'supplier_articles' | 'equipment_catalog'
 * @returns {{ linked: number, total: number }}
 */
export function linkBrandIds(table) {
  const allowed = ['equipment', 'supplier_articles', 'equipment_catalog'];
  if (!allowed.includes(table)) throw new Error(`Table non autorisée: ${table}`);

  const cache = getBrandCache();
  const rows = db.prepare(
    `SELECT id, brand FROM ${table} WHERE brand IS NOT NULL AND brand != '' AND brand_id IS NULL`
  ).all();
  const stmt = db.prepare(`UPDATE ${table} SET brand_id = ? WHERE id = ?`);
  let linked = 0;

  const run = db.transaction(() => {
    for (const row of rows) {
      const resolved = cache.get(row.brand.toLowerCase());
      if (resolved) {
        stmt.run(resolved.id, row.id);
        linked++;
      }
    }
  });
  run();

  return { linked, total: rows.length };
}

/**
 * Appliquer unified_family en batch sur les articles non mappés
 * @returns {{ mapped: number, total: number }}
 */
export function applyUnifiedFamilyBatch() {
  const articles = db.prepare(
    "SELECT id, family, subfamily, category, brand, designation FROM supplier_articles WHERE unified_family IS NULL"
  ).all();

  const stmt = db.prepare('UPDATE supplier_articles SET unified_family = ? WHERE id = ?');
  let mapped = 0;

  const run = db.transaction(() => {
    for (const art of articles) {
      const uf = resolveUnifiedFamily(art);
      if (uf) {
        stmt.run(uf, art.id);
        mapped++;
      }
    }
  });
  run();

  return { mapped, total: articles.length };
}

/**
 * Liste toutes les marques actives avec stats
 * @returns {Array<{id, name, slug, website, country, primary_domain, equipment_count, article_count}>}
 */
export function listBrandsWithStats() {
  return db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM equipment WHERE brand_id = b.id) as equipment_count,
      (SELECT COUNT(*) FROM supplier_articles WHERE brand_id = b.id) as article_count
    FROM brands b
    WHERE b.is_active = 1
    ORDER BY b.name
  `).all();
}
