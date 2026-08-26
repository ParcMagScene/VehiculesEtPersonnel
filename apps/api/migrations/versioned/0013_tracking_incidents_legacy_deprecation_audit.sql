-- 0013_tracking_incidents_legacy_deprecation_audit.sql
-- Deprecation preparation for legacy tracking_incident_entries.vehicle_id.
-- Adds audit views to monitor transition quality before removing legacy column.

CREATE VIEW IF NOT EXISTS v_db_audit_tie_legacy_only AS
SELECT *
FROM tracking_incident_entries
WHERE vehicle_id IS NOT NULL
  AND (vehicle_id_text IS NULL OR TRIM(vehicle_id_text) = '');

CREATE VIEW IF NOT EXISTS v_db_audit_tie_text_only AS
SELECT *
FROM tracking_incident_entries
WHERE vehicle_id IS NULL
  AND vehicle_id_text IS NOT NULL
  AND TRIM(vehicle_id_text) <> '';

CREATE VIEW IF NOT EXISTS v_db_audit_tie_unknown_vehicle_text AS
SELECT tie.*
FROM tracking_incident_entries tie
WHERE tie.vehicle_id_text IS NOT NULL
  AND TRIM(tie.vehicle_id_text) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = tie.vehicle_id_text
  );

CREATE VIEW IF NOT EXISTS v_db_audit_tie_legacy_text_mismatch AS
SELECT tie.*
FROM tracking_incident_entries tie
WHERE tie.vehicle_id IS NOT NULL
  AND tie.vehicle_id_text IS NOT NULL
  AND TRIM(tie.vehicle_id_text) <> ''
  AND tie.vehicle_id_text <> CAST(tie.vehicle_id AS TEXT)
  AND NOT EXISTS (
    SELECT 1
    FROM vehicles v
    WHERE v.id = tie.vehicle_id_text
      AND CAST(v.id AS INTEGER) = tie.vehicle_id
  );
