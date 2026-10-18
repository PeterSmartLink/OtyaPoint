-- Cover foreign-key columns flagged by the Supabase performance advisor.
-- These indexes also support actor/approver lookups and parent-row delete checks.
CREATE INDEX IF NOT EXISTS "RetailSale_createdById_idx" ON "RetailSale"("createdById");
CREATE INDEX IF NOT EXISTS "StockMovement_actorId_idx" ON "StockMovement"("actorId");
CREATE INDEX IF NOT EXISTS "AgencyTransaction_createdById_idx" ON "AgencyTransaction"("createdById");
CREATE INDEX IF NOT EXISTS "AuditEvent_approverId_idx" ON "AuditEvent"("approverId");
