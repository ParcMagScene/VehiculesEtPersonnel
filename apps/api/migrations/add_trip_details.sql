-- Table pour stocker les détails de trajets pour chaque événement lié à une tournée
CREATE TABLE IF NOT EXISTS trip_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL,
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
  
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
);

-- Table pour les pauses
CREATE TABLE IF NOT EXISTS trip_pauses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_detail_id INTEGER NOT NULL,
  pause_type TEXT NOT NULL, -- 'outbound' ou 'return'
  location TEXT,
  start_time TEXT,
  duration INTEGER, -- en minutes
  notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trip_detail_id) REFERENCES trip_details(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_trip_details_reservation ON trip_details(reservation_id);
CREATE INDEX IF NOT EXISTS idx_trip_details_event ON trip_details(event_id);
CREATE INDEX IF NOT EXISTS idx_trip_pauses_trip ON trip_pauses(trip_detail_id);
