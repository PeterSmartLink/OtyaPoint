-- Forward-only identity-link migration. Apply only to the isolated migration-test D1 until reviewed.
-- Never link by email alone; authSubject must come from a verified upstream identity token.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS AuthIdentity (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('supabase')),
  authSubject TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES User(id) ON DELETE RESTRICT,
  isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revokedAt TEXT,
  UNIQUE(provider, authSubject),
  UNIQUE(provider, userId)
);

CREATE INDEX IF NOT EXISTS AuthIdentity_user_active_idx
  ON AuthIdentity(userId, isActive);
