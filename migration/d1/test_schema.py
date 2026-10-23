#!/usr/bin/env python3
"""Local-only D1/SQLite schema compatibility tests using Python's SQLite engine.

This validates schema constraints with synthetic data; it does not emulate Cloudflare
D1's remote API, concurrency, or transaction semantics.
"""
from pathlib import Path
import sqlite3
import tempfile

MIGRATIONS = sorted(Path(__file__).resolve().parent.glob("[0-9][0-9][0-9][0-9]_*.sql"))


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
        for migration in MIGRATIONS:
            db.executescript(migration.read_text(encoding="utf-8"))

        db.execute(
            "INSERT INTO User(id,email,displayName,role,isActive,identityStatus) VALUES (?,?,?,?,?,?)",
            ("u1", "manager@example.invalid", "Test Manager", "MANAGER", 1, "VERIFIED"),
        )
        db.execute(
            "INSERT INTO AuthIdentity(id,provider,authSubject,userId) VALUES (?,?,?,?)",
            ("identity-1", "supabase", "synthetic-auth-subject-1", "u1"),
        )

        # Duplicate upstream subject must not link to another profile.
        expect_integrity_error(
            db,
            "INSERT INTO AuthIdentity(id,provider,authSubject,userId) VALUES (?,?,?,?)",
            ("identity-2", "supabase", "synthetic-auth-subject-1", "u1"),
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

        # Provider-neutral payment operation supports explicit UNKNOWN status.
        db.execute(
            "INSERT INTO PaymentOperation(id,operationReference,operationType,status,selectedProvider,selectedProduct,amountMinorUnits,currency,requestFingerprint,idempotencyKey,createdById) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            ("pay-1", "PAY-TEST-1", "RETAIL_PAYMENT", "UNKNOWN", "AIRTEL_MONEY", "COLLECTION", 150000, "UGX", "fingerprint-v1", "payment-idem-1", "u1"),
        )
        # Reusing an idempotency key for a second operation is rejected.
        expect_integrity_error(
            db,
            "INSERT INTO PaymentOperation(id,operationReference,operationType,amountMinorUnits,requestFingerprint,idempotencyKey,createdById) VALUES (?,?,?,?,?,?,?)",
            ("pay-2", "PAY-TEST-2", "RETAIL_PAYMENT", 150000, "fingerprint-v1", "payment-idem-1", "u1"),
        )
        # Amount must be positive and currency must remain UGX.
        expect_integrity_error(
            db,
            "INSERT INTO PaymentOperation(id,operationReference,operationType,amountMinorUnits,requestFingerprint,idempotencyKey,createdById) VALUES (?,?,?,?,?,?,?)",
            ("pay-bad-amount", "PAY-TEST-BAD", "RETAIL_PAYMENT", 0, "fingerprint-bad", "payment-idem-bad", "u1"),
        )
        expect_integrity_error(
            db,
            "INSERT INTO PaymentOperation(id,operationReference,operationType,amountMinorUnits,currency,requestFingerprint,idempotencyKey,createdById) VALUES (?,?,?,?,?,?,?,?)",
            ("pay-bad-currency", "PAY-TEST-CURRENCY", "RETAIL_PAYMENT", 100, "USD", "fingerprint-currency", "payment-idem-currency", "u1"),
        )
        # Provider attempt references are unique per provider; UNKNOWN must not be
        # silently converted to FAILED or SUCCEEDED by a local timeout.
        db.execute(
            "INSERT INTO ProviderAttempt(id,operationId,provider,product,attemptNumber,status,providerReference) VALUES (?,?,?,?,?,?,?)",
            ("attempt-1", "pay-1", "AIRTEL_MONEY", "COLLECTION", 1, "UNKNOWN", "AIRTEL-REF-TEST-1"),
        )
        expect_integrity_error(
            db,
            "INSERT INTO ProviderAttempt(id,operationId,provider,product,attemptNumber,status,providerReference) VALUES (?,?,?,?,?,?,?)",
            ("attempt-2", "pay-1", "AIRTEL_MONEY", "COLLECTION", 2, "PENDING", "AIRTEL-REF-TEST-1"),
        )
        # Duplicate provider callback event IDs are rejected for deduplication.
        db.execute(
            "INSERT INTO ProviderEvent(id,provider,providerEventId,operationId,eventType,payloadDigest,signatureVerified) VALUES (?,?,?,?,?,?,?)",
            ("evt-1", "AIRTEL_MONEY", "event-1", "pay-1", "PAYMENT_STATUS", "sha256-synthetic-digest", 1),
        )
        expect_integrity_error(
            db,
            "INSERT INTO ProviderEvent(id,provider,providerEventId,operationId,eventType,payloadDigest,signatureVerified) VALUES (?,?,?,?,?,?,?)",
            ("evt-2", "AIRTEL_MONEY", "event-1", "pay-1", "PAYMENT_STATUS", "sha256-synthetic-digest", 1),
        )
        db.execute(
            "INSERT INTO PaymentOperationEvent(id,operationId,eventType,fromStatus,toStatus,reason,actorId) VALUES (?,?,?,?,?,?,?)",
            ("pay-event-1", "pay-1", "STATUS_CHANGED", "PENDING", "UNKNOWN", "Synthetic timeout; provider status enquiry required", "u1"),
        )

        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
        assert db.execute("SELECT COUNT(*) FROM User").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM AuthIdentity").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM Product").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM AgencyTransaction").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM PaymentOperation").fetchone()[0] == 1
        assert db.execute("SELECT status FROM PaymentOperation WHERE id='pay-1'").fetchone()[0] == "UNKNOWN"
        assert db.execute("SELECT COUNT(*) FROM ProviderAttempt").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM ProviderEvent").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM PaymentOperationEvent").fetchone()[0] == 1
        db.close()
    print("PASS: ordered D1 migrations, auth identity linking, business constraints, provider idempotency, UNKNOWN status, provider-reference and callback deduplication, FK checks, and balanced-ledger fixture")


if __name__ == "__main__":
    main()
