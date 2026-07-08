// ═══════════════════════════════════════════════════════════════
// migrations/planning-v2-schema-v1.js
//
// Ticket : T-P0-02 (Planning v2 — DB v2)
//
// Migration ADDITIVE et IDEMPOTENTE. Ne modifie AUCUNE colonne
// existante, ne supprime rien, ne renomme rien. La v1 (planningRoutes.js)
// reste 100 % fonctionnelle après cette migration.
//
// Ajoute :
//   1. Table `task_sections_ref` (code TEXT PK, label, sort_order)
//      seedée avec les 16 sections métier (15 CHECK actuel + `manual`).
//      Devient la source de vérité DB alignée avec la constante
//      TASK_SECTIONS exposée par services/planning/tasks.js.
//
//   2. Index composites cursor-based sur `task_assignments` :
//        - idx_ta_v2_date_id            (date, id)
//        - idx_ta_v2_person_date_id     (person_id, date, id)
//        - idx_ta_v2_section_date_id    (section, date, id)
//      Prérequis de la pagination cursor-based v2 (T-P1-01) et des
//      routes v2 lecture (T-P0-03).
//
// Références :
//   - EXECUTION_PLAN_EMAG_3_0.md T-P0-02
//   - docs/05-Specs/PLANNING_V2.md §4
//   - apps/api/services/planning/tasks.js (constante TASK_SECTIONS)
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

/**
 * Sections métier canoniques Planning v2. Aligné avec `TASK_SECTIONS`
 * dans `apps/api/services/planning/tasks.js` et sur le CHECK actuel
 * côté v1 (task_assignments). L'ordre définit `sort_order` en base.
 *
 * @type {ReadonlyArray<{ code: string, label: string }>}
 */
const TASK_SECTIONS_SEED = Object.freeze([
  { code: 'rdv', label: 'RDV' },
  { code: 'prep_locations', label: 'Préparation locations' },
  { code: 'prep_prestations', label: 'Préparation prestations' },
  { code: 'prep_ventes', label: 'Préparation ventes' },
  { code: 'prep_installations', label: 'Préparation installations' },
  { code: 'prep_tournees', label: 'Préparation tournées' },
  { code: 'chargement', label: 'Chargement' },
  { code: 'depart', label: 'Départ' },
  { code: 'enlevement', label: 'Enlèvement' },
  { code: 'retour', label: 'Retour' },
  { code: 'recuperation', label: 'Récupération' },
  { code: 'installation', label: 'Installation' },
  { code: 'montage', label: 'Montage' },
  { code: 'demontage', label: 'Démontage' },
  { code: 'intervention', label: 'Intervention' },
  { code: 'evenements', label: 'Événements' },
  { code: 'taches_prioritaires', label: 'Tâches prioritaires' },
  { code: 'taches_secondaires', label: 'Tâches secondaires' },
  { code: 'courses', label: 'Courses' },
  { code: 'manual', label: 'Manuelle' },
]);

/**
 * Nombre attendu de sections seedées. Utilisé aussi par les tests
 * `tests/db/planning-v2-schema.test.js`.
 *
 * @type {number}
 */
export const PLANNING_V2_EXPECTED_SECTIONS = TASK_SECTIONS_SEED.length;

/**
 * Vrai si la table `task_assignments` existe. Nécessaire pour éviter
 * de tenter la création d'index sur une table potentiellement absente
 * dans certains scénarios de bootstrap.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean}
 */
function taskAssignmentsExists(db) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_assignments'")
    .get();
  return Boolean(row);
}

/**
 * Applique la migration Planning v2 schéma additive. Idempotent :
 * peut être rejouée sans effet indésirable.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {void}
 */
export function runPlanningV2SchemaMigration(db) {
  // ─── 1. Table `task_sections_ref` + seed ───
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_sections_ref (
        code TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);

    const insertOrIgnore = db.prepare(
      'INSERT OR IGNORE INTO task_sections_ref (code, label, sort_order) VALUES (?, ?, ?)',
    );
    const updateLabelOrder = db.prepare(
      'UPDATE task_sections_ref SET label = ?, sort_order = ? WHERE code = ?',
    );

    const seedTxn = db.transaction((rows) => {
      let idx = 0;
      for (const row of rows) {
        insertOrIgnore.run(row.code, row.label, idx);
        // Re-sync du libellé et de l'ordre en cas d'évolution ultérieure
        // (opération idempotente : identique = no-op).
        updateLabelOrder.run(row.label, idx, row.code);
        idx += 1;
      }
    });
    seedTxn(TASK_SECTIONS_SEED);

    logger.info(
      `  ✅ Planning v2: task_sections_ref prête (${TASK_SECTIONS_SEED.length} sections)`,
    );
  } catch (error) {
    logger.warn('Planning v2 migration task_sections_ref:', error.message);
  }

  // ─── 2. Index composites cursor-based sur `task_assignments` ───
  if (!taskAssignmentsExists(db)) {
    logger.info(
      '  ⏭️  Planning v2: task_assignments absent — indexes cursor-based non créés (à réappliquer au prochain boot)',
    );
    return;
  }

  const cursorIndexes = [
    {
      name: 'idx_ta_v2_date_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_ta_v2_date_id ON task_assignments(date, id)',
    },
    {
      name: 'idx_ta_v2_person_date_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_ta_v2_person_date_id ON task_assignments(person_id, date, id)',
    },
    {
      name: 'idx_ta_v2_section_date_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_ta_v2_section_date_id ON task_assignments(section, date, id)',
    },
  ];

  for (const idx of cursorIndexes) {
    try {
      db.exec(idx.sql);
    } catch (error) {
      logger.warn(`Planning v2 migration index ${idx.name}:`, error.message);
    }
  }

  logger.info('  ✅ Planning v2: index cursor-based prêts sur task_assignments');
}
