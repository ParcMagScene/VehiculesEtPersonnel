// ═══════════════════════════════════════════════════════════════
// migrations.js — Migrations post-initialisation de la base de données
// Migrations ALTER TABLE, CREATE TABLE additionnelles, index de performance
// Exécutées après initializeDatabase() dans database.js
// ═══════════════════════════════════════════════════════════════

import logger from './logger.js';

export function runPostInitMigrations(db) {

// [AUDIT FIX P0-5] Migration : ajouter colonne 'type' à locations (si absente)
try {
  const locCols = db.pragma('table_info(locations)').map(c => c.name);
  if (!locCols.includes('type')) {
    db.exec("ALTER TABLE locations ADD COLUMN type TEXT DEFAULT 'Salle de spectacle'");
    logger.info('  ✅ Migration: locations.type ajouté');
  }
} catch (e) {
  logger.warn('Migration locations.type:', e.message);
}

// ═══ Migration : RDV avec horaires précis, catégorie Pro/Perso, et sync Google Calendar ═══
try {
  const availCols = db.prepare("PRAGMA table_info(availabilities)").all().map(c => c.name);
  if (!availCols.includes('start_time')) {
    db.prepare("ALTER TABLE availabilities ADD COLUMN start_time TEXT").run();
    logger.info('✅ Migration: colonne start_time ajoutée à availabilities');
  }
  if (!availCols.includes('end_time')) {
    db.prepare("ALTER TABLE availabilities ADD COLUMN end_time TEXT").run();
    logger.info('✅ Migration: colonne end_time ajoutée à availabilities');
  }
  if (!availCols.includes('rdv_category')) {
    db.prepare("ALTER TABLE availabilities ADD COLUMN rdv_category TEXT").run();
    logger.info('✅ Migration: colonne rdv_category ajoutée à availabilities');
  }
  if (!availCols.includes('google_event_id')) {
    db.prepare("ALTER TABLE availabilities ADD COLUMN google_event_id TEXT").run();
    logger.info('✅ Migration: colonne google_event_id ajoutée à availabilities');
  }
} catch (error) {
  logger.warn('⚠️ Migration RDV horaires:', error.message);
}

// ═══ Migration : order_items — colonnes source_affaire_id, source_requester_id, source_requester_name ═══
try {
  const oiCols = db.prepare("PRAGMA table_info(order_items)").all().map(c => c.name);
  if (!oiCols.includes('source_affaire_id')) {
    db.prepare("ALTER TABLE order_items ADD COLUMN source_affaire_id TEXT").run();
    logger.info('✅ Migration: colonne source_affaire_id ajoutée à order_items');
  }
  if (!oiCols.includes('source_requester_id')) {
    db.prepare("ALTER TABLE order_items ADD COLUMN source_requester_id INTEGER").run();
    logger.info('✅ Migration: colonne source_requester_id ajoutée à order_items');
  }
  if (!oiCols.includes('source_requester_name')) {
    db.prepare("ALTER TABLE order_items ADD COLUMN source_requester_name TEXT").run();
    logger.info('✅ Migration: colonne source_requester_name ajoutée à order_items');
  }
  if (!oiCols.includes('source_type')) {
    db.prepare("ALTER TABLE order_items ADD COLUMN source_type TEXT DEFAULT 'affaire'").run();
    logger.info('✅ Migration: colonne source_type ajoutée à order_items');
  }
  if (!oiCols.includes('ref_code')) {
    db.prepare("ALTER TABLE order_items ADD COLUMN ref_code TEXT").run();
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
    destination TEXT DEFAULT 'Stock Mag Scène',
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
  db.exec('CREATE INDEX IF NOT EXISTS idx_material_requests_requested_by ON material_requests(requested_by)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_material_requests_affaire ON material_requests(affaire_id)');
  logger.info('✅ Table material_requests vérifiée/créée');
} catch (error) {
  logger.warn('⚠️ Migration material_requests:', error.message);
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
  db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON supplier_documents(supplier_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_documents_order ON supplier_documents(order_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_documents_type ON supplier_documents(doc_type)');
  logger.info('✅ Table supplier_documents vérifiée/créée');
} catch (error) {
  logger.warn('⚠️ Migration supplier_documents:', error.message);
}

// ═══ Migration : order_items — colonnes received_date, delivery_note_id ═══
try {
  const oiCols2 = db.prepare("PRAGMA table_info(order_items)").all().map(c => c.name);
  if (!oiCols2.includes('received_date')) {
    db.prepare("ALTER TABLE order_items ADD COLUMN received_date TEXT").run();
    logger.info('✅ Migration: colonne received_date ajoutée à order_items');
  }
  if (!oiCols2.includes('delivery_note_id')) {
    db.prepare("ALTER TABLE order_items ADD COLUMN delivery_note_id INTEGER").run();
    logger.info('✅ Migration: colonne delivery_note_id ajoutée à order_items');
  }
} catch (error) {
  logger.warn('⚠️ Migration order_items delivery:', error.message);
}

// ═══ Migration : orders — colonnes workflow_status, completion_notified ═══
try {
  const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  if (!orderCols.includes('completion_notified')) {
    db.prepare("ALTER TABLE orders ADD COLUMN completion_notified INTEGER DEFAULT 0").run();
    logger.info('✅ Migration: colonne completion_notified ajoutée à orders');
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
  db.exec('CREATE INDEX IF NOT EXISTS idx_completion_alerts_recipient ON completion_alerts(recipient_id, is_read)');
  logger.info('✅ Table completion_alerts vérifiée/créée');
} catch (error) {
  logger.warn('⚠️ Migration completion_alerts:', error.message);
}

// Migration ONE-TIME: Masquer les RDV/événements existants sur l'écran TV (visible=0)
try {
  const rdvMigApplied = db.prepare("SELECT 1 FROM migrations_log WHERE name = ?").get('hide_rdv_events_on_tv');
  if (!rdvMigApplied) {
    const result = db.prepare(
      "UPDATE task_assignments SET visible = 0 WHERE section IN ('rdv', 'evenements') AND visible = 1"
    ).run();
    db.prepare("INSERT INTO migrations_log (name) VALUES (?)").run('hide_rdv_events_on_tv');
    logger.info(`✅ Migration hide_rdv_events_on_tv: ${result.changes} tâche(s) RDV/événements masquées sur TV`);
  }
} catch (error) {
  logger.warn('⚠️ Migration hide_rdv_events_on_tv:', error.message);
}

// Migration : ajouter prep_tournees au CHECK constraint de task_assignments
try {
  const checkInfo5 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'").get();
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
    const oldCols5 = db.pragma('table_info(task_assignments)').map(c => c.name);
    const newCols5 = db.pragma('table_info(task_assignments_new)').map(c => c.name);
    const commonCols5 = oldCols5.filter(c => newCols5.includes(c)).join(', ');
    db.exec(`INSERT INTO task_assignments_new (${commonCols5}) SELECT ${commonCols5} FROM task_assignments`);
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
  try { db.exec('ROLLBACK'); } catch(e) {}
  logger.warn('Migration prep_tournees:', migErr5.message);
}

// Migration : ajouter ical_event au CHECK constraint source_type de task_assignments
try {
  const checkInfo6 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'").get();
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
    const oldCols6 = db.pragma('table_info(task_assignments)').map(c => c.name);
    const newCols6 = db.pragma('table_info(task_assignments_new)').map(c => c.name);
    const commonCols6 = oldCols6.filter(c => newCols6.includes(c)).join(', ');
    db.exec(`INSERT INTO task_assignments_new (${commonCols6}) SELECT ${commonCols6} FROM task_assignments`);
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
  try { db.exec('ROLLBACK'); } catch(e) {}
  logger.warn('Migration ical_event source_type:', migErr6.message);
}

// Migration : ajouter montage/demontage au CHECK constraint de task_assignments
try {
  const checkInfo7 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'").get();
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
    const oldCols7 = db.pragma('table_info(task_assignments)').map(c => c.name);
    const newCols7 = db.pragma('table_info(task_assignments_new)').map(c => c.name);
    const commonCols7 = oldCols7.filter(c => newCols7.includes(c)).join(', ');
    db.exec(`INSERT INTO task_assignments_new (${commonCols7}) SELECT ${commonCols7} FROM task_assignments`);
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
  try { db.exec('ROLLBACK'); } catch(e) {}
  logger.warn('Migration montage/demontage:', migErr7.message);
}

// ── Migration : soft delete task_assignments (deleted_at) ──
try {
  const taCols = db.pragma('table_info(task_assignments)').map(c => c.name);
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
    const icalCols = db.pragma('table_info(ical_calendars)').map(c => c.name);
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
  try { db.exec(sql); idxOk++; } catch (_) { /* colonne absente — ignoré */ }
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
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations_log (key TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migrationKey);
  if (!already) {
    const result = db.prepare(`
      UPDATE affaires SET type = 'Location'
      WHERE google_event_id IS NOT NULL
        AND type = 'Prestation'
        AND LOWER(COALESCE(nom, '') || ' ' || COALESCE(event_name, '') || ' ' || COALESCE(titre, ''))
            NOT LIKE '%vente%'
        AND LOWER(COALESCE(nom, '') || ' ' || COALESCE(event_name, '') || ' ' || COALESCE(titre, ''))
            NOT LIKE '%presta%'
    `).run();
    db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migrationKey);
    logger.info(`✅ Migration ${migrationKey}: ${result.changes} affaire(s) corrigée(s) de Prestation → Location`);
  }
} catch (e) {
  logger.warn('⚠️ Migration google_affaires_type_location:', e.message);
}

} // fin runPostInitMigrations
