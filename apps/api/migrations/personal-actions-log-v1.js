// ═══════════════════════════════════════════════════════════════
// migrations/personal-actions-log-v1.js
//
// Crée la table d'audit `personal_actions_log` qui trace chaque
// action personnelle (assignation planning, demande de congé,
// indispo) effectuée via authentification éphémère depuis le
// compte Equipe partagé (commun@magsav.com).
//
// Référence : feature « auth éphémère pour actions personnelles ».
// Idempotent.
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runPersonalActionsLogV1Migration(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS personal_actions_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        context_user_id INTEGER NOT NULL,
        personal_user_id INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        payload_summary TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        error_code TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (context_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (personal_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_personal_actions_log_context
        ON personal_actions_log(context_user_id);
      CREATE INDEX IF NOT EXISTS idx_personal_actions_log_personal
        ON personal_actions_log(personal_user_id);
      CREATE INDEX IF NOT EXISTS idx_personal_actions_log_action
        ON personal_actions_log(action_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_personal_actions_log_target
        ON personal_actions_log(target_type, target_id);
    `);

    logger.info('  ✅ Migration personal-actions-log-v1: table + index OK');
  } catch (e) {
    logger.warn('Migration personal-actions-log-v1:', e.message);
  }
}
