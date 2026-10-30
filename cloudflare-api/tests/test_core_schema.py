#!/usr/bin/env python3
"""Local SQLite checks for OmniPoint's isolated D1 schema and stock invariants."""
from pathlib import Path
import sqlite3
import unittest

MIGRATIONS = sorted((Path(__file__).resolve().parents[1] / "migrations").glob("*.sql"))


class OmniPointCoreSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        for migration in MIGRATIONS:
            self.db.executescript("BEGIN;\n" + migration.read_text(encoding="utf-8") + "\nCOMMIT;")

    def tearDown(self):
        self.db.close()

    def add_product(self, product_id="p-test", quantity=0):
        self.db.execute(
            """INSERT INTO omni_products
               (id, sku, name, category, cost_price, selling_price, quantity_on_hand)
               VALUES (?, ?, ?, 'Test', 100, 200, ?)""",
            (product_id, "SKU-" + product_id, "Synthetic test product", quantity),
        )

    def test_schema_has_separate_domains_and_no_seed_data(self):
        tables = {
            row[0] for row in self.db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        self.assertTrue({
            "omni_products", "omni_retail_sales", "omni_retail_sale_lines",
            "omni_stock_movements", "omni_agency_transactions",
            "omni_ledger_entries", "omni_reconciliation_sessions",
            "omni_audit_events", "omni_staff_memberships"
        }.issubset(tables))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM omni_products").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM omni_retail_sales").fetchone()[0], 0)

    def test_opening_stock_and_adjustment_are_applied_by_audited_movement(self):
        self.add_product()
        self.db.execute(
            """INSERT INTO omni_stock_movements
               (id, product_id, actor_id, movement_type, quantity_delta, quantity_after, reason)
               VALUES ('m-open', 'p-test', 'staff-test', 'OPENING', 5, 5, 'synthetic test')"""
        )
        self.assertEqual(self.db.execute(
            "SELECT quantity_on_hand FROM omni_products WHERE id='p-test'"
        ).fetchone()[0], 5)
        self.db.execute(
            """INSERT INTO omni_stock_movements
               (id, product_id, actor_id, movement_type, quantity_delta, quantity_after, reason)
               VALUES ('m-adjust', 'p-test', 'staff-test', 'ADJUSTMENT', -2, 3, 'synthetic test')"""
        )
        self.assertEqual(self.db.execute(
            "SELECT quantity_on_hand FROM omni_products WHERE id='p-test'"
        ).fetchone()[0], 3)

    def test_sale_line_decrements_stock_and_records_sale_movement(self):
        self.add_product(quantity=5)
        self.db.execute(
            """INSERT INTO omni_retail_sales
               (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id)
               VALUES ('sale-test', 'OP-TEST-001', 400, 400, 'CASH', 'test-idempotency-001', 'staff-test')"""
        )
        self.db.execute(
            """INSERT INTO omni_retail_sale_lines
               (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
               VALUES ('line-test', 'sale-test', 'p-test', 'SKU-p-test', 'Synthetic test product', 2, 200, 100, 400)"""
        )
        self.assertEqual(self.db.execute(
            "SELECT quantity_on_hand FROM omni_products WHERE id='p-test'"
        ).fetchone()[0], 3)
        movement = self.db.execute(
            "SELECT movement_type, quantity_delta, quantity_after FROM omni_stock_movements WHERE reference_id='sale-test'"
        ).fetchone()
        self.assertEqual(movement, ("SALE", -2, 3))

    def test_insufficient_stock_sale_line_is_rejected_without_decrement(self):
        self.add_product(quantity=1)
        self.db.execute(
            """INSERT INTO omni_retail_sales
               (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id)
               VALUES ('sale-fail', 'OP-TEST-002', 400, 400, 'CASH', 'test-idempotency-002', 'staff-test')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_retail_sale_lines
                   (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
                   VALUES ('line-fail', 'sale-fail', 'p-test', 'SKU-p-test', 'Synthetic test product', 2, 200, 100, 400)"""
            )
        self.assertEqual(self.db.execute(
            "SELECT quantity_on_hand FROM omni_products WHERE id='p-test'"
        ).fetchone()[0], 1)
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM omni_retail_sale_lines WHERE sale_id='sale-fail'"
        ).fetchone()[0], 0)

    def test_sale_cannot_use_product_from_another_company(self):
        self.db.execute(
            """INSERT INTO omni_products
               (id, sku, name, category, cost_price, selling_price, quantity_on_hand, company_id)
               VALUES ('p-company-a', 'SKU-COMPANY-A', 'Company A item', 'Test', 100, 200, 5, 'company-a')"""
        )
        self.db.execute(
            """INSERT INTO omni_retail_sales
               (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id, company_id)
               VALUES ('sale-company-b', 'OP-COMPANY-B', 200, 200, 'CASH', 'company-b-idempotency', 'staff-b', 'company-b')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_retail_sale_lines
                   (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
                   VALUES ('line-cross-company', 'sale-company-b', 'p-company-a', 'SKU-COMPANY-A', 'Company A item', 1, 200, 100, 200)"""
            )
        self.assertEqual(self.db.execute(
            "SELECT quantity_on_hand FROM omni_products WHERE id='p-company-a'"
        ).fetchone()[0], 5)
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM omni_retail_sale_lines WHERE sale_id='sale-company-b'"
        ).fetchone()[0], 0)

    def test_staff_profile_metadata_and_agent_id_uniqueness(self):
        self.db.execute(
            """INSERT INTO omni_staff_memberships
               (id, identity_subject, company_id, role, status, display_name, email, agent_id)
               VALUES ('staff-profile-1', 'otya-user-1', 'company-1', 'MANAGER', 'ACTIVE',
                       'Test Manager', 'manager@example.invalid', 'AGENT001')"""
        )
        row = self.db.execute(
            """SELECT display_name, email, agent_id
               FROM omni_staff_memberships WHERE id='staff-profile-1'"""
        ).fetchone()
        self.assertEqual(row, ("Test Manager", "manager@example.invalid", "AGENT001"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_staff_memberships
                   (id, identity_subject, company_id, role, status, agent_id)
                   VALUES ('staff-profile-2', 'otya-user-2', 'company-1', 'ATTENDANT', 'ACTIVE', 'AGENT001')"""
            )

    def test_sale_request_fingerprint_is_available_and_legacy_rows_are_unverified(self):
        columns = {
            row[1] for row in self.db.execute("PRAGMA table_info(omni_retail_sales)")
        }
        self.assertIn("request_fingerprint", columns)
        self.add_product()
        self.db.execute(
            """INSERT INTO omni_retail_sales
               (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id)
               VALUES ('sale-legacy', 'OP-LEGACY-001', 200, 200, 'CASH', 'legacy-key-0001', 'staff-test')"""
        )
        fingerprint = self.db.execute(
            "SELECT request_fingerprint FROM omni_retail_sales WHERE id='sale-legacy'"
        ).fetchone()[0]
        self.assertIsNone(fingerprint, "legacy sales must not be treated as verified payload matches")

    def test_staff_role_and_idempotency_constraints(self):
        self.db.execute(
            """INSERT INTO omni_staff_memberships
               (id, identity_subject, company_id, role, status)
               VALUES ('staff-1', 'subject-1', 'company-1', 'MANAGER', 'ACTIVE')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_staff_memberships
                   (id, identity_subject, company_id, role, status)
                   VALUES ('staff-2', 'subject-1', 'company-1', 'ATTENDANT', 'ACTIVE')"""
            )
        self.add_product()
        self.db.execute(
            """INSERT INTO omni_retail_sales
               (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id)
               VALUES ('sale-one', 'OP-TEST-003', 200, 200, 'CASH', 'unique-key-0001', 'staff-1')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_retail_sales
                   (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id)
                   VALUES ('sale-two', 'OP-TEST-004', 200, 200, 'CASH', 'unique-key-0001', 'staff-1')"""
            )


    def test_company_scoped_idempotency_migration_preserves_sales_lines_and_triggers(self):
        migration_files = sorted(
            (Path(__file__).resolve().parents[1] / "migrations").glob("*.sql")
        )
        migration = next(p for p in migration_files if p.name == "0005_company_scoped_sale_idempotency.sql")
        db = sqlite3.connect(":memory:")
        db.execute("PRAGMA foreign_keys = ON")
        try:
            for path in migration_files:
                if path.name == migration.name:
                    break
                db.executescript(path.read_text(encoding="utf-8"))

            db.execute(
                """INSERT INTO omni_products
                   (id, sku, name, category, cost_price, selling_price, quantity_on_hand, company_id)
                   VALUES ('p-company-1', 'SKU-C1', 'Company 1 product', 'Test', 100, 200, 4, 'company-1')"""
            )
            db.execute(
                """INSERT INTO omni_retail_sales
                   (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id, company_id, request_fingerprint)
                   VALUES ('sale-existing', 'OP-MIG-001', 200, 200, 'CASH', 'shared-key', 'staff-1', 'company-1', 'fingerprint-v1')"""
            )
            db.execute(
                """INSERT INTO omni_retail_sale_lines
                   (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
                   VALUES ('line-existing', 'sale-existing', 'p-company-1', 'SKU-C1', 'Company 1 product', 1, 200, 100, 200)"""
            )
            self.assertEqual(
                db.execute("SELECT quantity_on_hand FROM omni_products WHERE id='p-company-1'").fetchone()[0],
                3,
            )
            before_movements = db.execute(
                "SELECT COUNT(*) FROM omni_stock_movements WHERE reference_id='sale-existing'"
            ).fetchone()[0]
            self.assertEqual(before_movements, 1)

            db.executescript("BEGIN;\n" + migration.read_text(encoding="utf-8") + "\nCOMMIT;")

            self.assertEqual(
                db.execute("SELECT id, company_id, request_fingerprint FROM omni_retail_sales WHERE id='sale-existing'").fetchone(),
                ("sale-existing", "company-1", "fingerprint-v1"),
            )
            self.assertEqual(
                db.execute("SELECT id, sale_id, product_id, quantity FROM omni_retail_sale_lines WHERE id='line-existing'").fetchone(),
                ("line-existing", "sale-existing", "p-company-1", 1),
            )
            self.assertEqual(
                db.execute("SELECT quantity_on_hand FROM omni_products WHERE id='p-company-1'").fetchone()[0],
                3,
                "migration must not reapply stock deductions",
            )
            self.assertEqual(
                db.execute("SELECT COUNT(*) FROM omni_stock_movements WHERE reference_id='sale-existing'").fetchone()[0],
                before_movements,
                "migration must not duplicate stock movements",
            )
            self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")

            db.execute(
                """INSERT INTO omni_retail_sales
                   (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id, company_id)
                   VALUES ('sale-company-2', 'OP-MIG-002', 200, 200, 'CASH', 'shared-key', 'staff-2', 'company-2')"""
            )
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    """INSERT INTO omni_retail_sales
                       (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id, company_id)
                       VALUES ('sale-company-1-duplicate', 'OP-MIG-003', 200, 200, 'CASH', 'shared-key', 'staff-1', 'company-1')"""
                )

            trigger_names = {
                row[0] for row in db.execute(
                    "SELECT name FROM sqlite_master WHERE type='trigger'"
                )
            }
            self.assertIn("omni_sale_line_stock_guard", trigger_names)
            self.assertIn("omni_sale_line_stock_post", trigger_names)
            self.assertIn("omni_stock_movement_guard", trigger_names)
            self.assertIn("omni_stock_movement_apply", trigger_names)

            index_rows = db.execute("PRAGMA index_list('omni_retail_sales')").fetchall()
            index_names = {row[1] for row in index_rows}
            self.assertIn("idx_omni_sales_company_idempotency", index_names)
            unique_key_column_sets = []
            for index_row in index_rows:
                if index_row[2]:
                    columns = [
                        info[2] for info in db.execute(
                            "PRAGMA index_info('" + index_row[1].replace("'", "''") + "')"
                        ).fetchall()
                    ]
                    if "idempotency_key" in columns:
                        unique_key_column_sets.append(columns)
            self.assertEqual(
                unique_key_column_sets,
                [["company_id", "idempotency_key"]],
                "idempotency uniqueness must be company-scoped, not global",
            )
        finally:
            db.close()


    def test_sale_batch_rolls_back_sale_stock_ledger_and_audit_on_late_line_failure(self):
        """SQLite integration model for D1 batch atomicity; not a live D1 test."""
        self.db.execute(
            """INSERT INTO omni_products
               (id, sku, name, category, cost_price, selling_price, quantity_on_hand, company_id)
               VALUES ('p-atomic', 'SKU-ATOMIC', 'Atomic test product', 'Test', 100, 200, 2, 'company-atomic')"""
        )
        self.db.execute("SAVEPOINT sale_batch")
        self.db.execute(
            """INSERT INTO omni_retail_sales
               (id, receipt_number, subtotal, total, payment_method, idempotency_key,
                actor_id, company_id, request_fingerprint)
               VALUES ('sale-atomic', 'OP-ATOMIC-001', 600, 600, 'CASH',
                       'atomic-key-0001', 'staff-atomic', 'company-atomic', 'fingerprint-atomic-v1')"""
        )
        try:
            # First line succeeds and fires the stock trigger.
            self.db.execute(
                """INSERT INTO omni_retail_sale_lines
                   (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
                   VALUES ('line-atomic-1', 'sale-atomic', 'p-atomic', 'SKU-ATOMIC',
                           'Atomic test product', 1, 200, 100, 200)"""
            )
            # Add the same financial/audit records the route batches after sale lines.
            self.db.execute(
                """INSERT INTO omni_ledger_entries
                   (id, ledger_type, account_code, currency, debit, credit, source_type,
                    source_id, idempotency_key, description, company_id)
                   VALUES ('ledger-atomic', 'RETAIL', 'CASH_ON_HAND', 'UGX', 200, 0,
                           'RETAIL_SALE', 'sale-atomic', 'atomic-ledger-key',
                           'Synthetic atomicity test', 'company-atomic')"""
            )
            self.db.execute(
                """INSERT INTO omni_audit_events
                   (id, actor_id, action, entity_type, entity_id, reason, after_state, request_id, company_id)
                   VALUES ('audit-atomic', 'staff-atomic', 'POST_SALE', 'RETAIL_SALE',
                           'sale-atomic', 'Synthetic atomicity test', '{}', 'request-atomic',
                           'company-atomic')"""
            )
            # This line must fail because the first line already consumed one of two units.
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(
                    """INSERT INTO omni_retail_sale_lines
                       (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
                       VALUES ('line-atomic-2', 'sale-atomic', 'p-atomic', 'SKU-ATOMIC',
                               'Atomic test product', 2, 200, 100, 400)"""
                )
            self.db.execute("ROLLBACK TO sale_batch")
            self.db.execute("RELEASE sale_batch")
        except Exception:
            self.db.execute("ROLLBACK TO sale_batch")
            self.db.execute("RELEASE sale_batch")
            raise

        self.assertEqual(
            self.db.execute("SELECT quantity_on_hand FROM omni_products WHERE id='p-atomic'").fetchone()[0],
            2,
            "failed sale batch must restore inventory to its original quantity",
        )
        for table in ("omni_retail_sales", "omni_retail_sale_lines", "omni_stock_movements",
                      "omni_ledger_entries", "omni_audit_events"):
            self.assertEqual(
                self.db.execute(f"SELECT COUNT(*) FROM {table} WHERE " +
                                ("id='sale-atomic'" if table == "omni_retail_sales" else
                                 "sale_id='sale-atomic'" if table == "omni_retail_sale_lines" else
                                 "reference_id='sale-atomic'" if table == "omni_stock_movements" else
                                 "source_id='sale-atomic'" if table == "omni_ledger_entries" else
                                 "entity_id='sale-atomic'")).fetchone()[0],
                0,
                f"failed sale batch must leave no {table} records",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
