-- 0010_add_referential_guard_triggers.sql
-- Adds referential guards for columns that are not declared as FK in legacy tables.
-- Goal: prevent future integrity drift without table rebuilds.

-- suppliers.created_by -> users(id)
CREATE TRIGGER IF NOT EXISTS trg_suppliers_created_by_guard_insert
BEFORE INSERT ON suppliers
FOR EACH ROW
WHEN NEW.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.created_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_suppliers_created_by_users');
END;

CREATE TRIGGER IF NOT EXISTS trg_suppliers_created_by_guard_update
BEFORE UPDATE OF created_by ON suppliers
FOR EACH ROW
WHEN NEW.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.created_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_suppliers_created_by_users');
END;

-- suppliers.modified_by -> users(id)
CREATE TRIGGER IF NOT EXISTS trg_suppliers_modified_by_guard_insert
BEFORE INSERT ON suppliers
FOR EACH ROW
WHEN NEW.modified_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.modified_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_suppliers_modified_by_users');
END;

CREATE TRIGGER IF NOT EXISTS trg_suppliers_modified_by_guard_update
BEFORE UPDATE OF modified_by ON suppliers
FOR EACH ROW
WHEN NEW.modified_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.modified_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_suppliers_modified_by_users');
END;

-- dynamic_display_events.modified_by -> users(id)
CREATE TRIGGER IF NOT EXISTS trg_dde_modified_by_guard_insert
BEFORE INSERT ON dynamic_display_events
FOR EACH ROW
WHEN NEW.modified_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.modified_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_dynamic_display_events_modified_by_users');
END;

CREATE TRIGGER IF NOT EXISTS trg_dde_modified_by_guard_update
BEFORE UPDATE OF modified_by ON dynamic_display_events
FOR EACH ROW
WHEN NEW.modified_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.modified_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_dynamic_display_events_modified_by_users');
END;

-- task_assignments.modified_by -> users(id)
CREATE TRIGGER IF NOT EXISTS trg_task_assignments_modified_by_guard_insert
BEFORE INSERT ON task_assignments
FOR EACH ROW
WHEN NEW.modified_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.modified_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_task_assignments_modified_by_users');
END;

CREATE TRIGGER IF NOT EXISTS trg_task_assignments_modified_by_guard_update
BEFORE UPDATE OF modified_by ON task_assignments
FOR EACH ROW
WHEN NEW.modified_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.modified_by)
BEGIN
  SELECT RAISE(ABORT, 'fk_guard_task_assignments_modified_by_users');
END;
