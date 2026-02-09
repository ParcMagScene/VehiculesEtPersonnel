-- Migration: Changer reservation_id de REAL à TEXT dans trip_details
-- Les IDs de réservation sont des strings TEXT (format: "timestamp.0.random")
-- La colonne REAL causait des erreurs avec Number() sur ces IDs

-- Créer la nouvelle table avec le bon type
CREATE TABLE trip_details_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_order INTEGER NOT NULL DEFAULT 0,
  
  -- Trajet ALLER
  departure_location TEXT,
  departure_date TEXT,
  departure_time TEXT,
  arrival_location TEXT,
  arrival_date TEXT,
  arrival_time TEXT,
  
  -- Trajet RETOUR
  return_departure_location TEXT,
  return_departure_date TEXT,
  return_departure_time TEXT,
  return_arrival_location TEXT,
  return_arrival_date TEXT,
  return_arrival_time TEXT,
  
  -- Conducteur pour ce trajet
  driver_name TEXT,
  
  -- Temps de trajet calculés (en minutes)
  outbound_duration INTEGER,
  return_duration INTEGER,
  
  -- Options
  has_junction_with_next BOOLEAN DEFAULT 0,
  junction_location TEXT,
  
  -- Métadonnées
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  trip_group_id TEXT,
  
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
);

-- Copier les données existantes (convertir REAL en TEXT)
INSERT INTO trip_details_new SELECT 
  id, CAST(reservation_id AS TEXT), event_id, event_order,
  departure_location, departure_date, departure_time,
  arrival_location, arrival_date, arrival_time,
  return_departure_location, return_departure_date, return_departure_time,
  return_arrival_location, return_arrival_date, return_arrival_time,
  driver_name, outbound_duration, return_duration,
  has_junction_with_next, junction_location,
  created_at, updated_at, trip_group_id
FROM trip_details;

-- Supprimer l'ancienne table
DROP TABLE trip_details;

-- Renommer la nouvelle table
ALTER TABLE trip_details_new RENAME TO trip_details;

-- Recréer les index
CREATE INDEX idx_trip_details_reservation ON trip_details(reservation_id);
CREATE INDEX idx_trip_details_event ON trip_details(event_id);
CREATE INDEX idx_trip_details_trip_group_id ON trip_details(trip_group_id);
