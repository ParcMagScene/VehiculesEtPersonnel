-- ═══════════════════════════════════════════════════════════════
-- 0015_forfait_jours.sql
-- Ajout des colonnes forfait-jours sur persons + jours fériés France
-- pour les années 2028 à 2030 (algorithme Butcher pour Pâques).
-- Réf : Code du travail L.3121-58 à L.3121-66.
-- ═══════════════════════════════════════════════════════════════

-- ─── Colonnes persons : configuration forfait-jours ───
-- SQLite ne permet pas plusieurs ADD COLUMN dans un même ALTER : une par une.
-- Toutes les colonnes sont nullable ou avec un DEFAULT — pas de rupture pour
-- les personnes non-cadres qui laissent tout à NULL/0.

ALTER TABLE persons ADD COLUMN is_forfait_jours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE persons ADD COLUMN forfait_jours_annual INTEGER;
ALTER TABLE persons ADD COLUMN forfait_jours_reduced_pct REAL;
ALTER TABLE persons ADD COLUMN forfait_annual_salary REAL;
ALTER TABLE persons ADD COLUMN forfait_rachat_majoration_pct REAL NOT NULL DEFAULT 10.0;
ALTER TABLE persons ADD COLUMN forfait_start_date TEXT;
ALTER TABLE persons ADD COLUMN forfait_end_date TEXT;

CREATE INDEX IF NOT EXISTS idx_persons_forfait ON persons(is_forfait_jours);

-- ─── Jours fériés France 2028-2030 ───
-- Les années 2025-2027 sont déjà seedées dans database.js.
-- Dates calculées : Pâques par algorithme de Butcher (Meeus/Jones/Butcher).
--   Pâques 2028 = 16 avril → Lundi 17 avril / Ascension = J+39 / Pentecôte = J+50
--   Pâques 2029 = 1er avril → Lundi 2 avril / Ascension = 10 mai / Pentecôte lundi = 21 mai
--   Pâques 2030 = 21 avril → Lundi 22 avril / Ascension = 30 mai / Pentecôte lundi = 10 juin
INSERT OR IGNORE INTO public_holidays (date, name, year) VALUES
  ('2028-01-01', 'Jour de l''An',        2028),
  ('2028-04-17', 'Lundi de Pâques',      2028),
  ('2028-05-01', 'Fête du Travail',      2028),
  ('2028-05-08', 'Victoire 1945',        2028),
  ('2028-05-25', 'Ascension',            2028),
  ('2028-06-05', 'Lundi de Pentecôte',   2028),
  ('2028-07-14', 'Fête Nationale',       2028),
  ('2028-08-15', 'Assomption',           2028),
  ('2028-11-01', 'Toussaint',            2028),
  ('2028-11-11', 'Armistice 1918',       2028),
  ('2028-12-25', 'Noël',                 2028),

  ('2029-01-01', 'Jour de l''An',        2029),
  ('2029-04-02', 'Lundi de Pâques',      2029),
  ('2029-05-01', 'Fête du Travail',      2029),
  ('2029-05-08', 'Victoire 1945',        2029),
  ('2029-05-10', 'Ascension',            2029),
  ('2029-05-21', 'Lundi de Pentecôte',   2029),
  ('2029-07-14', 'Fête Nationale',       2029),
  ('2029-08-15', 'Assomption',           2029),
  ('2029-11-01', 'Toussaint',            2029),
  ('2029-11-11', 'Armistice 1918',       2029),
  ('2029-12-25', 'Noël',                 2029),

  ('2030-01-01', 'Jour de l''An',        2030),
  ('2030-04-22', 'Lundi de Pâques',      2030),
  ('2030-05-01', 'Fête du Travail',      2030),
  ('2030-05-08', 'Victoire 1945',        2030),
  ('2030-05-30', 'Ascension',            2030),
  ('2030-06-10', 'Lundi de Pentecôte',   2030),
  ('2030-07-14', 'Fête Nationale',       2030),
  ('2030-08-15', 'Assomption',           2030),
  ('2030-11-01', 'Toussaint',            2030),
  ('2030-11-11', 'Armistice 1918',       2030),
  ('2030-12-25', 'Noël',                 2030);
