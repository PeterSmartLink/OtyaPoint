-- Enforce double-entry journal posting in the database, not only in API code.
-- This migration is for isolated validation first. Do not apply to production
-- until the live schema lineage and existing ledger rows have been reconciled.
CREATE TABLE IF NOT EXISTS omni_ledger_journals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  ledger_type TEXT NOT NULL CHECK (ledger_type IN ('RETAIL','FINTECH_AGENCY')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_omni_ledger_journals_company_date
  ON omni_ledger_journals(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_ledger_journals_source
  ON omni_ledger_journals(company_id, source_type, source_id);

ALTER TABLE omni_ledger_entries
  ADD COLUMN journal_id TEXT REFERENCES omni_ledger_journals(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_omni_ledger_entries_journal
  ON omni_ledger_entries(journal_id);

-- New entries must belong to a draft journal in the same tenant and accounting domain.
CREATE TRIGGER IF NOT EXISTS omni_ledger_entry_journal_guard
BEFORE INSERT ON omni_ledger_entries
BEGIN
  SELECT CASE
    WHEN NEW.journal_id IS NULL
      THEN RAISE(ABORT, 'LEDGER_JOURNAL_REQUIRED')
    WHEN NOT EXISTS (
      SELECT 1 FROM omni_ledger_journals j
      WHERE j.id = NEW.journal_id
        AND j.company_id = NEW.company_id
        AND j.ledger_type = NEW.ledger_type
        AND j.source_type = NEW.source_type
        AND j.source_id = NEW.source_id
        AND j.status = 'DRAFT'
    ) THEN RAISE(ABORT, 'LEDGER_JOURNAL_MISMATCH_OR_ALREADY_POSTED')
  END;
END;

-- A journal may be posted only when it has at least two entries, positive value,
-- and equal total debits/credits. Failed posting leaves it in DRAFT.
CREATE TRIGGER IF NOT EXISTS omni_ledger_journal_post_guard
BEFORE UPDATE OF status ON omni_ledger_journals
WHEN NEW.status = 'POSTED' AND OLD.status != 'POSTED'
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM omni_ledger_entries WHERE journal_id = NEW.id) < 2
      THEN RAISE(ABORT, 'LEDGER_JOURNAL_NEEDS_TWO_ENTRIES')
    WHEN COALESCE((SELECT SUM(debit) FROM omni_ledger_entries WHERE journal_id = NEW.id), 0) <= 0
      THEN RAISE(ABORT, 'LEDGER_JOURNAL_VALUE_MUST_BE_POSITIVE')
    WHEN COALESCE((SELECT SUM(debit) FROM omni_ledger_entries WHERE journal_id = NEW.id), 0)
       != COALESCE((SELECT SUM(credit) FROM omni_ledger_entries WHERE journal_id = NEW.id), 0)
      THEN RAISE(ABORT, 'LEDGER_JOURNAL_UNBALANCED')
  END;
END;

-- Posted journals and their entries are immutable; corrections use compensating journals.
CREATE TRIGGER IF NOT EXISTS omni_ledger_entry_posted_update_guard
BEFORE UPDATE ON omni_ledger_entries
WHEN OLD.journal_id IS NOT NULL
 AND (SELECT status FROM omni_ledger_journals WHERE id = OLD.journal_id) = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'POSTED_LEDGER_ENTRY_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS omni_ledger_entry_posted_delete_guard
BEFORE DELETE ON omni_ledger_entries
WHEN OLD.journal_id IS NOT NULL
 AND (SELECT status FROM omni_ledger_journals WHERE id = OLD.journal_id) = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'POSTED_LEDGER_ENTRY_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS omni_ledger_journal_posted_update_guard
BEFORE UPDATE ON omni_ledger_journals
WHEN OLD.status = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'POSTED_LEDGER_JOURNAL_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS omni_ledger_journal_posted_delete_guard
BEFORE DELETE ON omni_ledger_journals
WHEN OLD.status = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'POSTED_LEDGER_JOURNAL_IMMUTABLE');
END;
