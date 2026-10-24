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
            self.db.executescript(migration.read_text(encoding="utf-8"))

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


    def test_worker_required_columns_exist_in_clean_migration_chain(self):
        required = {
            "omni_products": {"id", "sku", "name", "company_id"},
            "omni_retail_sales": {"id", "receipt_number", "idempotency_key", "company_id"},
            "omni_retail_sale_lines": {"id", "sale_id", "product_id"},
            "omni_stock_movements": {"id", "product_id", "actor_id", "company_id"},
            "omni_agency_transactions": {"id", "reference", "idempotency_key", "company_id"},
            "omni_ledger_entries": {"id", "ledger_type", "debit", "credit", "company_id"},
            "omni_reconciliation_sessions": {"id", "ledger_type", "business_date", "company_id"},
            "omni_audit_events": {"id", "actor_id", "action", "company_id"},
            "omni_staff_memberships": {
                "id", "identity_subject", "company_id", "branch_id", "role", "status",
                "display_name", "email", "agent_id"
            },
        }
        for table, expected_columns in required.items():
            with self.subTest(table=table):
                actual = {
                    row[1] for row in self.db.execute(f"PRAGMA table_info({table})")
                }
                self.assertTrue(expected_columns.issubset(actual),
                                f"{table} missing: {sorted(expected_columns - actual)}")

    def test_company_scope_indexes_exist_for_operational_tables(self):
        indexes = {
            row[0] for row in self.db.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            )
        }
        expected = {
            "idx_omni_products_company_active",
            "idx_omni_sales_company_created",
            "idx_omni_stock_company_product",
            "idx_omni_agency_company_status",
            "idx_omni_ledger_company_type_date",
            "idx_omni_reconciliation_company_date",
            "idx_omni_audit_company_created",
        }
        self.assertTrue(expected.issubset(indexes), f"Missing indexes: {sorted(expected - indexes)}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
