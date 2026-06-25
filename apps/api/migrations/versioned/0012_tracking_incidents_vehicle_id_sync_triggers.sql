-- 0012_tracking_incidents_vehicle_id_sync_triggers.sql
-- Keeps tracking_incident_entries.vehicle_id (legacy INTEGER)
-- and tracking_incident_entries.vehicle_id_text (canonical TEXT) synchronized.
--
-- Notes:
-- - 0011 already added vehicle_id_text + referential guards.
-- - This migration is additive and backward-compatible.

-- On INSERT: derive vehicle_id_text from legacy vehicle_id when missing.
CREATE TRIGGER IF NOT EXISTS trg_tie_sync_ids_after_insert
AFTER INSERT ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id_text IS NULL AND NEW.vehicle_id IS NOT NULL
BEGIN
  UPDATE tracking_incident_entries
  SET vehicle_id_text = (
    SELECT v.id
    FROM vehicles v
    WHERE v.id = CAST(NEW.vehicle_id AS TEXT)
       OR CAST(v.id AS INTEGER) = NEW.vehicle_id
    ORDER BY CASE WHEN v.id = CAST(NEW.vehicle_id AS TEXT) THEN 0 ELSE 1 END
    LIMIT 1
  )
  WHERE rowid = NEW.rowid;
END;

-- On INSERT: derive legacy vehicle_id when possible from vehicle_id_text.
CREATE TRIGGER IF NOT EXISTS trg_tie_sync_legacy_after_insert
AFTER INSERT ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id IS NULL AND NEW.vehicle_id_text IS NOT NULL
BEGIN
  UPDATE tracking_incident_entries
  SET vehicle_id = (
    SELECT CASE
             WHEN v.id GLOB '[0-9]*' THEN CAST(v.id AS INTEGER)
             ELSE NULL
           END
    FROM vehicles v
    WHERE v.id = NEW.vehicle_id_text
    LIMIT 1
  )
  WHERE rowid = NEW.rowid;
END;

-- On UPDATE of legacy vehicle_id: refresh vehicle_id_text if missing or divergent.
CREATE TRIGGER IF NOT EXISTS trg_tie_sync_ids_after_update_legacy
AFTER UPDATE OF vehicle_id ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id IS NOT NULL
BEGIN
  UPDATE tracking_incident_entries
  SET vehicle_id_text = (
    SELECT v.id
    FROM vehicles v
    WHERE v.id = CAST(NEW.vehicle_id AS TEXT)
       OR CAST(v.id AS INTEGER) = NEW.vehicle_id
    ORDER BY CASE WHEN v.id = CAST(NEW.vehicle_id AS TEXT) THEN 0 ELSE 1 END
    LIMIT 1
  )
  WHERE rowid = NEW.rowid;
END;

-- On UPDATE of vehicle_id_text: refresh legacy vehicle_id when representable.
CREATE TRIGGER IF NOT EXISTS trg_tie_sync_legacy_after_update_text
AFTER UPDATE OF vehicle_id_text ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id_text IS NOT NULL
BEGIN
  UPDATE tracking_incident_entries
  SET vehicle_id = (
    SELECT CASE
             WHEN v.id GLOB '[0-9]*' THEN CAST(v.id AS INTEGER)
             ELSE NULL
           END
    FROM vehicles v
    WHERE v.id = NEW.vehicle_id_text
    LIMIT 1
  )
  WHERE rowid = NEW.rowid;
END;
