-- ═══════════════════════════════════════════════════════════════
-- Migration: Module complet de gestion des congés
-- Conforme Code du travail, IDCC 3252
-- ═══════════════════════════════════════════════════════════════

-- Table principale des demandes de congés
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identité du salarié
  person_id INTEGER NOT NULL,
  user_id INTEGER,                    -- Lien vers users (si le salarié a un compte)

  -- Dates de la demande
  request_date TEXT NOT NULL DEFAULT (date('now')),
  
  -- Type de congé
  leave_type TEXT NOT NULL DEFAULT 'conge_paye',
  -- Types possibles :
  --   conge_paye        : Congés payés annuels (2,5 j/mois, 30 j/an)
  --   sans_solde        : Congé sans solde
  --   exceptionnel      : Congés exceptionnels (mariage, décès, naissance...)
  --   maladie           : Congé maladie (justificatif obligatoire)
  --   parental          : Congé parental
  --   sabbatique        : Congé sabbatique
  --   formation         : Congé de formation
  --   fermeture         : Congés imposés (fermeture annuelle 24/12 → 01/01)

  -- Sous-type pour congés exceptionnels
  exceptional_type TEXT,
  -- Valeurs possibles :
  --   mariage_salarie, mariage_enfant, pacs,
  --   naissance, deces_conjoint, deces_enfant, deces_parent,
  --   deces_beau_parent, deces_frere_soeur, deces_grand_parent,
  --   annonce_handicap, demenagement

  -- Période demandée
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_period TEXT DEFAULT 'AM',       -- AM = matin, PM = après-midi
  end_period TEXT DEFAULT 'PM',

  -- Calculs automatiques
  working_days REAL NOT NULL DEFAULT 0, -- Jours ouvrables calculés (lundi→samedi hors fériés)
  
  -- Commentaires
  employee_comment TEXT,                -- Remarques du salarié
  
  -- Workflow de validation
  status TEXT NOT NULL DEFAULT 'pending',
  -- Statuts : pending, accepted, refused, modified, cancelled

  -- Décision administrative
  admin_comment TEXT,                   -- Motif (obligatoire si refus/modification)
  decision_date TEXT,                   -- Date de la décision
  decision_by INTEGER,                  -- Admin qui a pris la décision
  reception_date TEXT,                  -- Date de réception (auto quand admin ouvre)

  -- Période modifiée par l'admin
  modified_start_date TEXT,
  modified_end_date TEXT,
  modified_working_days REAL,

  -- Signatures électroniques (base64 PNG)
  signature_employee TEXT,
  signature_employee_date TEXT,
  signature_admin TEXT,
  signature_admin_date TEXT,

  -- Justificatif (chemin du fichier uploadé)
  justification_path TEXT,
  justification_filename TEXT,

  -- PDF généré
  pdf_path TEXT,

  -- Critères de validation internes
  priority_score INTEGER DEFAULT 0,     -- Score pour arbitrage
  -- Composé de : ancienneté + situation familiale + charge événementielle

  -- Métadonnées
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Contraintes
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (decision_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_leave_requests_person ON leave_requests(person_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON leave_requests(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);

-- Table d'historique des modifications de demandes
CREATE TABLE IF NOT EXISTS leave_request_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_request_id INTEGER NOT NULL,
  action TEXT NOT NULL,                 -- created, status_changed, modified, signed, pdf_generated
  old_value TEXT,                       -- JSON de l'ancien état
  new_value TEXT,                       -- JSON du nouvel état
  performed_by INTEGER,
  performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leave_history_request ON leave_request_history(leave_request_id);

-- Table des jours fériés (pré-remplie + configurable par admin)
CREATE TABLE IF NOT EXISTS public_holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                   -- Format YYYY-MM-DD
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  is_custom BOOLEAN DEFAULT 0,         -- 0 = légal, 1 = ajouté par admin
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_year ON public_holidays(year);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public_holidays(date);

-- Pré-remplir les jours fériés 2025-2027
-- 2025
INSERT OR IGNORE INTO public_holidays (date, name, year) VALUES
  ('2025-01-01', 'Jour de l''An', 2025),
  ('2025-04-21', 'Lundi de Pâques', 2025),
  ('2025-05-01', 'Fête du Travail', 2025),
  ('2025-05-08', 'Victoire 1945', 2025),
  ('2025-05-29', 'Ascension', 2025),
  ('2025-06-09', 'Lundi de Pentecôte', 2025),
  ('2025-07-14', 'Fête Nationale', 2025),
  ('2025-08-15', 'Assomption', 2025),
  ('2025-11-01', 'Toussaint', 2025),
  ('2025-11-11', 'Armistice', 2025),
  ('2025-12-25', 'Noël', 2025);

-- 2026
INSERT OR IGNORE INTO public_holidays (date, name, year) VALUES
  ('2026-01-01', 'Jour de l''An', 2026),
  ('2026-04-06', 'Lundi de Pâques', 2026),
  ('2026-05-01', 'Fête du Travail', 2026),
  ('2026-05-08', 'Victoire 1945', 2026),
  ('2026-05-14', 'Ascension', 2026),
  ('2026-05-25', 'Lundi de Pentecôte', 2026),
  ('2026-07-14', 'Fête Nationale', 2026),
  ('2026-08-15', 'Assomption', 2026),
  ('2026-11-01', 'Toussaint', 2026),
  ('2026-11-11', 'Armistice', 2026),
  ('2026-12-25', 'Noël', 2026);

-- 2027
INSERT OR IGNORE INTO public_holidays (date, name, year) VALUES
  ('2027-01-01', 'Jour de l''An', 2027),
  ('2027-03-29', 'Lundi de Pâques', 2027),
  ('2027-05-01', 'Fête du Travail', 2027),
  ('2027-05-06', 'Ascension', 2027),
  ('2027-05-08', 'Victoire 1945', 2027),
  ('2027-05-17', 'Lundi de Pentecôte', 2027),
  ('2027-07-14', 'Fête Nationale', 2027),
  ('2027-08-15', 'Assomption', 2027),
  ('2027-11-01', 'Toussaint', 2027),
  ('2027-11-11', 'Armistice', 2027),
  ('2027-12-25', 'Noël', 2027);

-- Mettre à jour leave_balances pour utiliser 30 jours ouvrables (et non 25 ouvrés)
-- conformément à l'IDCC 3252 et au Code du travail
-- Note : les soldes existants restent tels quels
