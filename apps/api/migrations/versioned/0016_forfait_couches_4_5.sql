-- ═══════════════════════════════════════════════════════════════
-- 0016_forfait_couches_4_5.sql
-- Couches 4 & 5 du module forfait-jours :
--   • Éligibilité niveau + rémunération min (Art. 5.7.1)
--   • Entretiens annuel & semestriel (Art. 5.7.4)
--   • Droit d'alerte / dispositif de veille (Art. 5.7.5)
--   • Poses de repos & pointages 1/2j (Art. 5.7.3)
-- Réf. avenant n° 3 du 22-4-2025 (JO 12-6-2026, applicable au 17-5-2025).
-- ═══════════════════════════════════════════════════════════════

-- ─── Éligibilité forfait sur persons ───
ALTER TABLE persons ADD COLUMN classification_level INTEGER;
ALTER TABLE persons ADD COLUMN forfait_min_annual_salary REAL;

-- ─── Entretiens obligatoires (annuel & semestriel) ───
CREATE TABLE IF NOT EXISTS forfait_entretiens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('annuel', 'semestriel')),
  scheduled_date TEXT,
  held_date TEXT,
  workload_ok INTEGER,
  work_life_balance_ok INTEGER,
  compensation_ok INTEGER,
  comments TEXT,
  next_actions TEXT,
  document_path TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'held', 'skipped', 'overdue')),
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_by INTEGER,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_forfait_entretiens_person
  ON forfait_entretiens(person_id, year);
CREATE INDEX IF NOT EXISTS idx_forfait_entretiens_status
  ON forfait_entretiens(status);

-- ─── Droit d'alerte / dispositif de veille (Art. 5.7.5) ───
CREATE TABLE IF NOT EXISTS forfait_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  alert_date TEXT NOT NULL DEFAULT (date('now')),
  source TEXT NOT NULL DEFAULT 'salarie'
    CHECK (source IN ('salarie', 'employeur', 'medecin_travail', 'crp', 'systeme')),
  category TEXT NOT NULL DEFAULT 'charge_travail'
    CHECK (category IN ('charge_travail', 'amplitude', 'repos', 'deconnexion', 'autre')),
  reason TEXT NOT NULL,
  response TEXT,
  response_date TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_by INTEGER,
  resolved_at DATETIME,
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_forfait_alerts_person
  ON forfait_alerts(person_id, alert_date);
CREATE INDEX IF NOT EXISTS idx_forfait_alerts_status
  ON forfait_alerts(status);

-- ─── Poses de repos & pointages 1/2j (Art. 5.7.3) ───
-- Journée type : > 4h travaillées = 1 jour, ≤ 4h = 0.5 jour.
-- Anti-doublon : (person_id, date, period) UNIQUE.
CREATE TABLE IF NOT EXISTS forfait_rest_poses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  pose_date TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'FULL'
    CHECK (period IN ('AM', 'PM', 'FULL')),
  pose_type TEXT NOT NULL DEFAULT 'repos_conv'
    CHECK (pose_type IN ('repos_conv', 'rachat', 'work', 'conge', 'ferie', 'weekend')),
  hours_worked REAL,
  worked_days_equiv REAL,
  requested_at TEXT,
  requested_by INTEGER,
  approved_at TEXT,
  approved_by INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'confirmed', 'cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(person_id, pose_date, period),
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_forfait_rest_poses_person_date
  ON forfait_rest_poses(person_id, pose_date);
CREATE INDEX IF NOT EXISTS idx_forfait_rest_poses_type
  ON forfait_rest_poses(pose_type);
