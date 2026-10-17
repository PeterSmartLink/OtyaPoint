-- OmniPoint initial schema migration.
-- Generated as a reviewed SQL baseline for the Prisma models.
-- No application roles or permissive client policies are created in this migration.
-- RLS is enabled on every public table; anon/authenticated clients have no policies
-- and therefore cannot read or mutate these tables through Supabase's Data API.
-- Apply only after reviewing this file and confirming the intended target project.

CREATE TYPE "UserRole" AS ENUM ('ATTENDANT', 'MANAGER', 'MANAGING_DIRECTOR', 'CHAIRMAN');
CREATE TYPE "LedgerType" AS ENUM ('RETAIL', 'FINTECH_AGENCY');
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE');
CREATE TYPE "AgencyTransactionType" AS ENUM ('CASH_IN', 'CASH_OUT', 'FLOAT_ADJUSTMENT', 'REVERSAL');
CREATE TYPE "ProviderStatus" AS ENUM ('DRAFT', 'PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'REVERSED');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'OVERRIDE', 'RECONCILE', 'EXPORT');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'ATTENDANT',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY,
  "sku" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "variant" JSONB,
  "costPrice" DECIMAL(18,2) NOT NULL,
  "sellingPrice" DECIMAL(18,2) NOT NULL,
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "reorderLevel" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "RetailSale" (
  "id" TEXT PRIMARY KEY,
  "receiptNumber" TEXT NOT NULL UNIQUE,
  "status" "ProviderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'UGX',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL,
  "costOfGoods" DECIMAL(18,2) NOT NULL,
  "paymentMethod" TEXT,
  "efrisStatus" "ProviderStatus" NOT NULL DEFAULT 'DRAFT',
  "efrisInvoiceId" TEXT,
  "efrisFiscalData" JSONB,
  "notes" TEXT,
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "RetailSaleLine" (
  "id" TEXT PRIMARY KEY,
  "saleId" TEXT NOT NULL REFERENCES "RetailSale"("id") ON DELETE RESTRICT,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
  "skuSnapshot" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "unitCost" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL
);

CREATE TABLE "StockMovement" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "type" "StockMovementType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "unitCost" DECIMAL(18,2),
  "referenceType" TEXT,
  "referenceId" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AgencyTransaction" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL UNIQUE,
  "type" "AgencyTransactionType" NOT NULL,
  "provider" TEXT,
  "providerReference" TEXT,
  "providerStatus" "ProviderStatus" NOT NULL DEFAULT 'DRAFT',
  "amount" DECIMAL(18,2) NOT NULL,
  "commission" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'UGX',
  "customerReference" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "requestMetadata" JSONB,
  "responseMetadata" JSONB,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT PRIMARY KEY,
  "ledgerType" "LedgerType" NOT NULL,
  "accountCode" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UGX',
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "description" TEXT NOT NULL,
  "effectiveAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditEvent" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "reason" TEXT,
  "beforeState" JSONB,
  "afterState" JSONB,
  "ipAddress" TEXT,
  "requestId" TEXT,
  "approverId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ReconciliationSession" (
  "id" TEXT PRIMARY KEY,
  "ledgerType" "LedgerType" NOT NULL,
  "businessDate" DATE NOT NULL,
  "expectedCash" DECIMAL(18,2) NOT NULL,
  "countedCash" DECIMAL(18,2) NOT NULL,
  "expectedFloat" DECIMAL(18,2),
  "countedFloat" DECIMAL(18,2),
  "difference" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "preparedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ReconciliationSession_ledgerType_businessDate_preparedById_key"
    UNIQUE ("ledgerType", "businessDate", "preparedById")
);

CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "Product_name_idx" ON "Product"("name");
CREATE INDEX "Product_category_isActive_idx" ON "Product"("category", "isActive");
CREATE INDEX "Product_quantityOnHand_reorderLevel_idx" ON "Product"("quantityOnHand", "reorderLevel");
CREATE INDEX "RetailSale_createdAt_status_idx" ON "RetailSale"("createdAt", "status");
CREATE INDEX "RetailSale_efrisStatus_createdAt_idx" ON "RetailSale"("efrisStatus", "createdAt");
CREATE INDEX "RetailSaleLine_saleId_idx" ON "RetailSaleLine"("saleId");
CREATE INDEX "RetailSaleLine_productId_idx" ON "RetailSaleLine"("productId");
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");
CREATE INDEX "AgencyTransaction_createdAt_providerStatus_idx" ON "AgencyTransaction"("createdAt", "providerStatus");
CREATE INDEX "AgencyTransaction_provider_providerReference_idx" ON "AgencyTransaction"("provider", "providerReference");
CREATE INDEX "AgencyTransaction_type_createdAt_idx" ON "AgencyTransaction"("type", "createdAt");
CREATE INDEX "LedgerEntry_ledgerType_effectiveAt_idx" ON "LedgerEntry"("ledgerType", "effectiveAt");
CREATE INDEX "LedgerEntry_ledgerType_accountCode_effectiveAt_idx" ON "LedgerEntry"("ledgerType", "accountCode", "effectiveAt");
CREATE INDEX "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry"("sourceType", "sourceId");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
CREATE INDEX "ReconciliationSession_businessDate_ledgerType_status_idx" ON "ReconciliationSession"("businessDate", "ledgerType", "status");

-- Keep all application tables inaccessible through the public Data API until
-- authenticated server-side authorization and explicit policies are reviewed.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetailSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetailSaleLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgencyTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReconciliationSession" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "LedgerEntry" IS 'Separate accounting entries by ledgerType; corrections must be compensating entries, not silent edits.';
COMMENT ON TABLE "AgencyTransaction" IS 'A local record is not proof of provider success; only verified provider status may mark SUCCEEDED.';
COMMENT ON TABLE "AuditEvent" IS 'Audit history; application must enforce append-only behavior and avoid recording secrets.';
