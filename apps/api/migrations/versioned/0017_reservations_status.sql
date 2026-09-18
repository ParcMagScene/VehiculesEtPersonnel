-- 0017_reservations_status.sql
-- Ajoute une colonne `status` sur reservations pour permettre
-- de marquer une résa comme annulée sans la supprimer (elle reste
-- affichée grisée / hachurée côté UI). Valeurs : 'active' | 'cancelled'.
ALTER TABLE reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
