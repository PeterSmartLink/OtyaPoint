-- OmniPoint provider-neutral payment operation foundation.
-- Schema-only migration. Apply only to isolated test D1 after review.
-- No provider calls or financial posting are enabled by this migration.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS PaymentOperation (
  id TEXT PRIMARY KEY,
  operationReference TEXT NOT NULL UNIQUE,
  operationType TEXT NOT NULL CHECK (operationType IN (
    'RETAIL_PAYMENT','CASH_IN','CASH_OUT','AIRTIME','DATA','BILL_PAYMENT',
    'FLOAT_PURCHASE','REFUND','REVERSAL'
  )),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED'
  )),
  selectedProvider TEXT CHECK (selectedProvider IS NULL OR selectedProvider IN (
    'INTERSWITCH','AIRTEL_MONEY','MTN_MOMO'
  )),
  selectedProduct TEXT,
  amountMinorUnits INTEGER NOT NULL CHECK (amountMinorUnits > 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  requestFingerprint TEXT NOT NULL,
  idempotencyKey TEXT NOT NULL UNIQUE,
  customerReference TEXT,
  linkedSaleId TEXT REFERENCES RetailSale(id) ON DELETE RESTRICT,
  createdById TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS PaymentOperation_status_created_idx
  ON PaymentOperation(status,createdAt);
CREATE INDEX IF NOT EXISTS PaymentOperation_provider_status_idx
  ON PaymentOperation(selectedProvider,status,createdAt);
CREATE INDEX IF NOT EXISTS PaymentOperation_sale_idx
  ON PaymentOperation(linkedSaleId);

CREATE TABLE IF NOT EXISTS ProviderAttempt (
  id TEXT PRIMARY KEY,
  operationId TEXT NOT NULL REFERENCES PaymentOperation(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('INTERSWITCH','AIRTEL_MONEY','MTN_MOMO')),
  product TEXT NOT NULL,
  attemptNumber INTEGER NOT NULL CHECK (attemptNumber > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING','SUCCEEDED','FAILED','UNKNOWN','CANCELLED'
  )),
  providerReference TEXT,
  responseCode TEXT,
  responseSummary TEXT,
  startedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt TEXT,
  UNIQUE(operationId,attemptNumber),
  UNIQUE(provider,providerReference)
);
CREATE INDEX IF NOT EXISTS ProviderAttempt_operation_idx
  ON ProviderAttempt(operationId,attemptNumber);
CREATE INDEX IF NOT EXISTS ProviderAttempt_status_idx
  ON ProviderAttempt(status,startedAt);

-- Store verified event metadata/digests, never raw webhook secrets or unbounded raw payloads.
CREATE TABLE IF NOT EXISTS ProviderEvent (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('INTERSWITCH','AIRTEL_MONEY','MTN_MOMO')),
  providerEventId TEXT NOT NULL,
  operationId TEXT REFERENCES PaymentOperation(id) ON DELETE RESTRICT,
  providerReference TEXT,
  eventType TEXT NOT NULL,
  payloadDigest TEXT NOT NULL,
  signatureVerified INTEGER NOT NULL DEFAULT 0 CHECK (signatureVerified IN (0,1)),
  processedAt TEXT,
  receivedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider,providerEventId)
);
CREATE INDEX IF NOT EXISTS ProviderEvent_operation_idx
  ON ProviderEvent(operationId,receivedAt);
CREATE INDEX IF NOT EXISTS ProviderEvent_unprocessed_idx
  ON ProviderEvent(signatureVerified,processedAt,receivedAt);

-- Append-only operation history. UNKNOWN is explicit; it is not equivalent to failure.
CREATE TABLE IF NOT EXISTS PaymentOperationEvent (
  id TEXT PRIMARY KEY,
  operationId TEXT NOT NULL REFERENCES PaymentOperation(id) ON DELETE RESTRICT,
  eventType TEXT NOT NULL CHECK (eventType IN (
    'CREATED','PROVIDER_SELECTED','ATTEMPT_STARTED','STATUS_CHANGED',
    'STATUS_ENQUIRY','CALLBACK_RECEIVED','RECONCILIATION_EXCEPTION',
    'REVERSAL_RECORDED','MANUAL_REVIEW'
  )),
  fromStatus TEXT CHECK (fromStatus IS NULL OR fromStatus IN (
    'DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED'
  )),
  toStatus TEXT CHECK (toStatus IS NULL OR toStatus IN (
    'DRAFT','PENDING','SUCCEEDED','FAILED','UNKNOWN','REVERSED'
  )),
  reason TEXT NOT NULL,
  metadata TEXT CHECK (metadata IS NULL OR json_valid(metadata)),
  actorId TEXT REFERENCES User(id) ON DELETE RESTRICT,
  requestId TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS PaymentOperationEvent_operation_idx
  ON PaymentOperationEvent(operationId,createdAt);

-- A timeout after submission must be marked UNKNOWN and reconciled before another
-- provider attempt. Enforce that policy in the service layer and test it explicitly.
-- No provider adapter is activated by this migration.
