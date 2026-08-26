-- 0007_drop_remaining_duplicate_indexes.sql
-- Removes strict duplicate indexes (same table + same indexed columns + same partial flag).
-- Safe/idempotent cleanup after schema drift from mixed migration strategies.

-- active_sessions duplicates
DROP INDEX IF EXISTS idx_sessions_expires;
DROP INDEX IF EXISTS idx_sessions_token;

-- bl_imports duplicates
DROP INDEX IF EXISTS idx_bl_affaire;

-- modification_history duplicates
DROP INDEX IF EXISTS idx_history_timestamp;
DROP INDEX IF EXISTS idx_history_entity;

ANALYZE;
