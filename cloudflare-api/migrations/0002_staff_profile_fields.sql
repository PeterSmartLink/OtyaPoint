-- Extend local staff profiles for the dashboard and require an explicit verification state.
ALTER TABLE omni_staff_memberships ADD COLUMN email TEXT;
ALTER TABLE omni_staff_memberships ADD COLUMN display_name TEXT;
ALTER TABLE omni_staff_memberships ADD COLUMN agent_id TEXT;
ALTER TABLE omni_staff_memberships ADD COLUMN identity_status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (identity_status IN ('PENDING','VERIFIED','REJECTED'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_omni_staff_agent_id
  ON omni_staff_memberships(agent_id) WHERE agent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_omni_staff_email
  ON omni_staff_memberships(lower(email)) WHERE email IS NOT NULL;
