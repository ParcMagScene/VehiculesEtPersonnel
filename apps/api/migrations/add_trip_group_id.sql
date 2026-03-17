-- Migration: Ajouter trip_group_id pour lier les trajets entre événements
-- Un trip_group_id partagé signifie que les trajets sont liés et s'affichent ensemble

ALTER TABLE trip_details ADD COLUMN trip_group_id TEXT;

-- Index pour rechercher rapidement les trajets d'un même groupe
CREATE INDEX IF NOT EXISTS idx_trip_details_trip_group_id ON trip_details(trip_group_id);
