#!/usr/bin/env python3
"""Local-only D1/SQLite schema compatibility tests using Python's SQLite engine.

This validates schema constraints with synthetic data; it does not emulate Cloudflare
D1's remote API, concurrency, or transaction semantics.
"""
from pathlib import Path
import sqlite3
import tempfile

MIGRATIONS = sorted(Path(__file__).glob("[0-9][0-9][0-9][0-9]_*.sql"))


def expect_integrity_error(db, sql, params=()):
    try:
        db.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Expected an integrity error for: {sql}")


def main():
    with tempfile.NamedTemporaryFile(suffix=".sqlite") as tmp:
        db = sqlite3.connect(tmp.name)
        db.execute("PRAGMA foreign_keys = ON")
        for migration in MIGRATIONS:\n            db.executescript(migration.read_text(encoding="utf-8"))

        db.execute(
            "INSERT INTO User(id,email,displayName,role,isActive,identityStatus) VALUES (?,?,?,?,?,?)",
            ("u1", "manager@example.invalid", "Test Manager", "MANAGER", 1, "VERIFIED"),
        )
        db.execute(
            "INSERT INTO Product(id,sku,name,costPrice,sellingPrice,quantityOnHand,reorderLevel) VALUES (?,?,?,?,?,?,?)",
            ("p1", "SKU-TEST-1", "Synthetic phone", 100000, 150000, 5, 1),
        )
        db.execute(
            "INSERT INTO AgencyTransaction(id,reference,type,providerStatus,amount,commission,idempotencyKey,createdById) VALUES (?,?,?,?,?,?,?,?)",
            ("a1", "REF-TEST-1", "CASH_IN", "SUCCEEDED", 50000, 1000, "idem-test-1", "u1"),
        )

        # Uniqueness/idempotency must prevent the same operation being accepted twice.
        expect_integrity_error(
            db,
            "INSERT INTO AgencyTransaction(id,reference,type,providerStatus,amount,commission,idempotencyKey,createdById) VALUES (?,?,?,?,?,?,?,?)",
            ("a2", "REF-TEST-2", "CASH_IN", "SUCCEEDED", 50000, 1000, "idem-test-1", "u1"),
        )
        # Check constraints reject negative money.
        expect_integrity_error(
            db,
            "INSERT INTO AgencyTransaction(id,reference,type,providerStatus,amount,commission,idempotencyKey,createdById) VALUES (?,?,?,?,?,?,?,?)",
            ("a3", "REF-TEST-3", "CASH_IN", "SUCCEEDED", -1, 0, "idem-test-3", "u1"),
        )
        # Foreign keys reject references to missing staff.
        expect_integrity_error(
            db,
            "INSERT INTO RetailSale(id,receiptNumber,status,subtotal,discountTotal,taxTotal,total,costOfGoods,createdById) VALUES (?,?,?,?,?,?,?,?,?)",
            ("s1", "RCPT-TEST-1", "SUCCEEDED", 100, 0, 0, 100, 50, "missing-user"),
        )

        db.execute(
            "INSERT INTO LedgerEntry(id,ledgerType,accountCode,debit,credit,sourceType,sourceId,idempotencyKey,description) VALUES (?,?,?,?,?,?,?,?,?)",
            ("l1", "RETAIL", "CASH", 150000, 0, "SALE", "sale-test-1", "ledger-test-debit", "Synthetic debit"),
        )
        db.execute(
            "INSERT INTO LedgerEntry(id,ledgerType,accountCode,debit,credit,sourceType,sourceId,idempotencyKey,description) VALUES (?,?,?,?,?,?,?,?,?)",
            ("l2", "RETAIL", "SALES", 0, 150000, "SALE", "sale-test-1", "ledger-test-credit", "Synthetic credit"),
        )
        debit, credit = db.execute(
            "SELECT SUM(debit), SUM(credit) FROM LedgerEntry WHERE sourceType = 'SALE' AND sourceId = 'sale-test-1'"
        ).fetchone()
        assert debit == credit == 150000, (debit, credit)

        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
        assert db.execute("SELECT COUNT(*) FROM User").fetchone()[0] == 1\n        assert db.execute("SELECT COUNT(*) FROM AuthIdentity").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM Product").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM AgencyTransaction").fetchone()[0] == 1
        db.close()
    print("PASS: ordered D1 migrations, auth identity linking, schema constraints, FK checks, idempotency uniqueness, and synthetic balanced-ledger fixture")


if __name__ == "__main__":
    main()
