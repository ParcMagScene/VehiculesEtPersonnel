-- ============================================================
-- Migration: Catalogue Matériel + Flight-Cases + Modèles Camions
-- Date: 2026-02-19
-- Description: Tables pour l'intégration eM@g ↔ Catalogue ↔ Chargement 3D
-- ============================================================

-- A. Catalogue d'équipements (flight-cases, câbles, armoires, backline, audiovisuel…)
CREATE TABLE IF NOT EXISTS equipment_catalog (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE,
  name TEXT NOT NULL,
  family TEXT,
  subfamily TEXT,
  category TEXT,
  dimensions TEXT, -- JSON: {w, h, d} en cm
  weight REAL,
  default_flightcase_id TEXT,
  metadata TEXT, -- JSON libre
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- B. Modèles de flight-cases
CREATE TABLE IF NOT EXISTS flightcases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  internal_code TEXT,
  dimensions TEXT, -- JSON: {w, h, d} en cm
  capacity INTEGER DEFAULT 1,
  category TEXT,
  texture TEXT,
  metadata TEXT, -- JSON libre
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- C. Modèles de camions / semi-remorques
CREATE TABLE IF NOT EXISTS truck_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('semi', 'porteur', 'utilitaire')),
  internal_code TEXT,
  dimensions TEXT, -- JSON: {length, width, height} en cm
  axle_config TEXT, -- JSON
  metadata TEXT, -- JSON libre
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- D. Liaison équipement ↔ réservation véhicule
CREATE TABLE IF NOT EXISTS equipment_to_vehicle (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  equipment_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  flightcase_id TEXT,
  metadata TEXT, -- JSON libre
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES equipment_catalog(id),
  FOREIGN KEY (flightcase_id) REFERENCES flightcases(id)
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_equipment_catalog_family ON equipment_catalog(family);
CREATE INDEX IF NOT EXISTS idx_equipment_catalog_category ON equipment_catalog(category);
CREATE INDEX IF NOT EXISTS idx_equipment_catalog_reference ON equipment_catalog(reference);
CREATE INDEX IF NOT EXISTS idx_flightcases_category ON flightcases(category);
CREATE INDEX IF NOT EXISTS idx_truck_models_type ON truck_models(type);
CREATE INDEX IF NOT EXISTS idx_equipment_to_vehicle_reservation ON equipment_to_vehicle(reservation_id);
CREATE INDEX IF NOT EXISTS idx_equipment_to_vehicle_equipment ON equipment_to_vehicle(equipment_id);

-- FK pour equipment_catalog → flightcases
-- (non contrainte par FK car le flight-case par défaut peut ne pas encore exister)
