-- OmniPoint D1 compatibility spike only.
-- Synthetic/test database: omnipoint-migration-test (EU jurisdiction).
-- Do not apply to production or use this as a cutover migration without review.
-- Money values are stored as whole UGX shillings (integers); do not accept decimal fractions for UGX.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, displayName TEXT NOT NULL,
  passwordHash TEXT, role TEXT NOT NULL DEFAULT 'ATTENDANT'
    CHECK (role IN ('SOVEREIGN','ATTENDANT','MANAGER','MANAGING_DIRECTOR','CHAIRMAN')),
  isActive INTEGER NOT NULL DEFAULT 0 CHECK (isActive IN (0,1)),
  agentId TEXT UNIQUE, phone TEXT,
  identityStatus TEXT NOT NULL DEFAULT 'PENDING' CHECK (identityStatus IN ('PENDING','VERIFIED','REJECTED')),
  approvedAt TEXT, failedLoginCount INTEGER NOT NULL DEFAULT 0 CHECK (failedLoginCount >= 0),
  lockedUntil TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS User_role_isActive_idx ON User(role,isActive);
CREATE INDEX IF NOT EXISTS User_identityStatus_createdAt_idx ON User(identityStatus,createdAt);

CREATE TABLE IF NOT EXISTS Product (
  id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, category TEXT,
  variant TEXT CHECK (variant IS NULL OR json_valid(variant)),
  costPrice INTEGER NOT NULL CHECK (costPrice >= 0), sellingPrice INTEGER NOT NULL CHECK (sellingPrice >= 0),
  quantityOnHand INTEGER NOT NULL DEFAULT 0, reorderLevel INTEGER NOT NULL DEFAULT 0 CHECK (reorderLevel >= 0),
  isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS Product_name_idx ON Product(name);
CREATE INDEX IF NOT EXISTS Product_category_isActive_idx ON Product(category,isActive);
CREATE INDEX IF NOT EXISTS Product_stock_idx ON Product(quantityOnHand,reorderLevel);

CREATE TABLE IF NOT EXISTS RetailSale (
  id TEXT PRIMARY KEY, receiptNumber TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED')),
  currency TEXT NOT NULL DEFAULT 'UGX', subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  discountTotal INTEGER NOT NULL DEFAULT 0 CHECK (discountTotal >= 0),
  taxTotal INTEGER NOT NULL DEFAULT 0 CHECK (taxTotal >= 0), total INTEGER NOT NULL CHECK (total >= 0),
  costOfGoods INTEGER NOT NULL CHECK (costOfGoods >= 0), paymentMethod TEXT,
  efrisStatus TEXT NOT NULL DEFAULT 'DRAFT' CHECK (efrisStatus IN ('DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED')),
  efrisInvoiceId TEXT, efrisFiscalData TEXT CHECK (efrisFiscalData IS NULL OR json_valid(efrisFiscalData)),
  notes TEXT, createdById TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS RetailSale_actor_idx ON RetailSale(createdById);
CREATE INDEX IF NOT EXISTS RetailSale_created_status_idx ON RetailSale(createdAt,status);
CREATE INDEX IF NOT EXISTS RetailSale_efris_idx ON RetailSale(efrisStatus,createdAt);

CREATE TABLE IF NOT EXISTS RetailSaleLine (
  id TEXT PRIMARY KEY, saleId TEXT NOT NULL REFERENCES RetailSale(id) ON DELETE RESTRICT,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE RESTRICT,
  skuSnapshot TEXT NOT NULL, nameSnapshot TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
  unitPrice INTEGER NOT NULL CHECK (unitPrice >= 0), unitCost INTEGER NOT NULL CHECK (unitCost >= 0),
  lineTotal INTEGER NOT NULL CHECK (lineTotal >= 0)
);
CREATE INDEX IF NOT EXISTS RetailSaleLine_sale_idx ON RetailSaleLine(saleId);
CREATE INDEX IF NOT EXISTS RetailSaleLine_product_idx ON RetailSaleLine(productId);

CREATE TABLE IF NOT EXISTS StockMovement (
  id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES Product(id) ON DELETE RESTRICT,
  actorId TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('OPENING','PURCHASE','SALE','RETURN','ADJUSTMENT','DAMAGE')),
  quantityDelta INTEGER NOT NULL, quantityAfter INTEGER NOT NULL, unitCost INTEGER,
  referenceType TEXT, referenceId TEXT, reason TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS StockMovement_product_created_idx ON StockMovement(productId,createdAt);
CREATE INDEX IF NOT EXISTS StockMovement_actor_idx ON StockMovement(actorId);
CREATE INDEX IF NOT EXISTS StockMovement_reference_idx ON StockMovement(referenceType,referenceId);

CREATE TABLE IF NOT EXISTS AgencyTransaction (
  id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('CASH_IN','CASH_OUT','FLOAT_ADJUSTMENT','REVERSAL')),
  provider TEXT, providerReference TEXT,
  providerStatus TEXT NOT NULL DEFAULT 'DRAFT' CHECK (providerStatus IN ('DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED')),
  amount INTEGER NOT NULL CHECK (amount >= 0), commission INTEGER NOT NULL DEFAULT 0 CHECK (commission >= 0),
  currency TEXT NOT NULL DEFAULT 'UGX', customerReference TEXT, idempotencyKey TEXT NOT NULL UNIQUE,
  requestMetadata TEXT CHECK (requestMetadata IS NULL OR json_valid(requestMetadata)),
  responseMetadata TEXT CHECK (responseMetadata IS NULL OR json_valid(responseMetadata)),
  failureCode TEXT, failureMessage TEXT, createdById TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS AgencyTransaction_actor_idx ON AgencyTransaction(createdById);
CREATE INDEX IF NOT EXISTS AgencyTransaction_created_status_idx ON AgencyTransaction(createdAt,providerStatus);
CREATE INDEX IF NOT EXISTS AgencyTransaction_provider_ref_idx ON AgencyTransaction(provider,providerReference);
CREATE INDEX IF NOT EXISTS AgencyTransaction_type_created_idx ON AgencyTransaction(type,createdAt);

CREATE TABLE IF NOT EXISTS LedgerEntry (
  id TEXT PRIMARY KEY, ledgerType TEXT NOT NULL CHECK (ledgerType IN ('RETAIL','FINTECH_AGENCY')),
  accountCode TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'UGX',
  debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0), credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  sourceType TEXT NOT NULL, sourceId TEXT NOT NULL, idempotencyKey TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL, effectiveAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX IF NOT EXISTS LedgerEntry_type_effective_idx ON LedgerEntry(ledgerType,effectiveAt);
CREATE INDEX IF NOT EXISTS LedgerEntry_account_effective_idx ON LedgerEntry(ledgerType,accountCode,effectiveAt);
CREATE INDEX IF NOT EXISTS LedgerEntry_source_idx ON LedgerEntry(sourceType,sourceId);

CREATE TABLE IF NOT EXISTS AuditEvent (
  id TEXT PRIMARY KEY, actorId TEXT REFERENCES User(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','APPROVE','REJECT','LOGIN','LOGOUT','OVERRIDE','RECONCILE','EXPORT')),
  entityType TEXT NOT NULL, entityId TEXT, reason TEXT, beforeState TEXT CHECK (beforeState IS NULL OR json_valid(beforeState)),
  afterState TEXT CHECK (afterState IS NULL OR json_valid(afterState)), ipAddress TEXT, requestId TEXT,
  approverId TEXT REFERENCES User(id) ON DELETE RESTRICT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS AuditEvent_actor_created_idx ON AuditEvent(actorId,createdAt);
CREATE INDEX IF NOT EXISTS AuditEvent_approver_idx ON AuditEvent(approverId);
CREATE INDEX IF NOT EXISTS AuditEvent_entity_created_idx ON AuditEvent(entityType,entityId,createdAt);
CREATE INDEX IF NOT EXISTS AuditEvent_action_created_idx ON AuditEvent(action,createdAt);

CREATE TABLE IF NOT EXISTS ReconciliationSession (
  id TEXT PRIMARY KEY, ledgerType TEXT NOT NULL CHECK (ledgerType IN ('RETAIL','FINTECH_AGENCY')),
  businessDate TEXT NOT NULL, expectedCash INTEGER NOT NULL CHECK (expectedCash >= 0),
  countedCash INTEGER NOT NULL CHECK (countedCash >= 0), expectedFloat INTEGER CHECK (expectedFloat IS NULL OR expectedFloat >= 0),
  countedFloat INTEGER CHECK (countedFloat IS NULL OR countedFloat >= 0), difference INTEGER NOT NULL,
  notes TEXT, preparedById TEXT NOT NULL, approvedById TEXT, status TEXT NOT NULL DEFAULT 'OPEN',
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ledgerType,businessDate,preparedById)
);
CREATE INDEX IF NOT EXISTS ReconciliationSession_date_type_status_idx ON ReconciliationSession(businessDate,ledgerType,status);

-- Money contract for this D1 schema: UGX amounts are whole shillings stored as integers.
-- Any future multi-currency support must define explicit currency-specific precision and conversion rules.
-- Application code must use explicit transactions for stock decrement + sale + stock movement +
-- balanced ledger writes; D1 batch/transaction behavior must be proven with tests before cutover.
