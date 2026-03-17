-- ============================================================
-- MODULE PLANNING PERSONNEL — MagLog 1.0
-- Migration : add_personnel_module.sql
-- Date : 2026-02-09
-- ============================================================

-- ──────────────────────────────────────
-- Table : persons (personnel)
-- Types : salarié, technicien, conducteur, intermittent, indépendant
-- Lien optionnel vers users (compte app) et drivers (conducteur existant)
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type TEXT NOT NULL DEFAULT 'technicien',
    -- valeurs : salarié, technicien, conducteur, intermittent, indépendant
  status TEXT NOT NULL DEFAULT 'active',
    -- valeurs : active, inactive
  user_id INTEGER,
    -- lien optionnel vers un compte utilisateur de l'app
  driver_id INTEGER,
    -- lien optionnel vers un conducteur existant
  license_types TEXT DEFAULT '[]',
    -- JSON array : ["VL", "PL", "SPL", "EB", "C", "CE"]
  certifications TEXT DEFAULT '[]',
    -- JSON array : ["CACES", "habilitation_electrique", "SST", "travail_en_hauteur"]
  notes TEXT,
  photo TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_by INTEGER,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (modified_by) REFERENCES users(id)
);

-- ──────────────────────────────────────
-- Table : skills (compétences référentiel)
-- Catégories : son, lumière, plateau, vidéo, conduite, logistique, régie
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'autre',
    -- valeurs : son, lumière, plateau, vidéo, conduite, logistique, régie, autre
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────
-- Table : person_skills (liaison personnes ↔ compétences)
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS person_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  level TEXT DEFAULT 'intermédiaire',
    -- valeurs : débutant, intermédiaire, confirmé, expert
  UNIQUE(person_id, skill_id),
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────
-- Table : availabilities (disponibilités / indisponibilités)
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS availabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_period TEXT DEFAULT 'AM',
    -- AM = matin, PM = après-midi (cohérent avec reservations)
  end_period TEXT DEFAULT 'PM',
  type TEXT NOT NULL DEFAULT 'unavailable',
    -- valeurs : available, unavailable
  reason TEXT,
    -- ex : congés, maladie, formation, disponible semaine paire...
  source TEXT NOT NULL DEFAULT 'admin',
    -- valeurs : self (déclaré par la personne), admin (imposé)
  is_recurring BOOLEAN DEFAULT 0,
  recurrence_rule TEXT,
    -- JSON : {"frequency": "weekly", "days": [1,3,5], "until": "2026-12-31"}
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ──────────────────────────────────────
-- Table : missions
-- Peut être liée à une réservation existante OU indépendante
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  reservation_id TEXT,
    -- lien optionnel vers une réservation existante
  client_name TEXT,
  location_name TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT,
    -- format HH:MM
  end_time TEXT,
    -- format HH:MM
  position TEXT,
    -- poste : régisseur, technicien son, technicien lumière, machiniste, chauffeur…
  required_skill_id INTEGER,
    -- compétence requise (optionnel)
  vehicle_id TEXT,
    -- véhicule associé (optionnel)
  status TEXT NOT NULL DEFAULT 'draft',
    -- valeurs : draft, open, staffed, in_progress, completed, cancelled
  notes TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_by INTEGER,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  FOREIGN KEY (required_skill_id) REFERENCES skills(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (modified_by) REFERENCES users(id)
);

-- ──────────────────────────────────────
-- Table : mission_assignments (affectations)
-- Lie une personne à une mission avec un workflow de statut
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
    -- workflow : proposed → option → confirmed / refused / cancelled
  position TEXT,
    -- poste spécifique pour cette affectation (peut différer de la mission)
  comment TEXT,
  responded_at DATETIME,
    -- quand la personne a répondu (confirmé/refusé)
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_by INTEGER,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mission_id, person_id),
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (modified_by) REFERENCES users(id)
);

-- ──────────────────────────────────────
-- Index de performance
-- ──────────────────────────────────────

-- persons : recherche par type et statut
CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(type);
CREATE INDEX IF NOT EXISTS idx_persons_status ON persons(status);
CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id);
CREATE INDEX IF NOT EXISTS idx_persons_driver_id ON persons(driver_id);

-- person_skills : recherche par personne ou par compétence
CREATE INDEX IF NOT EXISTS idx_person_skills_person ON person_skills(person_id);
CREATE INDEX IF NOT EXISTS idx_person_skills_skill ON person_skills(skill_id);

-- availabilities : recherche par personne et plage de dates
CREATE INDEX IF NOT EXISTS idx_availabilities_person ON availabilities(person_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_dates ON availabilities(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_availabilities_type ON availabilities(type);

-- missions : recherche par dates, statut, réservation
CREATE INDEX IF NOT EXISTS idx_missions_dates ON missions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_reservation ON missions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_missions_vehicle ON missions(vehicle_id);

-- mission_assignments : recherche par mission, personne, statut
CREATE INDEX IF NOT EXISTS idx_assignments_mission ON mission_assignments(mission_id);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON mission_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON mission_assignments(status);

-- ──────────────────────────────────────
-- Données initiales : compétences de base
-- ──────────────────────────────────────
INSERT OR IGNORE INTO skills (name, category, description) VALUES
  ('Sonorisation', 'son', 'Installation et réglage de systèmes de sonorisation'),
  ('Mixage live', 'son', 'Mixage en direct pour événements'),
  ('Backline', 'son', 'Installation et gestion du backline'),
  ('Éclairage scénique', 'lumière', 'Conception et conduite lumière'),
  ('Poursuite', 'lumière', 'Opérateur poursuite'),
  ('LED / Écrans', 'vidéo', 'Installation et gestion d''écrans LED'),
  ('Régie vidéo', 'vidéo', 'Régie vidéo live et diffusion'),
  ('Montage structure', 'plateau', 'Montage de scènes et structures'),
  ('Rigging', 'plateau', 'Accroche et levage de matériel'),
  ('Machinerie', 'plateau', 'Opérations de machinerie scénique'),
  ('Régie générale', 'régie', 'Coordination technique générale'),
  ('Régie plateau', 'régie', 'Gestion du plateau et des changements'),
  ('Conduite VL', 'conduite', 'Conduite de véhicules légers'),
  ('Conduite PL', 'conduite', 'Conduite de poids lourds'),
  ('Conduite SPL', 'conduite', 'Conduite de super poids lourds'),
  ('Manutention', 'logistique', 'Chargement / déchargement'),
  ('CACES', 'logistique', 'Conduite d''engins de chantier / nacelle'),
  ('Électricité', 'logistique', 'Habilitation électrique');
