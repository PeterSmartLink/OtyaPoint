"""Validate ordered Cloudflare D1 migration filenames without applying them."""
from pathlib import Path
import re
import sys

MIGRATIONS_DIR = Path(__file__).resolve().parent
PATTERN = re.compile(r"^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$")


def main() -> int:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        print("ERROR: no D1 SQL migrations found", file=sys.stderr)
        return 1

    versions: list[int] = []
    for path in files:
        match = PATTERN.fullmatch(path.name)
        if not match:
            print(f"ERROR: invalid D1 migration filename: {path.name}", file=sys.stderr)
            return 1
        versions.append(int(match.group(1)))

    if len(versions) != len(set(versions)):
        print("ERROR: duplicate D1 migration version detected", file=sys.stderr)
        return 1

    expected = list(range(1, len(versions) + 1))
    if versions != expected:
        print(
            f"ERROR: D1 migration versions must be contiguous from 0001; "
            f"found {versions}, expected {expected}",
            file=sys.stderr,
        )
        return 1

    print(f"Validated {len(files)} ordered Cloudflare D1 migrations.")
    for path in files:
        print(f"  {path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
