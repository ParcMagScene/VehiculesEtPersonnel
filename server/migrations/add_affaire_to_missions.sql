-- Add 'affaire' column to missions table for direct affaire<->mission linking
-- (missions created from AffaireDetailPanel often have no reservation_id)
ALTER TABLE missions ADD COLUMN affaire TEXT;

-- Backfill: extract affaire number from mission title (e.g. "AF32512 — ...")
UPDATE missions
SET affaire = UPPER(SUBSTR(title, 1, INSTR(title, ' ') - 1))
WHERE title LIKE 'AF%' AND affaire IS NULL;

-- Index for fast lookup by affaire
CREATE INDEX IF NOT EXISTS idx_missions_affaire ON missions(affaire);
