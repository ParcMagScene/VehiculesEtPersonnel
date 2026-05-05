// ═══════════════════════════════════════════════════════════════
// migrations/controles-periodiques-v1.js
// Module unifié de contrôles périodiques (équipements + véhicules)
//
// Crée :
//   - control_types          : référentiel des types de contrôle
//   - equipment_controls     : contrôles attachés à une entité
//                              (entity_type = 'vehicle' | 'equipment',
//                               entity_id = id de l'entité)
//   - control_history        : historique immuable (jamais de DELETE)
//   - control_notifications  : journal des envois (anti-doublon)
//
// Migre les contrôles déjà stockés dans vehicles.controles_techniques
// (JSON array : [{type,date,deadline}]) vers equipment_controls.
//
// Idempotent — appelée à chaque démarrage depuis migrations.js
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

/** Types standards seedés au premier lancement (idempotent via INSERT OR IGNORE). */
const SEED_TYPES = [
  // Véhicules
  {
    code: 'CT',
    name: 'Contrôle Technique',
    is_vehicle_specific: 1,
    default_periodicity_days: 365,
    missed_after_days: 60,
  },
  {
    code: 'TACHYGRAPHE',
    name: 'Tachygraphe',
    is_vehicle_specific: 1,
    default_periodicity_days: 365 * 2,
    missed_after_days: 60,
  },
  {
    code: 'LIMITEUR',
    name: 'Limiteur de vitesse',
    is_vehicle_specific: 1,
    default_periodicity_days: 365 * 2,
    missed_after_days: 60,
  },
  {
    code: 'ASSURANCE',
    name: 'Assurance',
    is_vehicle_specific: 1,
    default_periodicity_days: 365,
    missed_after_days: 30,
  },
  {
    code: 'REVISION',
    name: 'Révision constructeur',
    is_vehicle_specific: 1,
    default_periodicity_days: 365,
    missed_after_days: 60,
  },
  // Équipements scéniques (génériques)
  {
    code: 'LEVAGE',
    name: 'Vérification levage (palans, élingues)',
    is_vehicle_specific: 0,
    default_periodicity_days: 365,
    missed_after_days: 30,
  },
  {
    code: 'ELECTRIQUE',
    name: 'Vérification électrique',
    is_vehicle_specific: 0,
    default_periodicity_days: 365,
    missed_after_days: 30,
  },
  {
    code: 'DMX',
    name: 'Test DMX / fonctionnel',
    is_vehicle_specific: 0,
    default_periodicity_days: 180,
    missed_after_days: 60,
  },
  {
    code: 'SECURITE',
    name: 'Contrôle sécurité',
    is_vehicle_specific: 0,
    default_periodicity_days: 365,
    missed_after_days: 30,
  },
  {
    code: 'AUTRE',
    name: 'Autre contrôle',
    is_vehicle_specific: 0,
    default_periodicity_days: 365,
    missed_after_days: 30,
  },
];

/**
 * Convertit une date string YYYY-MM-DD ou ISO en ISO date (sans time).
 * Retourne null si invalide.
 */
function toIsoDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Accepte YYYY-MM-DD, DD/MM/YYYY, ISO
  let d;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) d = new Date(s);
  else if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(s)) {
    const [, dd, mm, yyyy] = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function runControlesPeriodiquesMigrations(db) {
  // ─── 1. control_types ───
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS control_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        default_periodicity_days INTEGER NOT NULL DEFAULT 365,
        missed_after_days INTEGER NOT NULL DEFAULT 30,
        is_vehicle_specific INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed
    const ins = db.prepare(`
      INSERT OR IGNORE INTO control_types
        (code, name, default_periodicity_days, missed_after_days, is_vehicle_specific)
      VALUES (?, ?, ?, ?, ?)
    `);
    let seeded = 0;
    for (const t of SEED_TYPES) {
      const r = ins.run(
        t.code,
        t.name,
        t.default_periodicity_days,
        t.missed_after_days,
        t.is_vehicle_specific,
      );
      if (r.changes > 0) seeded++;
    }
    if (seeded > 0) logger.info(`  ✅ Contrôles périodiques: ${seeded} types seedés`);
  } catch (e) {
    logger.warn('Contrôles périodiques control_types:', e.message);
  }

  // ─── 2. equipment_controls (polymorphique vehicle|equipment) ───
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS equipment_controls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('vehicle', 'equipment')),
        entity_id TEXT NOT NULL,                 -- vehicles.id (TEXT) ou equipment.id (INTEGER stringifié)
        control_type_id INTEGER NOT NULL REFERENCES control_types(id),
        periodicity_days INTEGER NOT NULL,       -- snapshot, peut diverger du type
        next_due_date TEXT NOT NULL,             -- YYYY-MM-DD
        last_done_date TEXT,                     -- YYYY-MM-DD ou NULL
        status TEXT NOT NULL DEFAULT 'A_FAIRE',  -- A_FAIRE | EN_RETARD | MANQUE | EFFECTUE
        assigned_to INTEGER REFERENCES users(id),
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,    -- soft-delete (jamais de DELETE physique)
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_equipment_controls_entity
       ON equipment_controls(entity_type, entity_id) WHERE is_active = 1`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_equipment_controls_due
       ON equipment_controls(next_due_date) WHERE is_active = 1`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_equipment_controls_assigned
       ON equipment_controls(assigned_to) WHERE is_active = 1`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_equipment_controls_status
       ON equipment_controls(status) WHERE is_active = 1`,
    );
  } catch (e) {
    logger.warn('Contrôles périodiques equipment_controls:', e.message);
  }

  // ─── 3. control_history (immuable) ───
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS control_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_control_id INTEGER NOT NULL REFERENCES equipment_controls(id),
        performed_at TEXT NOT NULL,              -- YYYY-MM-DD
        performed_by INTEGER REFERENCES users(id),
        status TEXT NOT NULL,                    -- EFFECTUE | MANQUE | RETARD | ANNULE
        previous_due_date TEXT,
        next_due_date TEXT,
        notes TEXT,
        documents TEXT,                          -- JSON: [{name,url,size,type}, ...]
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_control_history_control
       ON control_history(equipment_control_id, performed_at DESC)`,
    );
  } catch (e) {
    logger.warn('Contrôles périodiques control_history:', e.message);
  }

  // ─── 4. control_notifications ───
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS control_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_control_id INTEGER NOT NULL REFERENCES equipment_controls(id),
        type TEXT NOT NULL,                      -- REMINDER_30 | REMINDER_7 | REMINDER_1 | LATE | MISSED
        recipient_id INTEGER REFERENCES users(id),
        recipient_email TEXT,
        for_due_date TEXT NOT NULL,              -- snapshot pour anti-doublon
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        success INTEGER DEFAULT 1
      )
    `);
    // Anti-doublon : 1 notification de chaque type par échéance & destinataire
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_control_notifications_unique
       ON control_notifications(equipment_control_id, type, for_due_date, recipient_id)`,
    );
  } catch (e) {
    logger.warn('Contrôles périodiques control_notifications:', e.message);
  }

  // ─── 5. Migration : email_config.alert_controles ───
  try {
    const cols = db.pragma('table_info(email_config)').map((c) => c.name);
    if (!cols.includes('alert_controles')) {
      db.exec('ALTER TABLE email_config ADD COLUMN alert_controles BOOLEAN DEFAULT 1');
      logger.info('  ✅ Contrôles périodiques: email_config.alert_controles ajouté');
    }
  } catch (e) {
    logger.warn('Contrôles périodiques email_config:', e.message);
  }

  // ─── 6. Migration data : vehicles.controles_techniques (JSON) → equipment_controls ───
  try {
    // Marqueur pour ne migrer qu'une seule fois (les contrôles peuvent ensuite évoluer
    // côté equipment_controls — on ne veut pas écraser).
    const alreadyMigrated = db
      .prepare(
        "SELECT 1 FROM equipment_controls WHERE entity_type='vehicle' AND notes LIKE '[migrated:v1]%' LIMIT 1",
      )
      .get();
    if (alreadyMigrated) {
      // déjà fait
    } else {
      const rows = db
        .prepare(
          "SELECT id, name, controles_techniques FROM vehicles WHERE controles_techniques IS NOT NULL AND controles_techniques != '[]' AND controles_techniques != ''",
        )
        .all();

      if (rows.length === 0) {
        // rien à migrer
      } else {
        // Mappe les codes legacy vers nos types
        const typeRow = (code) =>
          db
            .prepare('SELECT id, default_periodicity_days FROM control_types WHERE code = ?')
            .get(code);
        const typeAutre = typeRow('AUTRE');
        const insCtrl = db.prepare(`
          INSERT INTO equipment_controls
            (entity_type, entity_id, control_type_id, periodicity_days,
             next_due_date, last_done_date, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insHist = db.prepare(`
          INSERT INTO control_history
            (equipment_control_id, performed_at, status, next_due_date, notes)
          VALUES (?, ?, ?, ?, ?)
        `);

        let migrated = 0;
        const today = new Date().toISOString().slice(0, 10);

        const tx = db.transaction(() => {
          for (const v of rows) {
            let arr;
            try {
              arr = JSON.parse(v.controles_techniques);
            } catch {
              continue;
            }
            if (!Array.isArray(arr)) continue;

            for (const c of arr) {
              const code = String(c.type || '')
                .toUpperCase()
                .trim();
              if (!code) continue;
              const type = typeRow(code) || typeAutre;
              if (!type) continue;

              const lastDone = toIsoDate(c.date);
              let due = toIsoDate(c.deadline);
              // Si pas de deadline, on calcule depuis last_done + périodicité
              if (!due && lastDone) {
                const d = new Date(lastDone);
                d.setDate(d.getDate() + (type.default_periodicity_days || 365));
                due = d.toISOString().slice(0, 10);
              }
              if (!due) continue;

              const status =
                lastDone && due > today ? 'EFFECTUE' : due < today ? 'EN_RETARD' : 'A_FAIRE';

              const r = insCtrl.run(
                'vehicle',
                String(v.id),
                type.id,
                type.default_periodicity_days || 365,
                due,
                lastDone,
                status,
                `[migrated:v1] ${code} · ${v.name || ''}`.trim(),
              );
              // Trace immuable de la migration
              if (lastDone) {
                insHist.run(r.lastInsertRowid, lastDone, 'EFFECTUE', due, '[import migration v1]');
              }
              migrated++;
            }
          }
        });
        tx();
        if (migrated > 0)
          logger.info(`  ✅ Contrôles périodiques: ${migrated} contrôles véhicules migrés`);
      }
    }
  } catch (e) {
    logger.warn('Contrôles périodiques migration véhicules:', e.message);
  }

  logger.info('✅ Migration controles-periodiques-v1 terminée');
}
