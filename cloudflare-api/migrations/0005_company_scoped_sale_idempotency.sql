-- Replace the legacy global idempotency uniqueness with company-scoped uniqueness.
-- Rebuild both related tables inside one migration transaction: SQLite cannot drop
-- the parent while sale-line foreign keys still reference it. The staging table
-- intentionally has no FK so the old parent can be replaced safely. All business
-- rows, sale-line references, indexes and stock triggers are recreated below.
BEGIN;

CREATE TABLE omni_retail_sales_new (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('DRAFT','PENDING','COMPLETED','VOIDED','REFUNDED')),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  discount_total INTEGER NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total INTEGER NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  cost_of_goods INTEGER NOT NULL DEFAULT 0 CHECK (cost_of_goods >= 0),
  payment_method TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  efris_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (efris_status IN ('NOT_CONFIGURED','DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN')),
  efris_invoice_id TEXT,
  efris_fiscal_data TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  company_id TEXT NOT NULL DEFAULT 'omnipoint-default',
  request_fingerprint TEXT
);
INSERT INTO omni_retail_sales_new (
  id, receipt_number, status, currency, subtotal, discount_total, tax_total, total,
  cost_of_goods, payment_method, idempotency_key, efris_status, efris_invoice_id,
  efris_fiscal_data, actor_id, created_at, company_id, request_fingerprint
)
SELECT
  id, receipt_number, status, currency, subtotal, discount_total, tax_total, total,
  cost_of_goods, payment_method, idempotency_key, efris_status, efris_invoice_id,
  efris_fiscal_data, actor_id, created_at, company_id, request_fingerprint
FROM omni_retail_sales;

CREATE TABLE omni_retail_sale_lines_stage (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sku_snapshot TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0)
);
INSERT INTO omni_retail_sale_lines_stage
  (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
SELECT id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total
FROM omni_retail_sale_lines;

DROP TABLE omni_retail_sale_lines;
DROP TABLE omni_retail_sales;
ALTER TABLE omni_retail_sales_new RENAME TO omni_retail_sales;

CREATE TABLE omni_retail_sale_lines_new (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES omni_retail_sales(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES omni_products(id) ON DELETE RESTRICT,
  sku_snapshot TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0)
);
INSERT INTO omni_retail_sale_lines_new
  (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
SELECT id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total
FROM omni_retail_sale_lines_stage;
DROP TABLE omni_retail_sale_lines_stage;
ALTER TABLE omni_retail_sale_lines_new RENAME TO omni_retail_sale_lines;

CREATE INDEX idx_omni_sales_created ON omni_retail_sales(created_at DESC);
CREATE INDEX idx_omni_sales_company_created ON omni_retail_sales(company_id, created_at DESC);
CREATE UNIQUE INDEX idx_omni_sales_company_idempotency
  ON omni_retail_sales(company_id, idempotency_key);
CREATE INDEX idx_omni_sale_lines_sale ON omni_retail_sale_lines(sale_id);

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
         -NEW.quantity, p.quantity_on_hand, NEW.unit_cost, 'RETAIL_SALE', NEW.id,
         'Stock deducted for receipt ' || s.receipt_number, s.company_id
    FROM omni_retail_sales s
    JOIN omni_products p ON p.id = NEW.product_id AND p.company_id = s.company_id
    WHERE s.id = NEW.sale_id;
END;

COMMIT;
