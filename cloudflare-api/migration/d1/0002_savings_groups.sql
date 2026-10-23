-- OmniPoint savings-group foundation (D1 / SQLite)
-- Additive migration. Stores money as integer minor units; for UGX, use whole shillings.
-- This migration creates tables only. It does not move funds or connect a payment provider.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS SavingsGroup (
  id TEXT PRIMARY KEY,
  groupCode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','CLOSED')),
  contributionFrequency TEXT NOT NULL DEFAULT 'FLEXIBLE'
    CHECK (contributionFrequency IN ('DAILY','WEEKLY','BIWEEKLY','MONTHLY','FLEXIBLE')),
  shareUnitAmount INTEGER NOT NULL DEFAULT 0 CHECK (shareUnitAmount >= 0),
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS SavingsGroupMember (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL REFERENCES SavingsGroup(id) ON DELETE RESTRICT,
  memberCode TEXT NOT NULL,
  displayName TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','EXITED')),
  joinedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(groupId, memberCode),
  UNIQUE(groupId, id)
);

CREATE INDEX IF NOT EXISTS idx_savings_members_group_status
  ON SavingsGroupMember(groupId, status, displayName);

CREATE TABLE IF NOT EXISTS SavingsContribution (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  memberId TEXT NOT NULL,
  contributionType TEXT NOT NULL DEFAULT 'SAVING'
    CHECK (contributionType IN ('SAVING','SHARE_PURCHASE','FEE','ADJUSTMENT')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (length(currency) = 3),
  paymentMethod TEXT NOT NULL DEFAULT 'CASH'
    CHECK (paymentMethod IN ('CASH','MOBILE_MONEY','BANK','OTHER')),
  externalReference TEXT,
  idempotencyKey TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING','POSTED','REVERSED')),
  receivedById TEXT NOT NULL,
  notes TEXT,
  occurredAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(groupId, memberId) REFERENCES SavingsGroupMember(groupId, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_savings_contribution_member_date
  ON SavingsContribution(groupId, memberId, occurredAt DESC);
CREATE INDEX IF NOT EXISTS idx_savings_contribution_status_date
  ON SavingsContribution(status, occurredAt DESC);

CREATE TABLE IF NOT EXISTS SavingsLoan (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  borrowerMemberId TEXT NOT NULL,
  loanCode TEXT NOT NULL,
  principalAmount INTEGER NOT NULL CHECK (principalAmount > 0),
  interestAmount INTEGER NOT NULL DEFAULT 0 CHECK (interestAmount >= 0),
  feeAmount INTEGER NOT NULL DEFAULT 0 CHECK (feeAmount >= 0),
  penaltyAmount INTEGER NOT NULL DEFAULT 0 CHECK (penaltyAmount >= 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','DISBURSED','REJECTED','CLOSED','DEFAULTED')),
  requestedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  approvedById TEXT,
  approvedAt TEXT,
  disbursedAt TEXT,
  dueAt TEXT,
  repaymentSchedule TEXT,
  guarantorMemberIds TEXT,
  idempotencyKey TEXT NOT NULL UNIQUE,
  createdById TEXT NOT NULL,
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(groupId, loanCode),
  FOREIGN KEY(groupId, borrowerMemberId) REFERENCES SavingsGroupMember(groupId, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_savings_loan_group_status
  ON SavingsLoan(groupId, status, requestedAt DESC);
CREATE INDEX IF NOT EXISTS idx_savings_loan_borrower
  ON SavingsLoan(groupId, borrowerMemberId, status);

CREATE TABLE IF NOT EXISTS SavingsLoanRepayment (
  id TEXT PRIMARY KEY,
  loanId TEXT NOT NULL REFERENCES SavingsLoan(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  principalPortion INTEGER NOT NULL DEFAULT 0 CHECK (principalPortion >= 0),
  interestPortion INTEGER NOT NULL DEFAULT 0 CHECK (interestPortion >= 0),
  feePortion INTEGER NOT NULL DEFAULT 0 CHECK (feePortion >= 0),
  penaltyPortion INTEGER NOT NULL DEFAULT 0 CHECK (penaltyPortion >= 0),
  currency TEXT NOT NULL DEFAULT 'UGX' CHECK (length(currency) = 3),
  paymentMethod TEXT NOT NULL DEFAULT 'CASH'
    CHECK (paymentMethod IN ('CASH','MOBILE_MONEY','BANK','OTHER')),
  externalReference TEXT,
  idempotencyKey TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING','POSTED','REVERSED')),
  receivedById TEXT NOT NULL,
  occurredAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (amount = principalPortion + interestPortion + feePortion + penaltyPortion)
);

CREATE INDEX IF NOT EXISTS idx_savings_repayment_loan_date
  ON SavingsLoanRepayment(loanId, occurredAt DESC);

CREATE TABLE IF NOT EXISTS SavingsGroupAuditEvent (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL REFERENCES SavingsGroup(id) ON DELETE RESTRICT,
  actorId TEXT NOT NULL,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  reason TEXT,
  requestId TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_savings_group_audit
  ON SavingsGroupAuditEvent(groupId, createdAt DESC);
