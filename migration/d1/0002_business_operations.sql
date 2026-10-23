-- OmniPoint single-shop operations foundation.
-- Schema only: this migration does not call payment providers or move real money.
-- Apply only to the isolated migration-test database during review.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS AgentOperation (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  operationType TEXT NOT NULL CHECK (operationType IN (
    'CASH_IN','CASH_OUT','AIRTIME','DATA','BILL_PAYMENT',
    'BANK_DEPOSIT','BANK_WITHDRAWAL','FLOAT_ADJUSTMENT','REVERSAL'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('CASH','MOBILE_MONEY','BANK','PROVIDER_FLOAT','OTHER')),
  provider TEXT,
  providerReference TEXT,
  providerStatus TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (providerStatus IN ('DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  commission INTEGER NOT NULL DEFAULT 0 CHECK (commission >= 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  customerReference TEXT,
  billerCode TEXT,
  idempotencyKey TEXT NOT NULL UNIQUE,
  notes TEXT,
  createdById TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS AgentOperation_created_status_idx ON AgentOperation(createdAt,providerStatus);
CREATE INDEX IF NOT EXISTS AgentOperation_type_created_idx ON AgentOperation(operationType,createdAt);
CREATE INDEX IF NOT EXISTS AgentOperation_provider_ref_idx ON AgentOperation(provider,providerReference);

CREATE TABLE IF NOT EXISTS CashbookEntry (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  entryType TEXT NOT NULL CHECK (entryType IN (
    'OPENING_BALANCE','RETAIL_RECEIPT','AGENT_CASH_IN','AGENT_CASH_OUT',
    'EXPENSE','SUPPLIER_PAYMENT','OWNER_IN','OWNER_OUT','CORRECTION','REVERSAL'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  sourceType TEXT,
  sourceId TEXT,
  reason TEXT NOT NULL,
  idempotencyKey TEXT NOT NULL UNIQUE,
  actorId TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS CashbookEntry_created_idx ON CashbookEntry(createdAt);
CREATE INDEX IF NOT EXISTS CashbookEntry_source_idx ON CashbookEntry(sourceType,sourceId);

CREATE TABLE IF NOT EXISTS FloatAccount (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  accountLabel TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider,accountLabel)
);

CREATE TABLE IF NOT EXISTS FloatMovement (
  id TEXT PRIMARY KEY,
  floatAccountId TEXT NOT NULL REFERENCES FloatAccount(id) ON DELETE RESTRICT,
  movementType TEXT NOT NULL CHECK (movementType IN (
    'OPENING_BALANCE','FLOAT_PURCHASE','AGENT_TRANSACTION','PROVIDER_SETTLEMENT',
    'CORRECTION','REVERSAL'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  sourceType TEXT,
  sourceId TEXT,
  providerReference TEXT,
  reason TEXT NOT NULL,
  idempotencyKey TEXT NOT NULL UNIQUE,
  actorId TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS FloatMovement_account_created_idx ON FloatMovement(floatAccountId,createdAt);
CREATE INDEX IF NOT EXISTS FloatMovement_source_idx ON FloatMovement(sourceType,sourceId);

CREATE TABLE IF NOT EXISTS AgentOperationEvent (
  id TEXT PRIMARY KEY,
  operationId TEXT NOT NULL REFERENCES AgentOperation(id) ON DELETE RESTRICT,
  eventType TEXT NOT NULL CHECK (eventType IN (
    'CREATED','STATUS_RECORDED','PROVIDER_REFERENCE_ADDED','COMMISSION_CORRECTED',
    'REVERSAL_RECORDED','NOTE_ADDED'
  )),
  fromStatus TEXT,
  toStatus TEXT,
  reason TEXT NOT NULL,
  metadata TEXT CHECK (metadata IS NULL OR json_valid(metadata)),
  actorId TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  requestId TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS AgentOperationEvent_operation_created_idx ON AgentOperationEvent(operationId,createdAt);

-- Do not store running balances here. Derive cash and provider float from append-only movements.
-- Do not treat a locally entered status as provider-verified success.
-- All writes must be audited and idempotent; provider calls remain disabled until a signed,
-- authorized integration and status/reversal/reconciliation tests are approved.
