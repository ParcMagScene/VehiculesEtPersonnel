// ═══════════════════════════════════════════════════════════════
// migrations/task-alert-rules-v1.js — Alertes sonores sur les taches
// planifiees. Config par section (rdv, courses, chargement, ...).
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

/**
 * @param {import('better-sqlite3').Database} db
 */
export function runTaskAlertRulesMigration(db) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS task_alert_rules (
      section TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      sound_path TEXT NOT NULL DEFAULT '/alert-sounds/bell.wav',
      offset_minutes INTEGER NOT NULL DEFAULT 0,
      blink_duration_sec INTEGER NOT NULL DEFAULT 30,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    // Table d'acquittements par tache/jour. La ligne persiste jusqu'a purge
    // (rollover minuit ou tache changee de statut).
    db.exec(`CREATE TABLE IF NOT EXISTS task_alert_acks (
      task_id TEXT NOT NULL,
      event_date TEXT NOT NULL,
      acked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      acked_by INTEGER,
      PRIMARY KEY (task_id, event_date)
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_task_alert_acks_date ON task_alert_acks(event_date)');

    logger.info('✅ Tables task_alert_rules + task_alert_acks vérifiées/créées');
  } catch (error) {
    logger.warn('⚠️ Migration task_alert_rules:', error.message);
  }
}
