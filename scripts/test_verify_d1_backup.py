#!/usr/bin/env python3
"""Exercise the D1 export restore verifier using a synthetic local SQL dump."""
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "cloudflare-api" / "migrations").glob("*.sql"))
VERIFIER = ROOT / "scripts" / "verify-d1-backup.py"


class D1BackupVerifierTests(unittest.TestCase):
    def test_schema_export_restores_and_passes_integrity_checks(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source_path = tmp_path / "source.sqlite"
            export_path = tmp_path / "export.sql"
            restore_path = tmp_path / "restored.sqlite"

            source = sqlite3.connect(source_path)
            source.execute("PRAGMA foreign_keys = ON")
            for migration in MIGRATIONS:
                source.executescript(migration.read_text(encoding="utf-8"))
            source.execute("CREATE TABLE d1_migrations (name TEXT PRIMARY KEY, applied_at TEXT)")
            for migration in MIGRATIONS:
                source.execute(
                    "INSERT INTO d1_migrations (name, applied_at) VALUES (?, CURRENT_TIMESTAMP)",
                    (migration.name,),
                )
            source.commit()
            export_path.write_text("\n".join(source.iterdump()), encoding="utf-8")
            source.close()

            result = subprocess.run(
                [sys.executable, str(VERIFIER), str(export_path), str(restore_path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("D1 export restore: PASS", result.stdout)
            self.assertIn("Unbalanced ledger sources: 0", result.stdout)
            self.assertTrue(restore_path.exists())

    def test_empty_export_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            export_path = tmp_path / "empty.sql"
            restore_path = tmp_path / "restored.sqlite"
            export_path.write_text("", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(VERIFIER), str(export_path), str(restore_path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("D1 export is empty", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
