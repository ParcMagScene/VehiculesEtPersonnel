-- 0006_add_stock_movements_item_created_at_desc.sql
-- Performance: avoid temp sort for stock movement timeline queries.
-- Target query pattern:
--   WHERE stock_item_id = ? ORDER BY created_at DESC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_created_at_desc
  ON stock_movements(stock_item_id, created_at DESC);
