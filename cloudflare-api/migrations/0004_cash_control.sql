-- Cash control foundation: cashier sessions, auditable cash movements, and shift-bound sales.
-- This migration is isolated to OmniPoint and contains no business/sample records.
ALTER TABLE omni_retail_sales ADD COLUMN cash_session_id TEXT REFERENCES omni_cash_sessions(id);
ALTER TABLE omni_retail_sales ADD COLUMN branch_id TEXT;

CREATE TABLE IF NOT EXISTS omni_cash_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  branch_id TEXT,
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  opening_cash INTEGER NOT NULL CHECK (opening_cash >= 0),
  expected_cash INTEGER,
  counted_cash INTEGER CHECK (counted_cash IS NULL OR counted_cash >= 0),
  difference INTEGER,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','REVIEW_REQUIRED','APPROVED')),
  opening_note TEXT,
  closing_note TEXT,
  approved_by TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  approved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (status = 'OPEN' AND closed_at IS NULL AND counted_cash IS NULL)
    OR
    (status IN ('CLOSED','REVIEW_REQUIRED','APPROVED') AND closed_at IS NOT NULL AND counted_cash IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_omni_cash_one_open_shift
  ON omni_cash_sessions(company_id, ifnull(branch_id, ''), opened_by)
  WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_omni_cash_sessions_company_status
  ON omni_cash_sessions(company_id, status, opened_at DESC);

CREATE TABLE IF NOT EXISTS omni_cash_movements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES omni_cash_sessions(id) ON DELETE RESTRICT,
  company_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('SALE','PAID_IN','PAID_OUT')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_omni_cash_movements_session_date
  ON omni_cash_movements(company_id, session_id, created_at);

-- A completed cash sale must belong to an open shift in the same company/branch.
CREATE TRIGGER IF NOT EXISTS omni_sale_requires_open_cash_session
BEFORE INSERT ON omni_retail_sales
WHEN NEW.status = 'COMPLETED' AND NEW.payment_method = 'CASH'
BEGIN
  SELECT CASE
    WHEN NEW.cash_session_id IS NULL
      THEN RAISE(ABORT, 'CASH_SESSION_REQUIRED')
    WHEN NOT EXISTS (
      SELECT 1 FROM omni_cash_sessions cs
      WHERE cs.id = NEW.cash_session_id
        AND cs.company_id = NEW.company_id
        AND cs.branch_id IS NEW.branch_id
        AND cs.status = 'OPEN'
    )
      THEN RAISE(ABORT, 'CASH_SESSION_NOT_OPEN_OR_SCOPE_MISMATCH')
  END;
END;

-- Cash movement is generated in the same D1 batch as the sale; clients cannot post it separately.
CREATE TRIGGER IF NOT EXISTS omni_sale_cash_movement
AFTER INSERT ON omni_retail_sales
WHEN NEW.status = 'COMPLETED' AND NEW.payment_method = 'CASH'
BEGIN
  INSERT INTO omni_cash_movements
    (id, session_id, company_id, actor_id, movement_type, amount, reason, source_type, source_id, idempotency_key)
  VALUES
    (lower(hex(randomblob(16))), NEW.cash_session_id, NEW.company_id, NEW.actor_id,
     'SALE', NEW.total, 'Cash received for receipt ' || NEW.receipt_number,
     'RETAIL_SALE', NEW.id, 'sale:' || NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS omni_cash_movement_scope_guard
BEFORE INSERT ON omni_cash_movements
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM omni_cash_sessions cs
      WHERE cs.id = NEW.session_id AND cs.company_id = NEW.company_id
        AND cs.status = 'OPEN'
    ) THEN RAISE(ABORT, 'CASH_SESSION_NOT_OPEN_OR_SCOPE_MISMATCH')
    WHEN NEW.movement_type = 'SALE' AND NEW.source_type != 'RETAIL_SALE'
      THEN RAISE(ABORT, 'INVALID_CASH_SALE_SOURCE')
  END;
END;

-- Cash shifts are immutable once closed; adjustments must be explicit reviewed movements.
CREATE TRIGGER IF NOT EXISTS omni_cash_session_no_reopen
BEFORE UPDATE OF status ON omni_cash_sessions
WHEN OLD.status != 'OPEN' AND NEW.status = 'OPEN'
BEGIN
  SELECT RAISE(ABORT, 'CASH_SESSION_CANNOT_REOPEN');
END;
