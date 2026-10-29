#!/usr/bin/env python3
"""Restore a Wrangler D1 SQL export into local SQLite and verify structural integrity.

This script never connects to Cloudflare and never changes a remote database.
It prints schema/count/checksum metadata only, not row contents.
"""
from __future__ import annotations

import argparse
import hashlib
import sqlite3
from pathlib import Path

REQUIRED_TABLES = {
    "omni_products",
    "omni_retail_sales",
    "omni_retail_sale_lines",
    "omni_stock_movements",
    "omni_agency_transactions",
    "omni_ledger_entries",
    "omni_reconciliation_sessions",
    "omni_audit_events",
    "omni_staff_memberships",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("sql_export", type=Path)
    parser.add_argument("restore_db", type=Path)
    args = parser.parse_args()

    sql_bytes = args.sql_export.read_bytes()
    if not sql_bytes.strip():
        raise SystemExit("FAIL: D1 export is empty")

    args.restore_db.unlink(missing_ok=True)
    db = sqlite3.connect(args.restore_db)
    try:
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript(sql_bytes.decode("utf-8"))
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise SystemExit(f"FAIL: SQLite integrity_check returned {integrity!r}")

        tables = {
            row[0]
            for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        missing = sorted(REQUIRED_TABLES - tables)
        if missing:
            raise SystemExit(f"FAIL: restored D1 export is missing required tables: {', '.join(missing)}")

        fk_errors = db.execute("PRAGMA foreign_key_check").fetchall()
        if fk_errors:
            raise SystemExit(f"FAIL: restored export has {len(fk_errors)} foreign-key violations")

        columns = {
            row[1] for row in db.execute("PRAGMA table_info(omni_retail_sales)")
        }
        if "d1_migrations" in tables:
            applied = {
                row[0] for row in db.execute("SELECT name FROM d1_migrations")
            }
            required_migrations = {
                "0001_core.sql", "0002_company_scope.sql", "0003_staff_profile.sql"
            }
            missing_migrations = sorted(required_migrations - applied)
            if missing_migrations:
                raise SystemExit(
                    "FAIL: restored migration history is missing baseline entries: "
                    + ", ".join(missing_migrations)
                )
            if "0004_sale_request_fingerprint.sql" in applied and "request_fingerprint" not in columns:
                raise SystemExit("FAIL: migration history says sale fingerprint is applied but column is absent")

        row_counts = {}
        for table in sorted(REQUIRED_TABLES):
            row_counts[table] = db.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]

        negative_stock = db.execute(
            "SELECT COUNT(*) FROM omni_products WHERE quantity_on_hand < 0"
        ).fetchone()[0]
        orphan_sale_lines = db.execute(
            """SELECT COUNT(*) FROM omni_retail_sale_lines l
               LEFT JOIN omni_retail_sales s ON s.id = l.sale_id
               WHERE s.id IS NULL"""
        ).fetchone()[0]
        if negative_stock:
            raise SystemExit(f"FAIL: restored export contains {negative_stock} negative-stock rows")
        if orphan_sale_lines:
            raise SystemExit(f"FAIL: restored export contains {orphan_sale_lines} orphan sale-line rows")

        checksum = hashlib.sha256(sql_bytes).hexdigest()
        print("D1 export restore: PASS")
        print(f"SHA-256: {checksum}")
        print(f"Restored tables checked: {len(REQUIRED_TABLES)}")
        print(f"Foreign-key violations: {len(fk_errors)}")
        print(f"Negative-stock rows: {negative_stock}")
        print(f"Orphan sale lines: {orphan_sale_lines}")
        for table, count in row_counts.items():
            print(f"Row count {table}: {count}")
        print("No row contents were printed or uploaded.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
