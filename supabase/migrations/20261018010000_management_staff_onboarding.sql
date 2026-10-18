CREATE TYPE "IdentityStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "User"
  ALTER COLUMN "isActive" SET DEFAULT false,
  ADD COLUMN "agentId" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "identityStatus" "IdentityStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_agentId_key" ON "User"("agentId");
CREATE INDEX "User_identityStatus_createdAt_idx" ON "User"("identityStatus", "createdAt");

-- New accounts are inactive until management completes identity checks and explicitly approves them.
-- Never store raw national ID numbers or identity-document images in this table.
