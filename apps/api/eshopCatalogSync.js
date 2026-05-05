import db from './database.js';
import logger from './logger.js';

const AUTO_IMPORT_FILENAME = 'auto-eshop-sync.json';
const AUTO_IMPORT_NOTES = 'Synchronisation automatique des references e-shop';

let syncTimer = null;

function ensureAutoImportForSupplier(supplierId) {
  const existing = db
    .prepare('SELECT id FROM catalog_imports WHERE supplier_id = ? AND filename = ?')
    .get(supplierId, AUTO_IMPORT_FILENAME);
  if (existing?.id) return existing.id;

  const result = db
    .prepare(
      `INSERT INTO catalog_imports
        (supplier_id, filename, file_size, page_count, items_count, status, notes, imported_by)
       VALUES (?, ?, 0, 0, 0, 'completed', ?, NULL)`,
    )
    .run(supplierId, AUTO_IMPORT_FILENAME, AUTO_IMPORT_NOTES);

  return Number(result.lastInsertRowid);
}

export function syncEshopToSupplierCatalog() {
  const rows = db
    .prepare(
      `SELECT
         eps.id AS eps_id,
         eps.product_id,
         eps.supplier_id,
         eps.supplier_name,
         eps.supplier_ref,
         eps.price_ht,
         eps.external_url,
         eps.notes,
         ep.name AS product_name,
         ep.description AS product_description,
         ep.category AS product_category
       FROM external_product_suppliers eps
       JOIN external_products ep ON ep.id = eps.product_id
       WHERE eps.supplier_id IS NOT NULL`,
    )
    .all();

  const touchedImports = new Set();
  let inserted = 0;
  let updated = 0;

  const selectExistingStmt = db.prepare(
    'SELECT id FROM supplier_articles WHERE supplier_id = ? AND supplier_ref = ?',
  );
  const insertStmt = db.prepare(
    `INSERT INTO supplier_articles
      (supplier_id, supplier_ref, brand, model, designation, description, family, category, price_ht,
       currency, unit, import_id, external_url, metadata)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'EUR', 'u', ?, ?, ?)`,
  );
  const updateStmt = db.prepare(
    `UPDATE supplier_articles
     SET designation = ?,
         description = ?,
         family = ?,
         category = ?,
         price_ht = ?,
         import_id = ?,
         external_url = ?,
         metadata = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  );
  const refreshImportCountStmt = db.prepare(
    'UPDATE catalog_imports SET items_count = (SELECT COUNT(*) FROM supplier_articles WHERE import_id = ?) WHERE id = ?',
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const supplierId = Number(row.supplier_id);
      if (!supplierId) continue;

      const importId = ensureAutoImportForSupplier(supplierId);
      touchedImports.add(importId);

      // Reference technique stable par entree e-shop pour un upsert deterministe.
      const articleRef = `ESHOP-EPS-${row.eps_id}`;
      const existing = selectExistingStmt.get(supplierId, articleRef);

      const designation = (
        row.product_name ||
        row.supplier_name ||
        `Produit e-shop ${row.product_id}`
      )
        .toString()
        .trim();
      const description = row.product_description || row.notes || null;
      const family = 'E-shop';
      const category = row.product_category || 'E-shop';
      const priceHt = row.price_ht != null ? Number(row.price_ht) : null;
      const externalUrl = row.external_url || null;
      const metadata = JSON.stringify({
        source: 'eshop-auto-sync',
        epsId: row.eps_id,
        productId: row.product_id,
        syncedAt: new Date().toISOString(),
      });

      if (existing?.id) {
        updateStmt.run(
          designation,
          description,
          family,
          category,
          priceHt,
          importId,
          externalUrl,
          metadata,
          existing.id,
        );
        updated += 1;
      } else {
        insertStmt.run(
          supplierId,
          articleRef,
          row.supplier_name || null,
          designation,
          description,
          family,
          category,
          priceHt,
          importId,
          externalUrl,
          metadata,
        );
        inserted += 1;
      }
    }

    for (const importId of touchedImports) {
      refreshImportCountStmt.run(importId, importId);
    }
  });

  tx();

  const result = {
    scanned: rows.length,
    inserted,
    updated,
    touchedImports: touchedImports.size,
  };

  logger.info(
    `🔁 Sync e-shop -> catalogue: ${result.scanned} liens, +${result.inserted} insert, ${result.updated} update`,
  );

  return result;
}

export function startEshopCatalogAutoSync(options = {}) {
  const {
    intervalMs = Number(process.env.ESHOP_CATALOG_SYNC_INTERVAL_MS || 10 * 60 * 1000),
    runOnStart = true,
  } = options;

  if (syncTimer) return syncTimer;

  if (runOnStart) {
    try {
      syncEshopToSupplierCatalog();
    } catch (error) {
      logger.warn(`⚠️ Sync e-shop initiale echouee: ${error.message}`);
    }
  }

  syncTimer = setInterval(
    () => {
      try {
        syncEshopToSupplierCatalog();
      } catch (error) {
        logger.warn(`⚠️ Sync e-shop periodique echouee: ${error.message}`);
      }
    },
    Math.max(30000, Number(intervalMs) || 600000),
  );

  // N'empeche pas l'arret propre du process.
  if (typeof syncTimer.unref === 'function') syncTimer.unref();

  logger.info(
    `⏱️ Tache auto e-shop -> catalogue activee (${Math.round(Math.max(30000, Number(intervalMs) || 600000) / 1000)}s)`,
  );

  return syncTimer;
}

export function stopEshopCatalogAutoSync() {
  if (!syncTimer) return;
  clearInterval(syncTimer);
  syncTimer = null;
}
