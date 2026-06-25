-- 0011_tracking_incidents_vehicle_id_text_bridge.sql
-- Bridge migration for tracking_incident_entries.vehicle_id (INTEGER legacy)
-- toward vehicles.id (TEXT canonical).
--
-- Strategy:
-- 1) add vehicle_id_text (TEXT)
-- 2) backfill from legacy vehicle_id where possible
-- 3) index new column for joins/filters
-- 4) add guard triggers to keep future values referentially valid

ALTER TABLE tracking_incident_entries
  ADD COLUMN vehicle_id_text TEXT;

-- Backfill canonical text id from existing integer legacy values.
-- Prefer exact text match, fallback to numeric equivalence if ids were numeric-like.
WITH mapped AS (
  SELECT
    tie.rowid AS rid,
    MIN(v.id) AS mapped_vehicle_id_text
  FROM tracking_incident_entries tie
  JOIN vehicles v
    ON v.id = CAST(tie.vehicle_id AS TEXT)
    OR CAST(v.id AS INTEGER) = tie.vehicle_id
  WHERE tie.vehicle_id IS NOT NULL
    AND (tie.vehicle_id_text IS NULL OR tie.vehicle_id_text = '')
  GROUP BY tie.rowid
)
UPDATE tracking_incident_entries
SET vehicle_id_text = (
  SELECT mapped_vehicle_id_text
  FROM mapped
  WHERE mapped.rid = tracking_incident_entries.rowid
)
WHERE rowid IN (SELECT rid FROM mapped);

CREATE INDEX IF NOT EXISTS idx_tracking_incident_entries_vehicle_id_text
  ON tracking_incident_entries(vehicle_id_text);

CREATE TRIGGER IF NOT EXISTS trg_tie_vehicle_id_text_guard_insert
BEFORE INSERT ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id_text IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.id = NEW.vehicle_id_text)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_tracking_incident_entries_vehicle_id_text');
END;

CREATE TRIGGER IF NOT EXISTS trg_tie_vehicle_id_text_guard_update
BEFORE UPDATE OF vehicle_id_text ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id_text IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.id = NEW.vehicle_id_text)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_tracking_incident_entries_vehicle_id_text');
END;
