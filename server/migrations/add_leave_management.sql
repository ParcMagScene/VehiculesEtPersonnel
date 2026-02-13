-- Migration: Système de gestion des congés et disponibilités
-- Ajoute les colonnes nécessaires au workflow d'approbation des congés

-- Statut de la demande (pending = en attente, approved = approuvé, rejected = refusé)
ALTER TABLE availabilities ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';

-- Qui a approuvé/refusé
ALTER TABLE availabilities ADD COLUMN approved_by INTEGER REFERENCES users(id);

-- Quand a été approuvé/refusé
ALTER TABLE availabilities ADD COLUMN approved_at DATETIME;

-- Motif de refus
ALTER TABLE availabilities ADD COLUMN rejection_reason TEXT;

-- Table des soldes de congés par personne et par année
CREATE TABLE IF NOT EXISTS leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'conge_paye',
  days_entitled REAL NOT NULL DEFAULT 25,
  days_taken REAL NOT NULL DEFAULT 0,
  UNIQUE(person_id, year, type),
  FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_person ON leave_balances(person_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);
