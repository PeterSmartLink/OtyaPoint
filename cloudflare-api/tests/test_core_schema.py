#!/usr/bin/env python3
"""Local SQLite checks for OmniPoint schema, stock, tenant and cash-shift invariants."""
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

    def add_product(self, product_id="p-test", quantity=0, company="omnipoint-default"):
        self.db.execute(
            """INSERT INTO omni_products
               (id, sku, name, category, cost_price, selling_price, quantity_on_hand, company_id)
               VALUES (?, ?, ?, 'Test', 100, 200, ?, ?)""",
            (product_id, "SKU-" + product_id, "Synthetic test product", quantity, company),
        )

    def open_session(self, session_id="shift-test", company="omnipoint-default", branch=None,
                     actor="staff-test", opening_cash=1000):
        self.db.execute(
            """INSERT INTO omni_cash_sessions
               (id, company_id, branch_id, opened_by, opening_cash, status)
               VALUES (?, ?, ?, ?, ?, 'OPEN')""",
            (session_id, company, branch, actor, opening_cash),
        )

    def add_sale(self, sale_id="sale-test", receipt="OP-TEST-001", idem="test-idempotency-001",
                 company="omnipoint-default", session="shift-test", branch=None, total=400):
        self.db.execute(
            """INSERT INTO omni_retail_sales
               (id, receipt_number, subtotal, total, payment_method, idempotency_key, actor_id,
                company_id, cash_session_id, branch_id)
               VALUES (?, ?, ?, ?, 'CASH', ?, 'staff-test', ?, ?, ?)""",
            (sale_id, receipt, total, total, idem, company, session, branch),
        )

    def test_schema_has_domains_and_no_seed_data(self):
        tables = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        self.assertTrue({
            "omni_products", "omni_retail_sales", "omni_retail_sale_lines",
            "omni_stock_movements", "omni_agency_transactions", "omni_ledger_entries",
            "omni_reconciliation_sessions", "omni_audit_events", "omni_staff_memberships",
            "omni_cash_sessions", "omni_cash_movements"
        }.issubset(tables))
        for table in ("omni_products", "omni_retail_sales", "omni_cash_sessions", "omni_cash_movements"):
            self.assertEqual(self.db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0], 0)

    def test_opening_stock_and_adjustment_are_applied_by_audited_movement(self):
        self.add_product()
        self.db.execute(
            """INSERT INTO omni_stock_movements
               (id, product_id, actor_id, movement_type, quantity_delta, quantity_after, reason)
               VALUES ('m-open', 'p-test', 'staff-test', 'OPENING', 5, 5, 'synthetic test')"""
        )
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
        self.open_session()
        self.add_sale()
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
        cash = self.db.execute(
            "SELECT movement_type, amount, source_type, source_id FROM omni_cash_movements WHERE source_id='sale-test'"
        ).fetchone()
        self.assertEqual(cash, ("SALE", 400, "RETAIL_SALE", "sale-test"))

    def test_insufficient_stock_sale_line_is_rejected_without_decrement(self):
        self.add_product(quantity=1)
        self.open_session()
        self.add_sale(sale_id="sale-fail", receipt="OP-TEST-002", idem="test-idempotency-002")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_retail_sale_lines
                   (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total)
                   VALUES ('line-fail', 'sale-fail', 'p-test', 'SKU-p-test', 'Synthetic test product', 2, 200, 100, 400)"""
            )
        self.assertEqual(self.db.execute(
            "SELECT quantity_on_hand FROM omni_products WHERE id='p-test'"
        ).fetchone()[0], 1)

    def test_completed_cash_sale_requires_open_shift(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.add_sale(session=None)
        self.open_session(session_id="closed-shift")
        self.db.execute(
            "UPDATE omni_cash_sessions SET status='CLOSED', closed_at=CURRENT_TIMESTAMP, counted_cash=1000 WHERE id='closed-shift'"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.add_sale(sale_id="sale-closed", receipt="OP-CLOSED", idem="closed-idempotency", session="closed-shift")

    def test_only_one_open_shift_per_cashier_and_branch(self):
        self.open_session()
        with self.assertRaises(sqlite3.IntegrityError):
            self.open_session(session_id="shift-duplicate")
        self.open_session(session_id="shift-other-branch", branch="branch-2")

    def test_sale_cannot_use_product_from_another_company(self):
        self.add_product(product_id="p-company-a", quantity=5, company="company-a")
        self.open_session(session_id="shift-company-b", company="company-b")
        self.add_sale(sale_id="sale-company-b", receipt="OP-COMPANY-B",
                      idem="company-b-idempotency", company="company-b", session="shift-company-b", total=200)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_retail_sale_lines
                   (id,sale_id,product_id,sku_snapshot,name_snapshot,quantity,unit_price,unit_cost,line_total)
                   VALUES ('line-cross-company','sale-company-b','p-company-a','SKU-p-company-a','Company A item',1,200,100,200)"""
            )
        self.assertEqual(self.db.execute(
            "SELECT quantity_on_hand FROM omni_products WHERE id='p-company-a'"
        ).fetchone()[0], 5)

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
        self.open_session()
        self.add_sale(sale_id="sale-one", receipt="OP-TEST-003", idem="unique-key-0001", total=200)
        with self.assertRaises(sqlite3.IntegrityError):
            self.add_sale(sale_id="sale-two", receipt="OP-TEST-004", idem="unique-key-0001", total=200)

    def test_staff_profile_metadata_and_agent_id_uniqueness(self):
        self.db.execute(
            """INSERT INTO omni_staff_memberships
               (id, identity_subject, company_id, role, status, display_name, email, agent_id)
               VALUES ('staff-profile-1', 'otya-user-1', 'company-1', 'MANAGER', 'ACTIVE',
                       'Test Manager', 'manager@example.invalid', 'AGENT001')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO omni_staff_memberships
                   (id, identity_subject, company_id, role, status, agent_id)
                   VALUES ('staff-profile-2', 'otya-user-2', 'company-1', 'ATTENDANT', 'ACTIVE', 'AGENT001')"""
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
