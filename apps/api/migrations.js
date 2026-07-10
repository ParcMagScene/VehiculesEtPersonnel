// ═══════════════════════════════════════════════════════════════
// migrations.js — Migrations post-initialisation de la base de données
// Migrations ALTER TABLE, CREATE TABLE additionnelles, index de performance
// Exécutées après initializeDatabase() dans database.js
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './logger.js';
import { runAffairesV2SchemaMigration } from './migrations/affaires-v2-schema-v1.js';
import { runControlesPeriodiquesMigrations } from './migrations/controles-periodiques-v1.js';
import { runEquipmentNumeroMagMigration } from './migrations/equipment-numero-mag-v1.js';
import { runEquipmentSerialsMagNumberMigration } from './migrations/equipment-serials-mag-number-v1.js';
import { runEquipmentSerialsUidMigration } from './migrations/equipment-serials-uid-v1.js';
import { runEquipmentSerialsUidV2Migration } from './migrations/equipment-serials-uid-v2.js';
import { runIncidentTicketsV2Migration } from './migrations/incident-tickets-v2.js';
import { runInventoryMigrations } from './migrations/inventory-v1.js';
import { runLocationsV2SchemaMigration } from './migrations/locations-v2-schema-v1.js';
import { runLocmatImportMigrations } from './migrations/locmat-import-v1.js';
import { runPersonalActionsLogV1Migration } from './migrations/personal-actions-log-v1.js';
import { runPlanningV2SchemaMigration } from './migrations/planning-v2-schema-v1.js';
import { runPvImportsMigrations } from './migrations/pv-imports-v1.js';
import { runSavPartsMigration } from './migrations/sav-parts-v1.js';
import { runBrandsMigrations } from './migrations/taxonomy-brands-v1.js';
import { runTaxonomyMaintenanceMigrations } from './migrations/taxonomy-maintenance-v1.js';
import { runTaxonomyMigrations } from './migrations/taxonomy-v1.js';
import { runVideoMigrations } from './migrations/video-v1.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runPostInitMigrations(db) {
  // [AUDIT FIX P0-5] Migration : ajouter colonne 'type' à locations (si absente)
  try {
    const locCols = db.pragma('table_info(locations)').map((c) => c.name);
    if (!locCols.includes('type')) {
      db.exec("ALTER TABLE locations ADD COLUMN type TEXT DEFAULT 'Salle de spectacle'");
      logger.info('  ✅ Migration: locations.type ajouté');
    }
  } catch (e) {
    logger.warn('Migration locations.type:', e.message);
  }

  // ═══ Migration : RDV avec horaires précis, catégorie Pro/Perso, et sync Google Calendar ═══
  try {
    const availCols = db
      .prepare('PRAGMA table_info(availabilities)')
      .all()
      .map((c) => c.name);
    if (!availCols.includes('start_time')) {
      db.prepare('ALTER TABLE availabilities ADD COLUMN start_time TEXT').run();
      logger.info('✅ Migration: colonne start_time ajoutée à availabilities');
    }
    if (!availCols.includes('end_time')) {
      db.prepare('ALTER TABLE availabilities ADD COLUMN end_time TEXT').run();
      logger.info('✅ Migration: colonne end_time ajoutée à availabilities');
    }
    if (!availCols.includes('rdv_category')) {
      db.prepare('ALTER TABLE availabilities ADD COLUMN rdv_category TEXT').run();
      logger.info('✅ Migration: colonne rdv_category ajoutée à availabilities');
    }
    if (!availCols.includes('google_event_id')) {
      db.prepare('ALTER TABLE availabilities ADD COLUMN google_event_id TEXT').run();
      logger.info('✅ Migration: colonne google_event_id ajoutée à availabilities');
    }
  } catch (error) {
    logger.warn('⚠️ Migration RDV horaires:', error.message);
  }

  // ═══ Migration : order_items — colonnes source_affaire_id, source_requester_id, source_requester_name ═══
  try {
    const oiCols = db
      .prepare('PRAGMA table_info(order_items)')
      .all()
      .map((c) => c.name);
    if (!oiCols.includes('source_affaire_id')) {
      db.prepare('ALTER TABLE order_items ADD COLUMN source_affaire_id TEXT').run();
      logger.info('✅ Migration: colonne source_affaire_id ajoutée à order_items');
    }
    if (!oiCols.includes('source_requester_id')) {
      db.prepare('ALTER TABLE order_items ADD COLUMN source_requester_id INTEGER').run();
      logger.info('✅ Migration: colonne source_requester_id ajoutée à order_items');
    }
    if (!oiCols.includes('source_requester_name')) {
      db.prepare('ALTER TABLE order_items ADD COLUMN source_requester_name TEXT').run();
      logger.info('✅ Migration: colonne source_requester_name ajoutée à order_items');
    }
    if (!oiCols.includes('source_type')) {
      db.prepare("ALTER TABLE order_items ADD COLUMN source_type TEXT DEFAULT 'affaire'").run();
      logger.info('✅ Migration: colonne source_type ajoutée à order_items');
    }
    if (!oiCols.includes('ref_code')) {
      db.prepare('ALTER TABLE order_items ADD COLUMN ref_code TEXT').run();
      logger.info('✅ Migration: colonne ref_code ajoutée à order_items');
    }
  } catch (error) {
    logger.warn('⚠️ Migration order_items sources:', error.message);
  }

  // ═══ Migration : material_requests — table de demandes de matériel ═══
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS material_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article TEXT NOT NULL,
    supplier_id INTEGER,
    supplier_name TEXT,
    quantity REAL DEFAULT 1,
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
    affaire_id TEXT,
    destination TEXT DEFAULT 'Stock',
    destination_other TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','ordered')),
    order_id INTEGER,
    requested_by INTEGER,
    requested_by_name TEXT,
    approved_by INTEGER,
    approved_by_name TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    notes TEXT,
    ref_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_material_requests_requested_by ON material_requests(requested_by)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_material_requests_affaire ON material_requests(affaire_id)',
    );
    logger.info('✅ Table material_requests vérifiée/créée');
  } catch (error) {
    logger.warn('⚠️ Migration material_requests:', error.message);
  }

  // ═══ Migration : material_request_lines — N références par demande ═══
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS material_request_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      article TEXT NOT NULL,
      ref_code TEXT,
      quantity REAL DEFAULT 1,
      order_id INTEGER,
      order_item_id INTEGER,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES material_requests(id) ON DELETE CASCADE
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_mrl_request ON material_request_lines(request_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mrl_order ON material_request_lines(order_id)');

    // Backfill : pour chaque demande sans ligne associée, insérer une ligne miroir.
    const orphanRequests = db
      .prepare(
        `SELECT mr.id, mr.article, mr.ref_code, mr.quantity, mr.order_id, mr.status
         FROM material_requests mr
         LEFT JOIN material_request_lines mrl ON mrl.request_id = mr.id
         WHERE mrl.id IS NULL`,
      )
      .all();
    if (orphanRequests.length > 0) {
      const insertLine = db.prepare(
        `INSERT INTO material_request_lines (request_id, article, ref_code, quantity, order_id, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      const tx = db.transaction((rows) => {
        for (const r of rows) {
          const lineStatus =
            r.status === 'approved' || r.status === 'ordered'
              ? 'approved'
              : r.status === 'rejected'
                ? 'rejected'
                : 'pending';
          insertLine.run(
            r.id,
            r.article,
            r.ref_code,
            r.quantity || 1,
            r.order_id || null,
            lineStatus,
          );
        }
      });
      tx(orphanRequests);
      logger.info(`✅ Backfill material_request_lines: ${orphanRequests.length} lignes créées`);
    }
    logger.info('✅ Table material_request_lines vérifiée/créée');
  } catch (error) {
    logger.warn('⚠️ Migration material_request_lines:', error.message);
  }

  // ═══ Migration : supplier_documents — table pour documents fournisseurs ═══
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS supplier_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    order_id INTEGER,
    doc_type TEXT NOT NULL CHECK(doc_type IN ('acknowledgment','delivery_note','quote','invoice')),
    filename TEXT NOT NULL,
    file_path TEXT,
    mime_type TEXT,
    parsed_data TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
  )`);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON supplier_documents(supplier_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_supplier_documents_order ON supplier_documents(order_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_supplier_documents_type ON supplier_documents(doc_type)',
    );
    logger.info('✅ Table supplier_documents vérifiée/créée');
  } catch (error) {
    logger.warn('⚠️ Migration supplier_documents:', error.message);
  }

  // ═══ Migration : order_items — colonnes received_date, delivery_note_id ═══
  try {
    const oiCols2 = db
      .prepare('PRAGMA table_info(order_items)')
      .all()
      .map((c) => c.name);
    if (!oiCols2.includes('received_date')) {
      db.prepare('ALTER TABLE order_items ADD COLUMN received_date TEXT').run();
      logger.info('✅ Migration: colonne received_date ajoutée à order_items');
    }
    if (!oiCols2.includes('delivery_note_id')) {
      db.prepare('ALTER TABLE order_items ADD COLUMN delivery_note_id INTEGER').run();
      logger.info('✅ Migration: colonne delivery_note_id ajoutée à order_items');
    }
  } catch (error) {
    logger.warn('⚠️ Migration order_items delivery:', error.message);
  }

  // ═══ Migration : orders — colonnes workflow_status, completion_notified ═══
  try {
    const orderCols = db
      .prepare('PRAGMA table_info(orders)')
      .all()
      .map((c) => c.name);
    if (!orderCols.includes('completion_notified')) {
      db.prepare('ALTER TABLE orders ADD COLUMN completion_notified INTEGER DEFAULT 0').run();
      logger.info('✅ Migration: colonne completion_notified ajoutée à orders');
    }
    // L2 — numéro de commande fournisseur libre (indépendant de la référence eM@g)
    if (!orderCols.includes('supplier_order_number')) {
      db.prepare('ALTER TABLE orders ADD COLUMN supplier_order_number TEXT').run();
      logger.info('✅ Migration: colonne supplier_order_number ajoutée à orders');
    }
  } catch (error) {
    logger.warn('⚠️ Migration orders workflow:', error.message);
  }

  // ═══ Migration : completion_alerts — table pour alertes de complétion ═══
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS completion_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('order','affaire')),
    entity_id TEXT NOT NULL,
    entity_reference TEXT,
    alert_type TEXT DEFAULT 'completion',
    message TEXT,
    recipient_id INTEGER,
    recipient_name TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_completion_alerts_recipient ON completion_alerts(recipient_id, is_read)',
    );
    logger.info('✅ Table completion_alerts vérifiée/créée');
  } catch (error) {
    logger.warn('⚠️ Migration completion_alerts:', error.message);
  }

  // Migration ONE-TIME: Masquer les RDV/événements existants sur l'écran TV (visible=0)
  try {
    const rdvMigApplied = db
      .prepare('SELECT 1 FROM migrations_log WHERE name = ?')
      .get('hide_rdv_events_on_tv');
    if (!rdvMigApplied) {
      const result = db
        .prepare(
          "UPDATE task_assignments SET visible = 0 WHERE section IN ('rdv', 'evenements') AND visible = 1",
        )
        .run();
      db.prepare('INSERT INTO migrations_log (name) VALUES (?)').run('hide_rdv_events_on_tv');
      logger.info(
        `✅ Migration hide_rdv_events_on_tv: ${result.changes} tâche(s) RDV/événements masquées sur TV`,
      );
    }
  } catch (error) {
    logger.warn('⚠️ Migration hide_rdv_events_on_tv:', error.message);
  }

  // Migration : ajouter prep_tournees au CHECK constraint de task_assignments
  try {
    const checkInfo5 = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'")
      .get();
    if (checkInfo5 && checkInfo5.sql && !checkInfo5.sql.includes("'prep_tournees'")) {
      logger.info('Migration: ajout section prep_tournees à task_assignments...');
      db.exec('BEGIN TRANSACTION');
      db.exec(`
      CREATE TABLE task_assignments_new (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
        person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
        time TEXT,
        end_time TEXT,
        section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
          'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations', 'prep_tournees',
          'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation', 'intervention',
          'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
        )),
        title TEXT,
        notes TEXT DEFAULT '',
        source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'ical_event', 'affaire', 'recurring')),
        source_id TEXT,
        google_event_title TEXT,
        affaire_num TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
        visible INTEGER DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT
      )
    `);
      const oldCols5 = db.pragma('table_info(task_assignments)').map((c) => c.name);
      const newCols5 = db.pragma('table_info(task_assignments_new)').map((c) => c.name);
      const commonCols5 = oldCols5.filter((c) => newCols5.includes(c)).join(', ');
      db.exec(
        `INSERT INTO task_assignments_new (${commonCols5}) SELECT ${commonCols5} FROM task_assignments`,
      );
      db.exec('DROP TABLE task_assignments');
      db.exec('ALTER TABLE task_assignments_new RENAME TO task_assignments');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
      db.exec('COMMIT');
      logger.info('✅ Section prep_tournees + source_type recurring ajoutés');
    }
  } catch (migErr5) {
    try {
      db.exec('ROLLBACK');
    } catch (_e) {
      /* ignored */
    }
    logger.warn('Migration prep_tournees:', migErr5.message);
  }

  // Migration : ajouter ical_event au CHECK constraint source_type de task_assignments
  try {
    const checkInfo6 = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'")
      .get();
    if (checkInfo6 && checkInfo6.sql && !checkInfo6.sql.includes("'ical_event'")) {
      logger.info('Migration: ajout source_type ical_event à task_assignments...');
      db.exec('BEGIN TRANSACTION');
      db.exec(`
      CREATE TABLE task_assignments_new (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
        person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
        time TEXT,
        end_time TEXT,
        section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
          'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations', 'prep_tournees',
          'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
          'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
        )),
        title TEXT,
        notes TEXT DEFAULT '',
        source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'ical_event', 'affaire', 'recurring')),
        source_id TEXT,
        google_event_title TEXT,
        affaire_num TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
        visible INTEGER DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT
      )
    `);
      const oldCols6 = db.pragma('table_info(task_assignments)').map((c) => c.name);
      const newCols6 = db.pragma('table_info(task_assignments_new)').map((c) => c.name);
      const commonCols6 = oldCols6.filter((c) => newCols6.includes(c)).join(', ');
      db.exec(
        `INSERT INTO task_assignments_new (${commonCols6}) SELECT ${commonCols6} FROM task_assignments`,
      );
      db.exec('DROP TABLE task_assignments');
      db.exec('ALTER TABLE task_assignments_new RENAME TO task_assignments');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
      db.exec('COMMIT');
      logger.info('✅ Source type ical_event ajouté');
    }
  } catch (migErr6) {
    try {
      db.exec('ROLLBACK');
    } catch (_e) {
      /* ignored */
    }
    logger.warn('Migration ical_event source_type:', migErr6.message);
  }

  // Migration : ajouter montage/demontage au CHECK constraint de task_assignments
  try {
    const checkInfo7 = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'")
      .get();
    if (checkInfo7 && checkInfo7.sql && !checkInfo7.sql.includes("'montage'")) {
      logger.info('Migration: ajout sections montage/demontage à task_assignments...');
      db.exec('BEGIN TRANSACTION');
      db.exec(`
      CREATE TABLE task_assignments_new (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
        person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
        time TEXT,
        end_time TEXT,
        section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
          'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations', 'prep_tournees',
          'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
          'montage', 'demontage',
          'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
        )),
        title TEXT,
        notes TEXT DEFAULT '',
        source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'ical_event', 'affaire', 'recurring')),
        source_id TEXT,
        google_event_title TEXT,
        affaire_num TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
        visible INTEGER DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT
      )
    `);
      const oldCols7 = db.pragma('table_info(task_assignments)').map((c) => c.name);
      const newCols7 = db.pragma('table_info(task_assignments_new)').map((c) => c.name);
      const commonCols7 = oldCols7.filter((c) => newCols7.includes(c)).join(', ');
      db.exec(
        `INSERT INTO task_assignments_new (${commonCols7}) SELECT ${commonCols7} FROM task_assignments`,
      );
      db.exec('DROP TABLE task_assignments');
      db.exec('ALTER TABLE task_assignments_new RENAME TO task_assignments');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
      db.exec('COMMIT');
      logger.info('✅ Sections montage/demontage ajoutées à task_assignments');
    }
  } catch (migErr7) {
    try {
      db.exec('ROLLBACK');
    } catch (_e) {
      /* ignored */
    }
    logger.warn('Migration montage/demontage:', migErr7.message);
  }

  // ── Migration : soft delete task_assignments (deleted_at) ──
  try {
    const taCols = db.pragma('table_info(task_assignments)').map((c) => c.name);
    if (!taCols.includes('deleted_at')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN deleted_at TEXT');
      logger.info('  ✅ Migration: task_assignments.deleted_at ajouté');
    }
  } catch (e) {
    logger.warn('⚠️ Migration deleted_at:', e.message);
  }

  // ── Table recurring_tasks : tâches récurrentes ──
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_tasks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT 'manual',
      time TEXT,
      period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
      recurrence TEXT NOT NULL DEFAULT 'daily' CHECK(recurrence IN ('daily', 'weekly', 'monthly')),
      day_of_week INTEGER,
      day_of_month INTEGER,
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    logger.info('✅ Table recurring_tasks vérifiée/créée');
  } catch (error) {
    logger.warn('⚠️ recurring_tasks:', error.message);
  }

  // ── Table tracking_recurring_tasks : récurrences dédiées au Suivi ──
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS tracking_recurring_tasks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('AM', 'PM')),
      recurrence TEXT NOT NULL CHECK(recurrence IN ('daily', 'weekly', 'monthly')),
      day_of_week INTEGER,
      day_of_month INTEGER,
      default_time_spent REAL DEFAULT 0,
      default_comment TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

    const teCols = db.pragma('table_info(tracking_entries)').map((c) => c.name);
    if (!teCols.includes('recurring_task_id')) {
      db.exec(
        'ALTER TABLE tracking_entries ADD COLUMN recurring_task_id TEXT REFERENCES tracking_recurring_tasks(id) ON DELETE SET NULL',
      );
      logger.info('✅ Migration: tracking_entries.recurring_task_id ajouté');
    }

    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_tracking_entries_recurring_task ON tracking_entries(recurring_task_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_tracking_recurring_person_active ON tracking_recurring_tasks(person_id, active)',
    );
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_entries_sheet_recurring_unique
      ON tracking_entries(sheet_id, recurring_task_id)
      WHERE recurring_task_id IS NOT NULL
    `);
    logger.info('✅ Table tracking_recurring_tasks vérifiée/créée');
  } catch (error) {
    logger.warn('⚠️ tracking_recurring_tasks:', error.message);
  }

  // ── Table ical_calendars : agendas iCal configurés ──
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS ical_calendars (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      enabled INTEGER DEFAULT 1,
      last_sync TEXT,
      last_sync_error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    try {
      const icalCols = db.pragma('table_info(ical_calendars)').map((c) => c.name);
      if (!icalCols.includes('last_sync_error')) {
        db.exec('ALTER TABLE ical_calendars ADD COLUMN last_sync_error TEXT');
        logger.info('  ✅ Migration: ical_calendars.last_sync_error ajouté');
      }
    } catch (e) {
      logger.warn('⚠️ ical_calendars:', e.message);
    }
    logger.info('✅ Table ical_calendars vérifiée/créée');
  } catch (error) {
    logger.warn('⚠️ ical_calendars:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════════
  // [AUDIT FIX] Index manquants critiques (idempotent)
  // ═══════════════════════════════════════════════════════════════════
  const perfIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_active_sessions_token_hash ON active_sessions(token_hash)',
    'CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_reservations_vehicle_dates ON reservations(vehicle_id, start_date, end_date)',
    'CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle ON maintenances(vehicle_id, status, date)',
    'CREATE INDEX IF NOT EXISTS idx_modification_history_entity ON modification_history(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status)',
    'CREATE INDEX IF NOT EXISTS idx_mail_history_status ON mail_history(sent_by, status)',
    'CREATE INDEX IF NOT EXISTS idx_bl_imports_affaire ON bl_imports(affaire_id)',
  ];
  let idxOk = 0;
  for (const sql of perfIndexes) {
    try {
      db.exec(sql);
      idxOk++;
    } catch (_) {
      /* colonne absente — ignoré */
    }
  }
  logger.info(`✅ Index performance: ${idxOk}/${perfIndexes.length} créés/vérifiés`);

  // ═══════════════════════════════════════════════════════════════════
  // Migration : affaires Google — type par défaut Location au lieu de Prestation
  // Les affaires auto-créées depuis Google Calendar avaient type='Prestation' par défaut.
  // On corrige rétroactivement sauf si le titre contient 'presta'/'prestation'/'vente'.
  // ═══════════════════════════════════════════════════════════════════
  try {
    const migrationKey = 'google_affaires_type_location';
    // Vérifier si déjà exécutée via une table de suivi simple
    db.exec(
      `CREATE TABLE IF NOT EXISTS _migrations_log (key TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    );
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migrationKey);
    if (!already) {
      const result = db
        .prepare(
          `
      UPDATE affaires SET type = 'Location'
      WHERE google_event_id IS NOT NULL
        AND type = 'Prestation'
        AND LOWER(COALESCE(nom, '') || ' ' || COALESCE(event_name, '') || ' ' || COALESCE(titre, ''))
            NOT LIKE '%vente%'
        AND LOWER(COALESCE(nom, '') || ' ' || COALESCE(event_name, '') || ' ' || COALESCE(titre, ''))
            NOT LIKE '%presta%'
    `,
        )
        .run();
      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migrationKey);
      logger.info(
        `✅ Migration ${migrationKey}: ${result.changes} affaire(s) corrigée(s) de Prestation → Location`,
      );
    }
  } catch (e) {
    logger.warn('⚠️ Migration google_affaires_type_location:', e.message);
  }

  // ═══ Migration : colonnes manquantes dans vehicles (attendues par vehicleRoutes) ═══
  try {
    const vCols = db.pragma('table_info(vehicles)').map((c) => c.name);
    const missingCols = [
      { name: 'category', def: 'TEXT' },
      { name: 'vin', def: 'TEXT' },
      { name: 'status', def: "TEXT DEFAULT 'available'" },
      { name: 'notes', def: 'TEXT' },
      { name: 'year', def: 'INTEGER' },
      { name: 'last_maintenance_date', def: 'TEXT' },
      { name: 'last_maintenance_km', def: 'INTEGER' },
      { name: 'mileage_history', def: 'TEXT' },
      { name: 'assigned_to', def: 'INTEGER' },
      { name: 'pupitre', def: 'TEXT' },
      { name: 'is_insured', def: 'BOOLEAN DEFAULT 0' },
      { name: 'insurance_company', def: 'TEXT' },
      { name: 'insurance_number', def: 'TEXT' },
      { name: 'insurance_expiry', def: 'TEXT' },
      { name: 'latitude', def: 'REAL' },
      { name: 'longitude', def: 'REAL' },
      { name: 'location_updated_at', def: 'DATETIME' },
    ];
    for (const col of missingCols) {
      if (!vCols.includes(col.name)) {
        // [SEC] Defense en profondeur : col vient d'un tableau hardcode juste
        // au-dessus, mais on valide quand meme l'identifiant et le type pour
        // empecher toute injection si le tableau evolue plus tard.
        if (!/^[a-z_][a-z0-9_]*$/i.test(col.name)) {
          throw new Error(`Migration vehicles: nom de colonne invalide ${col.name}`);
        }
        if (!/^[A-Za-z0-9_'\s()-]+$/.test(col.def)) {
          throw new Error(`Migration vehicles: definition invalide pour ${col.name}`);
        }
        db.exec(`ALTER TABLE vehicles ADD COLUMN ${col.name} ${col.def}`);
        logger.info(`  ✅ Migration: vehicles.${col.name} ajouté`);
      }
    }
  } catch (e) {
    logger.warn('⚠️ Migration vehicles colonnes manquantes:', e.message);
  }

  // ═══ Migration : enrichir fournisseurs dans bl_imports.parsed_data existants + copier BL en pièces jointes ═══
  try {
    // Vérifier si la migration a déjà été exécutée
    const migDone = db
      .prepare("SELECT 1 FROM _migrations_log WHERE key = 'enrich_bl_fournisseurs_v1'")
      .get();
    if (!migDone) {
      const blRows = db
        .prepare(
          'SELECT id, affaire_id, filename, file_path, parsed_data FROM bl_imports WHERE parsed_data IS NOT NULL',
        )
        .all();
      let enriched = 0;
      const attachBase = path.join(__dirname, '..', '..', 'public', 'attachments');
      const blBase = path.join(__dirname, '..', '..', 'public', 'bl-imports');

      for (const row of blRows) {
        try {
          const pd = JSON.parse(row.parsed_data);
          if (!pd.items || !Array.isArray(pd.items)) continue;
          let changed = false;
          for (const item of pd.items) {
            if (item.fournisseur) continue;
            const desc = item.description || '';
            const before = desc.match(
              /^([A-Z\u00c0-\u0178][A-Z\u00c0-\u01780-9\s&'./-]{0,30}?)\s*[\u2022\u00b7]/,
            );
            if (before) {
              item.fournisseur = before[1].trim();
              changed = true;
            } else {
              const after = desc.match(
                /[\u2022\u00b7]\s*([A-Z\u00c0-\u0178][A-Z\u00c0-\u01780-9\s&'./-]{1,30})\s*$/,
              );
              if (after) {
                item.fournisseur = after[1].trim();
                changed = true;
              }
            }
          }
          if (changed) {
            db.prepare('UPDATE bl_imports SET parsed_data = ? WHERE id = ?').run(
              JSON.stringify(pd),
              row.id,
            );
            enriched++;
          }
        } catch {
          /* skip invalid JSON */
        }

        // Copier le fichier BL en pièce jointe de l'affaire
        if (row.file_path && row.affaire_id) {
          try {
            const safeId = row.affaire_id.replace(/[^a-zA-Z0-9\u00c0-\u00ff\s\-_().]/g, '');
            if (safeId) {
              const destDir = path.join(attachBase, safeId);
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
              const srcPath = path.join(blBase, row.file_path);
              const destPath = path.join(destDir, row.filename);
              if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
                fs.copyFileSync(srcPath, destPath);
              }
            }
          } catch {
            /* skip copy errors */
          }
        }
      }

      db.prepare(
        "INSERT INTO _migrations_log (key, applied_at) VALUES ('enrich_bl_fournisseurs_v1', datetime('now'))",
      ).run();
      if (enriched > 0)
        logger.info(`  ✅ Migration: ${enriched} bl_imports enrichis avec fournisseur`);
      if (blRows.length > 0) logger.info(`  ✅ Migration: BL copiés en pièces jointes affaires`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration enrich_bl_fournisseurs:', e.message);
  }

  // ── Seed stock_categories (taxonomie unifiée) ──
  try {
    const migDone = db
      .prepare("SELECT 1 FROM _migrations_log WHERE key = 'seed_stock_categories_v1'")
      .get();
    if (!migDone) {
      const existing = db.prepare('SELECT COUNT(*) as cnt FROM stock_categories').get();
      if (existing.cnt === 0) {
        const ins = db.prepare(
          'INSERT INTO stock_categories (name, description, parent_id, color, icon) VALUES (?, ?, ?, ?, ?)',
        );
        const rootCats = [
          ['Sonorisation', 'Pièces et consommables son', null, '#6366f1', '🔊'],
          ['Éclairage', 'Lampes, filtres, accessoires éclairage', null, '#f59e0b', '💡'],
          ['Structure', 'Pièces structure, visserie', null, '#64748b', '🏗️'],
          [
            'Distribution Électrique',
            'Disjoncteurs, fiches, câbles secteur',
            null,
            '#ef4444',
            '⚡',
          ],
          ['Audiovisuel', 'Connecteurs et accessoires vidéo', null, '#8b5cf6', '🎥'],
          ['Câbles & Connectique', 'Câbles, connecteurs, adaptateurs', null, '#3b82f6', '🔌'],
          ['Consommables', 'Gaffer, adhésifs, piles, mousses', null, '#10b981', '📦'],
          ['Outillage & EPI', 'Pièces mécaniques, outillage, EPI', null, '#f97316', '🔧'],
          ['Électronique', 'Composants, alimentations, pièces détachées', null, '#ec4899', '⚡'],
          ['Backline', 'Cordes, peaux, accessoires backline', null, '#14b8a6', '🎸'],
          ['Divers', 'Sans catégorie', null, '#94a3b8', '📋'],
          ['Rideau-Machinerie', 'Rideaux, textiles, machinerie scénique', null, '#a855f7', '🎭'],
          ['Informatique', 'Matériel informatique', null, '#06b6d4', '💻'],
          ['Accroche', 'Élingues, crochets, accessoires accroche', null, '#14b8a6', '🔗'],
          ['Motorisation', 'Moteurs, pieds de levage', null, '#f97316', '⚙️'],
          ['Mobilier', 'Mobilier scénique, podiums', null, '#6b7280', '🪑'],
        ];
        const parentIds = {};
        for (const [name, desc, , color, icon] of rootCats) {
          const res = ins.run(name, desc, null, color, icon);
          parentIds[name] = res.lastInsertRowid;
        }
        const subCats = [
          // Sonorisation
          ['Micros', parentIds['Sonorisation']],
          ['Enceintes', parentIds['Sonorisation']],
          ['Amplificateurs', parentIds['Sonorisation']],
          ['Consoles son', parentIds['Sonorisation']],
          ['Périphériques son', parentIds['Sonorisation']],
          ['Accessoires son', parentIds['Sonorisation']],
          // Éclairage
          ['Lampes', parentIds['Éclairage']],
          ['Filtres & Gélatines', parentIds['Éclairage']],
          ['Accessoires éclairage', parentIds['Éclairage']],
          // Structure
          ['Pièces structure', parentIds['Structure']],
          ['Visserie & Boulonnerie', parentIds['Structure']],
          // Distribution Électrique
          ['Disjoncteurs', parentIds['Distribution Électrique']],
          ['Fiches & Prises', parentIds['Distribution Électrique']],
          ['Câbles secteur', parentIds['Distribution Électrique']],
          // Audiovisuel
          ['Connecteurs vidéo', parentIds['Audiovisuel']],
          ['Accessoires vidéo', parentIds['Audiovisuel']],
          // Câbles & Connectique
          ['Câbles audio', parentIds['Câbles & Connectique']],
          ['Câbles réseau', parentIds['Câbles & Connectique']],
          ['Connecteurs', parentIds['Câbles & Connectique']],
          ['Adaptateurs', parentIds['Câbles & Connectique']],
          // Consommables
          ['Gaffer & Adhésifs', parentIds['Consommables']],
          ['Piles & Batteries', parentIds['Consommables']],
          ['Mousse & Protection', parentIds['Consommables']],
          ['Consommables divers', parentIds['Consommables']],
          // Outillage & EPI
          ['Pièces mécaniques', parentIds['Outillage & EPI']],
          ['Outillage', parentIds['Outillage & EPI']],
          ['Quincaillerie', parentIds['Outillage & EPI']],
          // Électronique
          ['Composants', parentIds['Électronique']],
          ['Alimentations', parentIds['Électronique']],
          ['Pièces détachées', parentIds['Électronique']],
          // Backline
          ['Cordes & Peaux', parentIds['Backline']],
          ['Accessoires backline', parentIds['Backline']],
          // Divers
          ['Sans catégorie', parentIds['Divers']],
        ];
        for (const [name, pid] of subCats) {
          ins.run(name, null, pid, null, null);
        }
        db.prepare(
          "INSERT INTO _migrations_log (key, applied_at) VALUES ('seed_stock_categories_v1', datetime('now'))",
        ).run();
        logger.info(
          `  ✅ Migration: ${rootCats.length} familles + ${subCats.length} sous-catégories stock créées`,
        );
      }
    }
  } catch (e) {
    logger.warn('⚠️ Migration seed_stock_categories:', e.message);
  }

  // ═══ Module Inventaire Unifié ═══
  runInventoryMigrations(db);

  // ═══ Module Contrôles Périodiques (équipements + véhicules) ═══
  runControlesPeriodiquesMigrations(db);

  // ═══ Module Import PV (Procès-Verbaux PDF) ═══
  runPvImportsMigrations(db);

  // ═══ Import intelligent Locmat (Locations + Serialise) ═══
  runLocmatImportMigrations(db);
  runEquipmentNumeroMagMigration(db);
  runEquipmentSerialsMagNumberMigration(db);
  runEquipmentSerialsUidMigration(db);
  runEquipmentSerialsUidV2Migration(db);

  // ═══ Module Surveillance Vidéo ═══
  runVideoMigrations(db);

  // ═══ [T-P0-10] Localisation v2 — depot_svg_maps + equipment_location_history
  //     Non-destructif : coexiste avec les JSON statiques public/depot*-zones.json
  //     et les colonnes equipment.location_zone/code/floor/depot. Voir
  //     docs/05-Specs/LOCATIONS_V2.md.
  runLocationsV2SchemaMigration(db);

  // ═══ [T-P0-08] Affaires v2 — materialisation + FK ref (P0-DECISION-2 du 2026-07-10)
  //     Strictement additif : ajout de colonnes affaire_ref_id INTEGER
  //     nullable sur reservations/missions/orders/bl_imports/
  //     dynamic_display_events/equipment_assignments + backfill depuis
  //     colonnes TEXT existantes + table affaire_history. Les colonnes
  //     TEXT `affaire` / `affaire_id` restent inchangees pendant la
  //     phase de coexistence (sunset TEXT prevu en T-P0-09). Voir
  //     docs/05-Specs/AFFAIRES_V2.md.
  runAffairesV2SchemaMigration(db);

  // ═══ [T-P1-07] SAV v2 — table sav_parts (pieces detachees)
  //     Additive, idempotente. Coexiste avec sav_tickets. Voir
  //     docs/api/v2/sav.md.
  runSavPartsMigration(db);

  // ═══ Suivi/Incidents v2 (multi-tickets + date) ═══
  runIncidentTicketsV2Migration(db);

  // ═══ Audit log auth éphémère pour actions personnelles ═══
  runPersonalActionsLogV1Migration(db);

  // ═══ Uniformisation Taxonomie ═══
  runTaxonomyMigrations(db);

  // ═══ Maintenance Taxonomie — Phase 2 ═══
  runTaxonomyMaintenanceMigrations(db);

  // ═══ Uniformisation Marques & Sociétés — Phase 3 ═══
  runBrandsMigrations(db);

  // [PERF Phase 4.L] Cleanup des noms sérialisés (suffixe " #N") déplacé en
  // migration versionnée 0004_cleanup_equipment_serialize_suffix.sql — ne
  // tourne plus à chaque boot (le SELECT COUNT(*) LIKE '% #%' coûtait ~2s).

  // ═══ Google OAuth2 — Table tokens avec refresh_token chiffré (Phase A) ═══
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS google_oauth_tokens (
      user_id INTEGER PRIMARY KEY,
      refresh_token_encrypted TEXT NOT NULL,
      refresh_token_iv TEXT NOT NULL,
      refresh_token_tag TEXT NOT NULL,
      google_email TEXT,
      scopes TEXT,
      connected_at INTEGER,
      last_sync_at INTEGER
    )
  `);
    // Ne pas loguer si la table existait déjà (CREATE IF NOT EXISTS est silencieux)
  } catch (e) {
    logger.warn('⚠️ Migration google_oauth_tokens:', e.message);
  }

  // ═══ Cleanup : suppression de l'ancienne table google_tokens (flux implicite GIS, remplacé par google_oauth_tokens) ═══
  try {
    const legacyTableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='google_tokens'")
      .get();
    if (legacyTableExists) {
      db.exec('DROP TABLE google_tokens');
      logger.info('✅ Table legacy google_tokens supprimée (remplacée par google_oauth_tokens)');
    }
  } catch (e) {
    logger.warn('⚠️ Migration drop google_tokens:', e.message);
  }

  // ═══ Phase 8 — Plan de location : tarifs véhicules + prix réservation ═══
  try {
    const vehicleCols = db
      .prepare("PRAGMA table_info('vehicles')")
      .all()
      .map((c) => c.name);
    if (!vehicleCols.includes('daily_rate')) {
      db.exec('ALTER TABLE vehicles ADD COLUMN daily_rate REAL DEFAULT 0');
      db.exec('ALTER TABLE vehicles ADD COLUMN weekly_rate REAL DEFAULT 0');
      db.exec('ALTER TABLE vehicles ADD COLUMN monthly_rate REAL DEFAULT 0');
      logger.info('✅ Migration Phase 8: colonnes tarifs ajoutées à vehicles');
    }
  } catch (e) {
    logger.warn('⚠️ Migration Phase 8 vehicles tarifs:', e.message);
  }

  try {
    const resCols = db
      .prepare("PRAGMA table_info('reservations')")
      .all()
      .map((c) => c.name);
    if (!resCols.includes('rental_price')) {
      db.exec('ALTER TABLE reservations ADD COLUMN rental_price REAL');
      logger.info('✅ Migration Phase 8: colonne rental_price ajoutée à reservations');
    }
  } catch (e) {
    logger.warn('⚠️ Migration Phase 8 reservations rental_price:', e.message);
  }

  // ═══ Phase 9 — Workflow affaires : statut, historique, notifications ═══

  // 9a. Ajouter colonne status à affaires
  try {
    const affCols = db
      .prepare("PRAGMA table_info('affaires')")
      .all()
      .map((c) => c.name);
    if (!affCols.includes('status')) {
      db.exec("ALTER TABLE affaires ADD COLUMN status TEXT NOT NULL DEFAULT 'brouillon'");
      db.exec('CREATE INDEX IF NOT EXISTS idx_affaires_status ON affaires(status)');

      // Migrer les statuts existants depuis planning_affaire_status
      const existingStatuses = db
        .prepare('SELECT numero_affaire, status FROM planning_affaire_status')
        .all();
      if (existingStatuses.length > 0) {
        const STATUS_MAP = { pending: 'brouillon', in_progress: 'en_cours', done: 'terminee' };
        const updateStmt = db.prepare('UPDATE affaires SET status = ? WHERE numero_affaire = ?');
        for (const row of existingStatuses) {
          const newStatus = STATUS_MAP[row.status] || 'brouillon';
          updateStmt.run(newStatus, row.numero_affaire);
        }
        logger.info(
          `✅ Migration Phase 9: ${existingStatuses.length} statuts migrés depuis planning_affaire_status`,
        );
      }
      logger.info('✅ Migration Phase 9: colonne status ajoutée à affaires');
    }
  } catch (e) {
    logger.warn('⚠️ Migration Phase 9 affaires.status:', e.message);
  }

  // 9b. Table historique des transitions de statut
  try {
    const historyExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='affaire_status_history'",
      )
      .get();
    if (!historyExists) {
      db.exec(`
        CREATE TABLE affaire_status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          affaire_id INTEGER NOT NULL REFERENCES affaires(id) ON DELETE CASCADE,
          from_status TEXT,
          to_status TEXT NOT NULL,
          changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_ash_affaire ON affaire_status_history(affaire_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ash_date ON affaire_status_history(changed_at)');
      logger.info('✅ Migration Phase 9: table affaire_status_history créée');
    }
  } catch (e) {
    logger.warn('⚠️ Migration Phase 9 affaire_status_history:', e.message);
  }

  // ═══ Migration : colonne show_in_planning dans persons ═══
  try {
    const personCols = db.pragma('table_info(persons)').map((c) => c.name);
    if (!personCols.includes('show_in_planning')) {
      db.exec('ALTER TABLE persons ADD COLUMN show_in_planning INTEGER NOT NULL DEFAULT 1');
      logger.info('✅ Migration: colonne show_in_planning ajoutée à persons');
    }
  } catch (e) {
    logger.warn('⚠️ Migration show_in_planning:', e.message);
  }

  // ═══ Sprint 2 — FK vehicles.assigned_to → persons(id) ═══
  // Ajouter les FK manquantes sur vehicles (assigned_to + modified_by) via recreation de table
  try {
    const vehiclesFKList = db.pragma("foreign_key_list('vehicles')");
    const hasAssignedToFK = vehiclesFKList.some(
      (fk) => fk.from === 'assigned_to' && fk.table === 'persons',
    );
    if (!hasAssignedToFK) {
      // Récupérer les colonnes actuelles pour construire le SELECT dynamiquement
      const cols = db.pragma("table_info('vehicles')").map((c) => c.name);
      const colList = cols.join(', ');
      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN;
        CREATE TABLE vehicles_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT,
          registration TEXT,
          brand TEXT,
          model TEXT,
          color TEXT,
          owner TEXT,
          comment TEXT,
          display_color TEXT,
          photo TEXT,
          order_index INTEGER DEFAULT 0,
          is_location BOOLEAN DEFAULT 0,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          modified_by INTEGER,
          modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          kilometrage INTEGER DEFAULT 0,
          controle_technique_type TEXT,
          controle_technique_date TEXT,
          controle_technique_deadline TEXT,
          controles_techniques TEXT DEFAULT '[]',
          category TEXT,
          vin TEXT,
          status TEXT DEFAULT 'available',
          notes TEXT,
          year INTEGER,
          last_maintenance_date TEXT,
          last_maintenance_km INTEGER,
          mileage_history TEXT,
          assigned_to INTEGER,
          pupitre TEXT,
          is_insured BOOLEAN DEFAULT 0,
          insurance_company TEXT,
          insurance_number TEXT,
          insurance_expiry TEXT,
          latitude REAL,
          longitude REAL,
          location_updated_at DATETIME,
          daily_rate REAL DEFAULT 0,
          weekly_rate REAL DEFAULT 0,
          monthly_rate REAL DEFAULT 0,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_to) REFERENCES persons(id) ON DELETE SET NULL
        );
        INSERT INTO vehicles_new (${colList}) SELECT ${colList} FROM vehicles;
        DROP TABLE vehicles;
        ALTER TABLE vehicles_new RENAME TO vehicles;
        CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);
        CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration);
        CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_to ON vehicles(assigned_to);
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
      logger.info('✅ Sprint 2: FK vehicles.assigned_to → persons(id) ajoutée');
    }
  } catch (e) {
    logger.warn('⚠️ Migration Sprint 2 FK vehicles:', e.message);
  }

  // ═══ Sprint 2 — UNIQUE constraint persons.driver_id ═══
  // Un chauffeur (drivers) ne peut être lié qu'à une seule personne
  try {
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_persons_driver_id_unique'",
      )
      .get();
    if (!indexes) {
      db.exec(
        'CREATE UNIQUE INDEX idx_persons_driver_id_unique ON persons(driver_id) WHERE driver_id IS NOT NULL',
      );
      logger.info('✅ Sprint 2: UNIQUE INDEX idx_persons_driver_id_unique créé');
    }
  } catch (e) {
    logger.warn('⚠️ Migration Sprint 2 UNIQUE persons.driver_id:', e.message);
  }

  // ═══ Module E-shops — Produits externes multi-fournisseurs ═══
  try {
    // Ajouter champs expédition sur suppliers
    const supplierCols = db
      .prepare('PRAGMA table_info(suppliers)')
      .all()
      .map((c) => c.name);
    if (!supplierCols.includes('shipping_flat_rate')) {
      db.prepare('ALTER TABLE suppliers ADD COLUMN shipping_flat_rate REAL').run();
      logger.info('✅ Migration: suppliers.shipping_flat_rate ajouté');
    }
    if (!supplierCols.includes('shipping_free_threshold')) {
      db.prepare('ALTER TABLE suppliers ADD COLUMN shipping_free_threshold REAL').run();
      logger.info('✅ Migration: suppliers.shipping_free_threshold ajouté');
    }
    if (!supplierCols.includes('shipping_notes')) {
      db.prepare('ALTER TABLE suppliers ADD COLUMN shipping_notes TEXT').run();
      logger.info('✅ Migration: suppliers.shipping_notes ajouté');
    }
    if (!supplierCols.includes('website')) {
      db.prepare('ALTER TABLE suppliers ADD COLUMN website TEXT').run();
      logger.info('✅ Migration: suppliers.website ajouté');
    }

    // Ajouter external_url sur supplier_articles
    const artCols = db
      .prepare('PRAGMA table_info(supplier_articles)')
      .all()
      .map((c) => c.name);
    if (!artCols.includes('external_url')) {
      db.prepare('ALTER TABLE supplier_articles ADD COLUMN external_url TEXT').run();
      logger.info('✅ Migration: supplier_articles.external_url ajouté');
    }

    // Table produits externes (catalogue e-shop)
    db.exec(`
      CREATE TABLE IF NOT EXISTS external_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        image_url TEXT,
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Table liaisons produit ↔ fournisseur avec prix et politique de port
    db.exec(`
      CREATE TABLE IF NOT EXISTS external_product_suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        supplier_id INTEGER,
        supplier_name TEXT NOT NULL,
        supplier_ref TEXT,
        price_ht REAL,
        external_url TEXT,
        shipping_policy TEXT DEFAULT 'flat',
        shipping_flat_rate REAL,
        shipping_free_threshold REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES external_products(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
      )
    `);

    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_ext_product_suppliers ON external_product_suppliers(product_id)',
    );
    logger.info('✅ Migration: module external_products créé');
  } catch (e) {
    logger.warn('⚠️ Migration external_products:', e.message);
  }

  // ═══ Sprint 4 — Index manquants : orders, order_items, quotes ═══
  const sprint4Indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_affaire ON orders(affaire_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)',
    'CREATE INDEX IF NOT EXISTS idx_quotes_affaire ON quotes(affaire_id)',
    'CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status)',
    'CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id)',
  ];
  let s4IdxOk = 0;
  for (const sql of sprint4Indexes) {
    try {
      db.exec(sql);
      s4IdxOk++;
    } catch (_) {
      /* colonne absente ou index déjà existant — ignoré */
    }
  }
  logger.info(`✅ Sprint 4 Index: ${s4IdxOk}/${sprint4Indexes.length} créés/vérifiés`);

  // ═══ PERF Sprint 1 — Index complémentaires identifiés par audit perf ═══
  // Idempotents (IF NOT EXISTS), créés uniquement si la table/colonne existe.
  const perfSprint1Indexes = [
    // dynamic_display_events : composite (affaire_id, date DESC) pour les requêtes
    // "WHERE affaire_id = ? ORDER BY date DESC" du planning.
    'CREATE INDEX IF NOT EXISTS idx_dde_affaire_date ON dynamic_display_events(affaire_id, date DESC)',
    // supplier_articles : filtres par supplier_id et par brand (texte) côté catalogue.
    'CREATE INDEX IF NOT EXISTS idx_supplier_articles_supplier ON supplier_articles(supplier_id)',
    'CREATE INDEX IF NOT EXISTS idx_supplier_articles_brand ON supplier_articles(brand)',
    // modification_history : lookup par entité (entity_type, entity_id) + tri timestamp DESC.
    // [PERF Phase 4.M] idx_modhist_entity remplacé par idx_modification_history_entity
    // (créé par perfSprint1Indexes ligne 598). Voir 0003_drop_duplicate_indexes.sql.
    'CREATE INDEX IF NOT EXISTS idx_modhist_timestamp ON modification_history(timestamp DESC)',
  ];
  let perfIdxOk = 0;
  for (const sql of perfSprint1Indexes) {
    try {
      db.exec(sql);
      perfIdxOk++;
    } catch (_) {
      /* colonne absente ou index déjà existant — ignoré */
    }
  }
  logger.info(`✅ Perf Sprint 1 Index: ${perfIdxOk}/${perfSprint1Indexes.length} créés/vérifiés`);

  // ═══ PERF Equipment — index ciblés sur le module Parc Matériel ═══
  // Couvre les filtres GET /api/equipment, lookup by-uid, JOIN assignments/sav,
  // et l'arbre des catégories.
  const perfEquipmentIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_equipment_reference ON equipment(reference)',
    'CREATE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial_number)',
    // [PERF Phase 4.M] idx_equipment_uid (partial) retiré : doublon de
    // idx_equipment_uid_unique créé par locmat-import-v1.js.
    'CREATE INDEX IF NOT EXISTS idx_equipment_location_zone ON equipment(location_zone)',
    'CREATE INDEX IF NOT EXISTS idx_equipment_location_depot ON equipment(location_depot)',
    'CREATE INDEX IF NOT EXISTS idx_equipment_brand_id ON equipment(brand_id)',
    'CREATE INDEX IF NOT EXISTS idx_equipment_numero_mag ON equipment(numero_mag)',
    'CREATE INDEX IF NOT EXISTS idx_ea_equipment_status ON equipment_assignments(equipment_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_ea_assigned_to ON equipment_assignments(assigned_to)',
    // [PERF Phase 4.M] idx_sav_equipment retiré : doublon de idx_sav_tickets_equipment_id
    // créé par update_sav_tickets_import.sql.
    'CREATE INDEX IF NOT EXISTS idx_sav_status ON sav_tickets(status)',
    'CREATE INDEX IF NOT EXISTS idx_sav_reported_by ON sav_tickets(reported_by)',
    'CREATE INDEX IF NOT EXISTS idx_eqcat_parent_level ON equipment_categories(parent_id, level)',
    'CREATE INDEX IF NOT EXISTS idx_eqlists_user_type ON equipment_lists(user_id, list_type)',
  ];
  let perfEqOk = 0;
  for (const sql of perfEquipmentIndexes) {
    try {
      db.exec(sql);
      perfEqOk++;
    } catch (_) {
      /* colonne/table absente ou index déjà existant — ignoré */
    }
  }
  logger.info(`✅ Perf Equipment Index: ${perfEqOk}/${perfEquipmentIndexes.length} créés/vérifiés`);

  // ═══ Planning v2 — DB v2 (T-P0-02) ═══
  // Additive : ajoute task_sections_ref (seed 16 sections) + index composites
  // cursor-based sur task_assignments. Aucune altération v1.
  // Placé avant ANALYZE pour bénéficier de la refresh des stats.
  runPlanningV2SchemaMigration(db);

  // ANALYZE après ajout d'index pour rafraîchir les stats du planner.
  try {
    db.exec('ANALYZE');
  } catch (e) {
    logger.warn('ANALYZE post-perf-indexes:', e.message);
  }
} // fin runPostInitMigrations
