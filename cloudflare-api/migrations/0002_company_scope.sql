-- Add tenant ownership to every OmniPoint business record.
-- Existing test records are assigned to the isolated default tenant; production
-- cutover must explicitly map each legacy record before applying this migration.
ALTER TABLE omni_products ADD COLUMN company_id TEXT NOT NULL DEFAULT 'omnipoint-default';
ALTER TABLE omni_retail_sales ADD COLUMN company_id TEXT NOT NULL DEFAULT 'omnipoint-default';
ALTER TABLE omni_stock_movements ADD COLUMN company_id TEXT NOT NULL DEFAULT 'omnipoint-default';
ALTER TABLE omni_agency_transactions ADD COLUMN company_id TEXT NOT NULL DEFAULT 'omnipoint-default';
ALTER TABLE omni_ledger_entries ADD COLUMN company_id TEXT NOT NULL DEFAULT 'omnipoint-default';
ALTER TABLE omni_reconciliation_sessions ADD COLUMN company_id TEXT NOT NULL DEFAULT 'omnipoint-default';
ALTER TABLE omni_audit_events ADD COLUMN company_id TEXT NOT NULL DEFAULT 'omnipoint-default';

CREATE INDEX IF NOT EXISTS idx_omni_products_company_active ON omni_products(company_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_omni_sales_company_created ON omni_retail_sales(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_stock_company_product ON omni_stock_movements(company_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_agency_company_status ON omni_agency_transactions(company_id, provider_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_ledger_company_type_date ON omni_ledger_entries(company_id, ledger_type, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_reconciliation_company_date ON omni_reconciliation_sessions(company_id, business_date DESC, ledger_type);
CREATE INDEX IF NOT EXISTS idx_omni_audit_company_created ON omni_audit_events(company_id, created_at DESC);

DROP TRIGGER IF EXISTS omni_sale_line_stock_guard;
CREATE TRIGGER omni_sale_line_stock_guard
BEFORE INSERT ON omni_retail_sale_lines
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM omni_products p
      JOIN omni_retail_sales s ON s.id = NEW.sale_id
      WHERE p.id = NEW.product_id
        AND p.is_active = 1
        AND p.company_id = s.company_id
    ) THEN RAISE(ABORT, 'PRODUCT_NOT_AVAILABLE_OR_TENANT_MISMATCH')
    WHEN (SELECT quantity_on_hand FROM omni_products WHERE id = NEW.product_id) < NEW.quantity
      THEN RAISE(ABORT, 'INSUFFICIENT_STOCK')
  END;
END;

DROP TRIGGER IF EXISTS omni_sale_line_stock_post;
CREATE TRIGGER omni_sale_line_stock_post
AFTER INSERT ON omni_retail_sale_lines
BEGIN
  UPDATE omni_products
    SET quantity_on_hand = quantity_on_hand - NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id
      AND company_id = (SELECT company_id FROM omni_retail_sales WHERE id = NEW.sale_id);

  INSERT INTO omni_stock_movements
    (id, product_id, actor_id, movement_type, quantity_delta, quantity_after, unit_cost, reference_type, reference_id, reason, company_id)
  SELECT lower(hex(randomblob(16))), NEW.product_id, s.actor_id, 'SALE',
         -NEW.quantity, p.quantity_on_hand, NEW.unit_cost, 'RETAIL_SALE', NEW.sale_id,
         'Stock deducted for receipt ' || s.receipt_number, s.company_id
    FROM omni_retail_sales s
    JOIN omni_products p ON p.id = NEW.product_id AND p.company_id = s.company_id
    WHERE s.id = NEW.sale_id;
END;

DROP TRIGGER IF EXISTS omni_stock_movement_guard;
CREATE TRIGGER omni_stock_movement_guard
BEFORE INSERT ON omni_stock_movements
WHEN NEW.movement_type IN ('OPENING','PURCHASE','RETURN','ADJUSTMENT','DAMAGE')
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM omni_products
      WHERE id = NEW.product_id AND is_active = 1 AND company_id = NEW.company_id
    ) THEN RAISE(ABORT, 'PRODUCT_NOT_AVAILABLE_OR_TENANT_MISMATCH')
    WHEN NEW.quantity_after != (
      SELECT quantity_on_hand + NEW.quantity_delta FROM omni_products
      WHERE id = NEW.product_id AND company_id = NEW.company_id
    ) THEN RAISE(ABORT, 'STOCK_MOVEMENT_MISMATCH')
    WHEN NEW.quantity_after < 0 THEN RAISE(ABORT, 'INSUFFICIENT_STOCK')
  END;
END;

DROP TRIGGER IF EXISTS omni_stock_movement_apply;
CREATE TRIGGER omni_stock_movement_apply
AFTER INSERT ON omni_stock_movements
WHEN NEW.movement_type IN ('OPENING','PURCHASE','RETURN','ADJUSTMENT','DAMAGE')
BEGIN
  UPDATE omni_products
     SET quantity_on_hand = NEW.quantity_after, updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.product_id AND company_id = NEW.company_id;
END;
