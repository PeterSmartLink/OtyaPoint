-- OmniPoint business tables. Additive and isolated from existing Otya tables.
-- No sample rows are inserted. All amounts are integer UGX minor units (whole UGX).
CREATE TABLE IF NOT EXISTS omni_products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  cost_price INTEGER NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price INTEGER NOT NULL CHECK (selling_price >= 0),
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_omni_products_active_name ON omni_products(is_active, name);
CREATE INDEX IF NOT EXISTS idx_omni_products_low_stock ON omni_products(quantity_on_hand, reorder_level);

CREATE TABLE IF NOT EXISTS omni_retail_sales (
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
  idempotency_key TEXT NOT NULL UNIQUE,
  efris_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (efris_status IN ('NOT_CONFIGURED','DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN')),
  efris_invoice_id TEXT,
  efris_fiscal_data TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_omni_sales_created ON omni_retail_sales(created_at DESC);
CREATE TABLE IF NOT EXISTS omni_retail_sale_lines (
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
CREATE INDEX IF NOT EXISTS idx_omni_sale_lines_sale ON omni_retail_sale_lines(sale_id);

CREATE TABLE IF NOT EXISTS omni_stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES omni_products(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('OPENING','PURCHASE','SALE','RETURN','ADJUSTMENT','DAMAGE')),
  quantity_delta INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  unit_cost INTEGER CHECK (unit_cost IS NULL OR unit_cost >= 0),
  reference_type TEXT,
  reference_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_omni_stock_product_created ON omni_stock_movements(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS omni_agency_transactions (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CASH_IN','CASH_OUT','AIRTIME','BILL_PAYMENT','FLOAT_ADJUSTMENT','REVERSAL')),
  provider TEXT,
  provider_reference TEXT,
  provider_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (provider_status IN ('DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  commission INTEGER NOT NULL DEFAULT 0 CHECK (commission >= 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  customer_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_metadata TEXT,
  response_metadata TEXT,
  failure_code TEXT,
  failure_message TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_omni_agency_created ON omni_agency_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_agency_status ON omni_agency_transactions(provider_status, created_at DESC);

CREATE TABLE IF NOT EXISTS omni_ledger_entries (
  id TEXT PRIMARY KEY,
  ledger_type TEXT NOT NULL CHECK (ledger_type IN ('RETAIL','FINTECH_AGENCY')),
  account_code TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  effective_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX IF NOT EXISTS idx_omni_ledger_type_date ON omni_ledger_entries(ledger_type, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_ledger_source ON omni_ledger_entries(source_type, source_id);

CREATE TABLE IF NOT EXISTS omni_reconciliation_sessions (
  id TEXT PRIMARY KEY,
  ledger_type TEXT NOT NULL CHECK (ledger_type IN ('RETAIL','FINTECH_AGENCY')),
  business_date TEXT NOT NULL,
  expected_cash INTEGER NOT NULL CHECK (expected_cash >= 0),
  counted_cash INTEGER NOT NULL CHECK (counted_cash >= 0),
  expected_float INTEGER CHECK (expected_float IS NULL OR expected_float >= 0),
  counted_float INTEGER CHECK (counted_float IS NULL OR counted_float >= 0),
  difference INTEGER NOT NULL,
  notes TEXT,
  prepared_by TEXT NOT NULL,
  approved_by TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SUBMITTED','APPROVED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ledger_type, business_date, prepared_by)
);
CREATE INDEX IF NOT EXISTS idx_omni_reconciliation_date ON omni_reconciliation_sessions(business_date DESC, ledger_type);

CREATE TABLE IF NOT EXISTS omni_audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  reason TEXT,
  before_state TEXT,
  after_state TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_omni_audit_created ON omni_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_audit_entity ON omni_audit_events(entity_type, entity_id, created_at DESC);

-- Stock is decremented only as part of a sale-line insert in the same D1
-- transaction. A rejected line aborts the batch, rolling back the entire sale.
CREATE TRIGGER IF NOT EXISTS omni_sale_line_stock_guard
BEFORE INSERT ON omni_retail_sale_lines
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM omni_products
      WHERE id = NEW.product_id AND is_active = 1
    ) THEN RAISE(ABORT, 'PRODUCT_NOT_AVAILABLE')
    WHEN (SELECT quantity_on_hand FROM omni_products WHERE id = NEW.product_id) < NEW.quantity
      THEN RAISE(ABORT, 'INSUFFICIENT_STOCK')
  END;
END;

CREATE TRIGGER IF NOT EXISTS omni_sale_line_stock_post
AFTER INSERT ON omni_retail_sale_lines
BEGIN
  UPDATE omni_products
    SET quantity_on_hand = quantity_on_hand - NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;

  INSERT INTO omni_stock_movements
    (id, product_id, actor_id, movement_type, quantity_delta, quantity_after, unit_cost, reference_type, reference_id, reason)
  SELECT lower(hex(randomblob(16))), NEW.product_id, s.actor_id, 'SALE',
         -NEW.quantity, p.quantity_on_hand, NEW.unit_cost, 'RETAIL_SALE', NEW.sale_id,
         'Stock deducted for receipt ' || s.receipt_number
    FROM omni_retail_sales s
    JOIN omni_products p ON p.id = NEW.product_id
    WHERE s.id = NEW.sale_id;
END;
