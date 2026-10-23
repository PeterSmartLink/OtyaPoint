"""SQLite compatibility and integrity tests for the D1 savings-group migration.

Run from the repository root:
  python -m unittest cloudflare-api.tests.test_savings_groups_migration
"""
from pathlib import Path
import sqlite3
import unittest

MIGRATION = Path(__file__).resolve().parents[2] / "migration" / "d1" / "0003_savings_groups.sql"


class SavingsGroupsMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def group(self, group_id="g1", code="G001"):
        self.db.execute(
            "INSERT INTO SavingsGroup (id, groupCode, name, createdById) VALUES (?, ?, ?, ?)",
            (group_id, code, "Test group", "admin"),
        )

    def member(self, member_id="m1", group_id="g1", code="M001"):
        self.db.execute(
            "INSERT INTO SavingsGroupMember (id, groupId, memberCode, displayName, createdById) VALUES (?, ?, ?, ?, ?)",
            (member_id, group_id, code, "Test member", "admin"),
        )

    def test_migration_creates_core_tables(self):
        names = {r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue({
            "SavingsGroup", "SavingsGroupMember", "SavingsContribution",
            "SavingsLoan", "SavingsLoanRepayment", "SavingsGroupAuditEvent",
        }.issubset(names))

    def test_member_must_belong_to_existing_group(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.member(group_id="missing")

    def test_member_codes_are_unique_within_group(self):
        self.group()
        self.member()
        with self.assertRaises(sqlite3.IntegrityError):
            self.member(member_id="m2")

    def test_contribution_requires_positive_amount_and_unique_idempotency(self):
        self.group()
        self.member()
        insert = """INSERT INTO SavingsContribution
          (id, groupId, memberId, amount, idempotencyKey, receivedById)
          VALUES (?, 'g1', 'm1', ?, ?, 'cashier')"""
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(insert, ("c0", 0, "idem-zero"))
        self.db.execute(insert, ("c1", 10000, "idem-1"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(insert, ("c2", 10000, "idem-1"))

    def test_cross_group_member_reference_is_rejected(self):
        self.group("g1", "G001")
        self.group("g2", "G002")
        self.member("m1", "g1", "M001")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO SavingsContribution
                (id, groupId, memberId, amount, idempotencyKey, receivedById)
                VALUES ('c1', 'g2', 'm1', 100, 'idem-cross', 'cashier')"""
            )

    def test_repayment_allocation_must_equal_total(self):
        self.group()
        self.member()
        self.db.execute(
            """INSERT INTO SavingsLoan
            (id, groupId, borrowerMemberId, loanCode, principalAmount, idempotencyKey, createdById)
            VALUES ('l1', 'g1', 'm1', 'L001', 100000, 'loan-idem', 'admin')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO SavingsLoanRepayment
                (id, loanId, amount, principalPortion, interestPortion, feePortion,
                 penaltyPortion, idempotencyKey, receivedById)
                VALUES ('r1', 'l1', 10000, 9000, 500, 0, 0, 'repay-idem', 'cashier')"""
            )

    def test_contributions_default_to_pending_until_ledger_posting_exists(self):
        self.group()
        self.member()
        self.db.execute(
            """INSERT INTO SavingsContribution
            (id, groupId, memberId, amount, idempotencyKey, receivedById)
            VALUES ('c1', 'g1', 'm1', 10000, 'idem-pending', 'cashier')"""
        )
        self.assertEqual(
            self.db.execute("SELECT status FROM SavingsContribution WHERE id='c1'").fetchone()[0],
            "PENDING",
        )

    def test_repayments_default_to_pending_until_ledger_posting_exists(self):
        self.group()
        self.member()
        self.db.execute(
            """INSERT INTO SavingsLoan
            (id, groupId, borrowerMemberId, loanCode, principalAmount, idempotencyKey, createdById)
            VALUES ('l1', 'g1', 'm1', 'L001', 100000, 'loan-idem', 'admin')"""
        )
        self.db.execute(
            """INSERT INTO SavingsLoanRepayment
            (id, loanId, amount, principalPortion, interestPortion, feePortion,
             penaltyPortion, idempotencyKey, receivedById)
            VALUES ('r1', 'l1', 10000, 10000, 0, 0, 0, 'repay-pending', 'cashier')"""
        )
        self.assertEqual(
            self.db.execute("SELECT status FROM SavingsLoanRepayment WHERE id='r1'").fetchone()[0],
            "PENDING",
        )

    def test_valid_repayment_is_accepted(self):
        self.group()
        self.member()
        self.db.execute(
            """INSERT INTO SavingsLoan
            (id, groupId, borrowerMemberId, loanCode, principalAmount, idempotencyKey, createdById)
            VALUES ('l1', 'g1', 'm1', 'L001', 100000, 'loan-idem', 'admin')"""
        )
        self.db.execute(
            """INSERT INTO SavingsLoanRepayment
            (id, loanId, amount, principalPortion, interestPortion, feePortion,
             penaltyPortion, idempotencyKey, receivedById)
            VALUES ('r1', 'l1', 10000, 9000, 1000, 0, 0, 'repay-idem', 'cashier')"""
        )
        self.assertEqual(
            self.db.execute("SELECT amount FROM SavingsLoanRepayment WHERE id='r1'").fetchone()[0],
            10000,
        )


if __name__ == "__main__":
    unittest.main()
