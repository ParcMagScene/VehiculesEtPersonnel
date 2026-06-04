// ═══════════════════════════════════════════════════════════════
// perfIndexesL10.js — Index de performance — L10 (8.1)
//
// Index composites complémentaires identifiés par audit des requêtes
// récurrentes des modules ajoutés/touchés lors des lots L6-L9 :
//   • affaire_history → endpoint /import-history (WHERE affaire_id ORDER BY created_at DESC)
//   • order_items → import-preview L8 (chargement par order_id + matching désignation)
//   • task_assignments → planning (filtres person_id + date)
//   • sav_tickets → écran SAV (filtres equipment_id + status)
//   • bp_items → groupements par BL et type
//   • supplier_articles → /suggest avec filtre supplier_id
//   • tracking_sheets → suivi (filtres date + status)
//
// Tous les index sont :
//   - idempotents (IF NOT EXISTS)
//   - composites (couvrent les requêtes WHERE+ORDER BY courantes)
//   - tolérants à l'absence de table/colonne (try/catch silencieux)
// ═══════════════════════════════════════════════════════════════

export const PERF_L10_INDEXES = [
  // L6 : historique d'affaire — endpoint /import-history
  // WHERE affaire_id = ? ORDER BY created_at DESC, id DESC LIMIT 200
  'CREATE INDEX IF NOT EXISTS idx_ah_affaire_created ON affaire_history(affaire_id, created_at DESC, id DESC)',

  // L8 : import PDF fournisseur — diff/MAJ
  // SELECT ... FROM order_items WHERE order_id = ? puis match par désignation
  'CREATE INDEX IF NOT EXISTS idx_order_items_order_designation ON order_items(order_id, designation)',

  // Planning personnel — task_assignments par personne sur plage de dates
  'CREATE INDEX IF NOT EXISTS idx_ta_person_date ON task_assignments(person_id, date)',

  // SAV — tickets actifs d'un équipement
  'CREATE INDEX IF NOT EXISTS idx_sav_equipment_status ON sav_tickets(equipment_id, status)',

  // BP items — groupements par BL et par type d'item
  'CREATE INDEX IF NOT EXISTS idx_bp_items_bl_type ON bp_items(bl_import_id, item_type)',

  // Catalogue fournisseurs — /suggest filtré par supplier_id
  'CREATE INDEX IF NOT EXISTS idx_supplier_articles_supplier_designation ON supplier_articles(supplier_id, designation)',

  // Suivi personnel — feuilles par date + statut
  'CREATE INDEX IF NOT EXISTS idx_tracking_sheets_date_status ON tracking_sheets(date, status)',

  // ─── L11 (tasks perf, mai 2026) ─────────────────────────────
  // Audit EXPLAIN QUERY PLAN sur task_assignments a montré que
  // idx_ta_deleted_at (créé jadis manuellement en prod) était nocif :
  // SQLite le préférait pour `WHERE affaire_num=? AND deleted_at IS NULL`
  // et `WHERE date<? AND ... AND deleted_at IS NULL`, ce qui revenait à
  // un quasi full-scan (la quasi-totalité des lignes ont deleted_at NULL).
  //
  // Solution : 2 indexes partiels ciblés `WHERE deleted_at IS NULL` qui
  // remplacent avantageusement l'index plein. (Le DROP de l'index nocif
  // est appliqué séparément par PERF_L10_DROPS — voir plus bas.)
  'CREATE INDEX IF NOT EXISTS idx_ta_affaire_active ON task_assignments(affaire_num) WHERE affaire_num IS NOT NULL AND deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_ta_date_status_active ON task_assignments(date, status) WHERE deleted_at IS NULL',
];

/**
 * Indexes obsolètes / contre-productifs à supprimer.
 * Idempotent (DROP IF EXISTS).
 */
export const PERF_L10_DROPS = [
  // Anti-pattern : `WHERE deleted_at IS NULL` n'est pas sélectif (presque
  // toutes les lignes match) ; SQLite choisissait quand même cet index
  // au lieu d'un index plus sélectif. Les nouveaux indexes partiels le
  // remplacent et incluent déjà la condition `deleted_at IS NULL`.
  'DROP INDEX IF EXISTS idx_ta_deleted_at',
];

/**
 * Applique les index de performance L10 sur la base donnée.
 * Tolérant : ignore les erreurs (table/colonne absente, index déjà créé).
 *
 * @param {object} db — Instance better-sqlite3
 * @returns {{ attempted: number, succeeded: number, failed: number, errors: string[] }}
 */
export function applyPerfL10Indexes(db) {
  if (!db || typeof db.exec !== 'function') {
    throw new TypeError('applyPerfL10Indexes: db invalide (méthode exec absente)');
  }
  const total = PERF_L10_INDEXES.length + PERF_L10_DROPS.length;
  const result = { attempted: total, succeeded: 0, failed: 0, errors: [] };
  for (const sql of [...PERF_L10_DROPS, ...PERF_L10_INDEXES]) {
    try {
      db.exec(sql);
      result.succeeded += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push(e.message);
    }
  }
  return result;
}
