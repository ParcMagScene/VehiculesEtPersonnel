-- 0004_cleanup_equipment_serialize_suffix.sql
-- [PERF Phase 4.L] Migration one-shot du nettoyage des noms d'équipements
-- sérialisés portant un suffixe " #N" (résidu d'un ancien import).
--
-- Avant : migrations.js (runMigrations, exécuté à chaque boot) faisait
--   SELECT COUNT(*) FROM equipment WHERE name LIKE '% #%'
-- → full table scan ~2s mesuré en prod (Phase 4.N slow log), à chaque restart
--   PM2. La requête ne peut pas être indexée (LIKE wildcard initial).
--
-- Solution : déplacer le UPDATE ici (idempotent, ne tourne qu'une fois grâce
-- au tracking schema_migrations) et supprimer le bloc du chemin de boot.

UPDATE equipment
SET name = TRIM(SUBSTR(name, 1, INSTR(name, ' #') - 1))
WHERE name LIKE '% #%'
  AND INSTR(name, ' #') > 0;
