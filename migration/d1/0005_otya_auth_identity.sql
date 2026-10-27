-- Expand identity provider values for the reviewed Otya Auth migration.
-- Apply only to the isolated migration-test D1 until this contract and its tests are reviewed.
-- Existing identity links are preserved; no links are created by this migration.
PRAGMA foreign_keys = ON;

ALTER TABLE AuthIdentity RENAME TO AuthIdentity_legacy;

CREATE TABLE AuthIdentity (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('supabase','otya-auth')),
  authSubject TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revokedAt TEXT,
  UNIQUE(provider, authSubject),
  UNIQUE(provider, userId)
);

INSERT INTO AuthIdentity (id, provider, authSubject, userId, isActive, createdAt, revokedAt)
SELECT id, provider, authSubject, userId, isActive, createdAt, revokedAt
FROM AuthIdentity_legacy;

DROP TABLE AuthIdentity_legacy;

CREATE INDEX IF NOT EXISTS AuthIdentity_user_active_idx
  ON AuthIdentity(userId, isActive);
