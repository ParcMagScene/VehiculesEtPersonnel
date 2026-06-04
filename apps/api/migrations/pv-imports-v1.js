// ═══════════════════════════════════════════════════════════════
// migrations/pv-imports-v1.js
// Module Import PV (Procès-Verbaux de contrôle) — PDF
//
// Crée :
//   - pv_imports                 : audit immuable de chaque PDF importé.
//                                  Stocke le fichier, le hash SHA-256
//                                  (anti-doublons), les données extraites
//                                  (parsed_data JSON), le statut et la
//                                  résolution (matched_count / unmatched).
//   - equipment_lots_controls    : contrôles de lots (équipements non
//                                  sérialisés) — qty_controlee /
//                                  qty_non_controlee + lien PV.
//
// Les PV liés à un equipment_control existant sont stockés dans la colonne
// JSON `control_history.documents` déjà présente (pas d'ALTER nécessaire).
//
// Idempotent — appelée à chaque démarrage depuis migrations.js
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runPvImportsMigrations(db) {
  try {
    // ── Audit immuable des imports PV ───────────────────────────
    db.prepare(
      `CREATE TABLE IF NOT EXISTS pv_imports (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name       TEXT    NOT NULL,           -- nom stocké sur disque
        original_name   TEXT    NOT NULL,           -- nom upload utilisateur
        file_path       TEXT    NOT NULL,           -- chemin relatif (pv/xxx.pdf)
        file_size       INTEGER NOT NULL,
        file_hash       TEXT    NOT NULL UNIQUE,    -- SHA-256 anti-doublon
        mime_type       TEXT,
        parsed_data     TEXT,                       -- JSON: données extraites
        status          TEXT    NOT NULL DEFAULT 'pending_resolution',
                                                    -- pending_resolution|applied|ignored|error
        matched_count   INTEGER NOT NULL DEFAULT 0,
        unmatched_count INTEGER NOT NULL DEFAULT 0,
        error_message   TEXT,
        applied_at      DATETIME,
        applied_by      TEXT,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by      TEXT
      )`,
    ).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_pv_imports_status ON pv_imports(status)`).run();
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_pv_imports_created ON pv_imports(created_at DESC)`,
    ).run();

    // ── Contrôles par lot (équipements non sérialisés) ──────────
    db.prepare(
      `CREATE TABLE IF NOT EXISTS equipment_lots_controls (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id             INTEGER,             -- nullable si non rattaché
        reference                TEXT,                -- référence catalogue/article
        date_control             DATE    NOT NULL,
        quantite_controlee       INTEGER NOT NULL DEFAULT 0,
        quantite_non_controlee   INTEGER NOT NULL DEFAULT 0,
        organisme                TEXT,
        notes                    TEXT,
        pdf_path                 TEXT,                -- chemin relatif (pv/xxx.pdf)
        pv_import_id             INTEGER,             -- FK pv_imports.id (audit)
        created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by               TEXT,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL,
        FOREIGN KEY (pv_import_id) REFERENCES pv_imports(id) ON DELETE SET NULL
      )`,
    ).run();

    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_lots_controls_equipment ON equipment_lots_controls(equipment_id)`,
    ).run();
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_lots_controls_ref ON equipment_lots_controls(reference)`,
    ).run();
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_lots_controls_date ON equipment_lots_controls(date_control DESC)`,
    ).run();

    logger.info('✅ Migration pv-imports-v1 OK (pv_imports, equipment_lots_controls)');
  } catch (e) {
    logger.error('❌ Migration pv-imports-v1 ÉCHOUÉE:', e);
    throw e;
  }
}
