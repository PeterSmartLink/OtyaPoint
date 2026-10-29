-- Persist a fingerprint of the normalized sale request so an idempotency key
-- cannot silently replay a different payload. Existing rows remain NULL and are
-- treated as legacy keys that cannot be safely replayed without review.
ALTER TABLE omni_retail_sales ADD COLUMN request_fingerprint TEXT;
