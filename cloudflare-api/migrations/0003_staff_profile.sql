-- Local OmniPoint staff display metadata. Identity remains owned by Otya Auth.
ALTER TABLE omni_staff_memberships ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE omni_staff_memberships ADD COLUMN email TEXT;
ALTER TABLE omni_staff_memberships ADD COLUMN agent_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_omni_staff_agent_id
  ON omni_staff_memberships(agent_id) WHERE agent_id IS NOT NULL;
