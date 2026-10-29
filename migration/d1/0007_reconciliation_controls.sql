-- OmniPoint reconciliation controls and provider feature gates.
-- Additive schema only; this does not enable provider traffic or post financial entries.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ProviderCapability (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('INTERSWITCH','AIRTEL_MONEY','MTN_MOMO')),
  product TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'SANDBOX' CHECK (environment IN ('SANDBOX','PRODUCTION')),
  operationalState TEXT NOT NULL DEFAULT 'DISABLED'
    CHECK (operationalState IN ('DISABLED','SANDBOX_ONLY','READY','DEGRADED','SUSPENDED')),
  capabilities TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(capabilities)),
  reason TEXT NOT NULL DEFAULT 'Not enabled pending contract and safety review',
  changedById TEXT REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider,product,environment),
  CHECK (environment <> 'PRODUCTION' OR operationalState IN ('DISABLED','SUSPENDED'))
);
CREATE INDEX IF NOT EXISTS ProviderCapability_state_idx
  ON ProviderCapability(operationalState,provider,environment);

CREATE TABLE IF NOT EXISTS ReconciliationRun (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope IN ('RETAIL','FINTECH_AGENCY','CASHBOOK','PROVIDER_FLOAT','PROVIDER_SETTLEMENT')),
  provider TEXT CHECK (provider IS NULL OR provider IN ('INTERSWITCH','AIRTEL_MONEY','MTN_MOMO')),
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','IN_PROGRESS','READY_FOR_REVIEW','APPROVED','REJECTED','COMPLETED')),
  expectedTotal INTEGER NOT NULL DEFAULT 0 CHECK (expectedTotal >= 0),
  observedTotal INTEGER NOT NULL DEFAULT 0 CHECK (observedTotal >= 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  summary TEXT CHECK (summary IS NULL OR json_valid(summary)),
  createdById TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  reviewedById TEXT REFERENCES User(id) ON DELETE RESTRICT,
  approvedById TEXT REFERENCES User(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (periodEnd >= periodStart),
  CHECK (reviewedById IS NULL OR reviewedById <> createdById),
  CHECK (approvedById IS NULL OR approvedById <> createdById),
  CHECK (approvedById IS NULL OR reviewedById IS NULL OR approvedById <> reviewedById)
);
CREATE INDEX IF NOT EXISTS ReconciliationRun_scope_period_idx
  ON ReconciliationRun(scope,periodStart,periodEnd);
CREATE INDEX IF NOT EXISTS ReconciliationRun_status_created_idx
  ON ReconciliationRun(status,createdAt);

CREATE TABLE IF NOT EXISTS ReconciliationItem (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL REFERENCES ReconciliationRun(id) ON DELETE RESTRICT,
  sourceType TEXT NOT NULL,
  sourceId TEXT NOT NULL,
  discrepancyType TEXT NOT NULL CHECK (discrepancyType IN (
    'MISSING_INTERNAL','MISSING_PROVIDER','DUPLICATE','AMOUNT_MISMATCH',
    'STATUS_MISMATCH','REFERENCE_MISMATCH','TIMING_DIFFERENCE','OTHER'
  )),
  expectedAmount INTEGER CHECK (expectedAmount IS NULL OR expectedAmount >= 0),
  observedAmount INTEGER CHECK (observedAmount IS NULL OR observedAmount >= 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','WAIVED')),
  resolutionNote TEXT,
  resolvedById TEXT REFERENCES User(id) ON DELETE RESTRICT,
  resolvedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(runId,sourceType,sourceId,discrepancyType),
  CHECK (status = 'OPEN' OR (resolutionNote IS NOT NULL AND length(trim(resolutionNote)) > 0 AND resolvedById IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ReconciliationItem_run_status_idx
  ON ReconciliationItem(runId,status);
CREATE INDEX IF NOT EXISTS ReconciliationItem_source_idx
  ON ReconciliationItem(sourceType,sourceId);

-- Posted ledger entries are append-only. Correct mistakes with compensating entries.
CREATE TRIGGER IF NOT EXISTS LedgerEntry_no_update
BEFORE UPDATE ON LedgerEntry
BEGIN
  SELECT RAISE(ABORT, 'LedgerEntry is append-only; post a compensating entry');
END;
CREATE TRIGGER IF NOT EXISTS LedgerEntry_no_delete
BEFORE DELETE ON LedgerEntry
BEGIN
  SELECT RAISE(ABORT, 'LedgerEntry is append-only; post a compensating entry');
END;

-- Approval and state-transition authorization must also be enforced by the service layer.
-- ProviderCapability is configuration metadata only; no provider requests are activated here.
