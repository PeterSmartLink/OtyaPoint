-- Align the existing empty OmniPoint production D1 schema with the current API contract.
-- This is additive: it preserves all existing tables and records.
ALTER TABLE omni_retail_sales ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_omni_sales_idempotency ON omni_retail_sales(idempotency_key);

CREATE TABLE IF NOT EXISTS omni_staff_memberships (
  id TEXT PRIMARY KEY,
  identity_subject TEXT NOT NULL UNIQUE,
  company_id TEXT NOT NULL,
  branch_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('ATTENDANT','MANAGER','MANAGING_DIRECTOR','CHAIRMAN','SOVEREIGN')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REVOKED')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_omni_staff_status_role ON omni_staff_memberships(status, role);

CREATE TRIGGER IF NOT EXISTS omni_stock_movement_guard
BEFORE INSERT ON omni_stock_movements
WHEN NEW.movement_type IN ('OPENING','PURCHASE','RETURN','ADJUSTMENT','DAMAGE')
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM omni_products WHERE id = NEW.product_id AND is_active = 1)
      THEN RAISE(ABORT, 'PRODUCT_NOT_AVAILABLE')
    WHEN NEW.quantity_after != (SELECT quantity_on_hand + NEW.quantity_delta FROM omni_products WHERE id = NEW.product_id)
      THEN RAISE(ABORT, 'STOCK_MOVEMENT_MISMATCH')
    WHEN NEW.quantity_after < 0
      THEN RAISE(ABORT, 'INSUFFICIENT_STOCK')
  END;
END;

CREATE TRIGGER IF NOT EXISTS omni_stock_movement_apply
AFTER INSERT ON omni_stock_movements
WHEN NEW.movement_type IN ('OPENING','PURCHASE','RETURN','ADJUSTMENT','DAMAGE')
BEGIN
  UPDATE omni_products
     SET quantity_on_hand = NEW.quantity_after, updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.product_id;
END;
