-- 0014_tracking_incidents_block_legacy_vehicle_id_writes.sql
-- Hardens transition away from tracking_incident_entries.vehicle_id legacy writes.
-- Legacy vehicle_id can still exist for compatibility, but new writes must provide
-- canonical vehicle_id_text so sync/guards remain deterministic.

CREATE TRIGGER IF NOT EXISTS trg_tie_block_legacy_vehicle_id_insert
BEFORE INSERT ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id IS NOT NULL
  AND (NEW.vehicle_id_text IS NULL OR TRIM(NEW.vehicle_id_text) = '')
BEGIN
  SELECT RAISE(ABORT, 'legacy_vehicle_id_requires_vehicle_id_text');
END;

CREATE TRIGGER IF NOT EXISTS trg_tie_block_legacy_vehicle_id_update
BEFORE UPDATE OF vehicle_id ON tracking_incident_entries
FOR EACH ROW
WHEN NEW.vehicle_id IS NOT NULL
  AND (NEW.vehicle_id_text IS NULL OR TRIM(NEW.vehicle_id_text) = '')
BEGIN
  SELECT RAISE(ABORT, 'legacy_vehicle_id_requires_vehicle_id_text');
END;
