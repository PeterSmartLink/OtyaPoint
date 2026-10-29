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

        # Otya Auth uses the same explicit subject-link table but a distinct provider namespace.
        db.execute(
            "INSERT INTO AuthIdentity(id,provider,authSubject,userId) VALUES (?,?,?,?)",
            ("identity-otya-1", "otya-auth", "otya-user-subject-1", "u1"),
        )
        db.execute(
            "INSERT INTO User(id,email,displayName,role,isActive,identityStatus) VALUES (?,?,?,?,?,?)",
            ("u2", "attendant@example.invalid", "Test Attendant", "ATTENDANT", 1, "VERIFIED"),
        )

        # A verified upstream subject cannot be linked to two staff profiles.
        expect_integrity_error(
            db,
            "INSERT INTO AuthIdentity(id,provider,authSubject,userId) VALUES (?,?,?,?)",
            ("identity-otya-2", "otya-auth", "otya-user-subject-1", "u2"),
        )
        # The same upstream subject string in a different provider namespace remains separate.
        db.execute(
            "INSERT INTO AuthIdentity(id,provider,authSubject,userId) VALUES (?,?,?,?)",
            ("identity-supabase-2", "supabase", "otya-user-subject-1", "u2"),
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

        # Provider capability is disabled by default; production cannot be marked READY.
        db.execute(
            "INSERT INTO ProviderCapability(id,provider,product,environment) VALUES (?,?,?,?)",
            ("cap-1", "AIRTEL_MONEY", "COLLECTION", "SANDBOX"),
        )
        assert db.execute("SELECT operationalState FROM ProviderCapability WHERE id='cap-1'").fetchone()[0] == "DISABLED"
        expect_integrity_error(
            db,
            "INSERT INTO ProviderCapability(id,provider,product,environment,operationalState) VALUES (?,?,?,?,?)",
            ("cap-prod-bad", "AIRTEL_MONEY", "COLLECTION", "PRODUCTION", "READY"),
        )

        # Reconciliation is append-oriented, has explicit differences, and separates maker/checker.
        db.execute(
            "INSERT INTO ReconciliationRun(id,reference,scope,periodStart,periodEnd,createdById) VALUES (?,?,?,?,?,?)",
            ("rec-1", "REC-TEST-1", "PROVIDER_SETTLEMENT", "2026-10-01", "2026-10-02", "u1"),
        )
        expect_integrity_error(
            db,
            "INSERT INTO ReconciliationRun(id,reference,scope,periodStart,periodEnd,createdById,approvedById) VALUES (?,?,?,?,?,?,?)",
            ("rec-bad", "REC-TEST-BAD", "RETAIL", "2026-10-01", "2026-10-02", "u1", "u1"),
        )
        db.execute(
            "INSERT INTO ReconciliationItem(id,runId,sourceType,sourceId,discrepancyType,expectedAmount,observedAmount) VALUES (?,?,?,?,?,?,?)",
            ("rec-item-1", "rec-1", "PROVIDER", "provider-ref-test-1", "AMOUNT_MISMATCH", 10000, 9000),
        )
        expect_integrity_error(
            db,
            "INSERT INTO ReconciliationItem(id,runId,sourceType,sourceId,discrepancyType,expectedAmount,observedAmount) VALUES (?,?,?,?,?,?,?)",
            ("rec-item-2", "rec-1", "PROVIDER", "provider-ref-test-1", "AMOUNT_MISMATCH", 10000, 9000),
        )
        expect_integrity_error(
            db,
            "UPDATE LedgerEntry SET description='rewritten ledger' WHERE id='l1'",
        )
        expect_integrity_error(
            db,
            "DELETE FROM LedgerEntry WHERE id='l1'",
        )


        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
        assert db.execute("SELECT COUNT(*) FROM User").fetchone()[0] == 2
        assert db.execute("SELECT COUNT(*) FROM AuthIdentity").fetchone()[0] == 3
        assert db.execute("SELECT COUNT(*) FROM Product").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM AgencyTransaction").fetchone()[0] == 1
        db.close()
    print("PASS: ordered D1 migrations, Otya/Supabase identity linking, schema constraints, FK checks, idempotency uniqueness, and synthetic balanced-ledger fixture")


if __name__ == "__main__":
    main()
