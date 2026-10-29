-- Bind each sale idempotency key to the canonical request that created it.
-- Existing rows remain NULL by design: their original request payload was not
-- persisted, so a replay cannot safely be assumed equivalent and must conflict.
ALTER TABLE omni_retail_sales ADD COLUMN request_fingerprint TEXT;
