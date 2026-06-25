-- 0008_add_missing_fk_support_indexes.sql
-- Adds indexes for FK columns missing a leading index.
-- Improves join/delete/update cost on referenced rows.

CREATE INDEX IF NOT EXISTS idx_affaire_history_user_id
  ON affaire_history(user_id);

CREATE INDEX IF NOT EXISTS idx_equipment_lots_controls_pv_import_id
  ON equipment_lots_controls(pv_import_id);

CREATE INDEX IF NOT EXISTS idx_personal_actions_log_person_id
  ON personal_actions_log(person_id);
