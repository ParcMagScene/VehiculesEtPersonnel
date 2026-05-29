-- 0003_drop_duplicate_indexes.sql
-- [PERF Phase 4.M] Nettoyage de 10 index strictement redondants (mêmes
-- colonnes, même table). Détectés via pragma_index_info().
-- Chaque DROP conserve l'index "canonique" portant le nom le plus explicite
-- (`<table>_<col>` ou variante UNIQUE/partial la plus économe). Aucune requête
-- du code n'utilise INDEXED BY donc le planner choisira automatiquement
-- l'index restant. Bénéfice : moins d'espace, écritures plus rapides
-- (chaque INSERT/UPDATE devait maintenir N copies du même index).

-- equipment(uid) : on garde idx_equipment_uid_unique (UNIQUE WHERE uid IS NOT NULL,
-- plus économe car n'indexe pas les NULLs)
DROP INDEX IF EXISTS idx_equipment_uid;

-- modification_history(entity_type, entity_id) : 3 copies en DB
-- On garde idx_modification_history_entity (le plus explicite)
DROP INDEX IF EXISTS idx_history_entity;
DROP INDEX IF EXISTS idx_modhist_entity;

-- modification_history(timestamp) : on garde idx_modhist_timestamp (DESC,
-- plus utile pour les requêtes "récents en premier")
DROP INDEX IF EXISTS idx_history_timestamp;

-- active_sessions(expires_at) : on garde idx_active_sessions_expires
DROP INDEX IF EXISTS idx_sessions_expires;

-- active_sessions(token_hash) : on garde idx_active_sessions_token_hash
DROP INDEX IF EXISTS idx_sessions_token;

-- bl_imports(affaire_id) : on garde idx_bl_imports_affaire
DROP INDEX IF EXISTS idx_bl_affaire;

-- sav_tickets(equipment_id) : on garde idx_sav_tickets_equipment_id
DROP INDEX IF EXISTS idx_sav_equipment;

-- trip_details(reservation_id) : on garde idx_trip_details_reservation_id
DROP INDEX IF EXISTS idx_trip_details_reservation;

-- trip_pauses(trip_detail_id) : on garde idx_trip_pauses_trip_detail_id
DROP INDEX IF EXISTS idx_trip_pauses_trip;

-- Rafraîchit sqlite_stat1 pour que le planner ait des stats à jour
-- après suppression des index redondants.
ANALYZE;
