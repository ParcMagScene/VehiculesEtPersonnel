-- Supprimer la table trip_details existante
DROP TABLE IF EXISTS trip_details;

-- Recréer avec reservation_id en REAL
CREATE TABLE trip_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id REAL NOT NULL,
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

CREATE INDEX idx_trip_details_reservation ON trip_details(reservation_id);
CREATE INDEX idx_trip_details_event ON trip_details(event_id);
