-- 0009_add_db_audit_views.sql
-- Adds lightweight audit views for referential health checks on polymorphic links.

CREATE VIEW IF NOT EXISTS v_db_audit_annuaire_contact_entity_links_orphans AS
SELECT l.*
FROM annuaire_contact_entity_links l
WHERE (l.entity_type = 'client' AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = l.entity_id))
   OR (l.entity_type = 'supplier' AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = l.entity_id))
   OR (l.entity_type = 'prestataire' AND NOT EXISTS (SELECT 1 FROM prestataires p WHERE p.id = l.entity_id));

CREATE VIEW IF NOT EXISTS v_db_audit_task_assignments_reservation_orphans AS
SELECT ta.*
FROM task_assignments ta
WHERE ta.reservation_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.id = ta.reservation_id);

CREATE VIEW IF NOT EXISTS v_db_audit_bp_items_stock_orphans AS
SELECT b.*
FROM bp_items b
WHERE b.stock_item_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM stock_items s WHERE s.id = b.stock_item_id);
