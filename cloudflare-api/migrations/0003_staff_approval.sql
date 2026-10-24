-- Staff review metadata and guarded approval state transitions.
ALTER TABLE omni_staff_memberships ADD COLUMN phone TEXT;
ALTER TABLE omni_staff_memberships ADD COLUMN approved_by TEXT;
ALTER TABLE omni_staff_memberships ADD COLUMN approved_at TEXT;

CREATE TRIGGER IF NOT EXISTS omni_staff_review_guard
BEFORE UPDATE OF status, identity_status ON omni_staff_memberships
WHEN OLD.status != 'PENDING' OR OLD.identity_status != 'PENDING'
BEGIN
  SELECT RAISE(ABORT, 'STAFF_ALREADY_REVIEWED');
END;

CREATE TRIGGER IF NOT EXISTS omni_staff_review_state_guard
BEFORE UPDATE OF status, identity_status ON omni_staff_memberships
WHEN NOT (
  (NEW.status = 'ACTIVE' AND NEW.identity_status = 'VERIFIED') OR
  (NEW.status = 'REVOKED' AND NEW.identity_status = 'REJECTED')
)
BEGIN
  SELECT RAISE(ABORT, 'INVALID_STAFF_REVIEW_STATE');
END;
