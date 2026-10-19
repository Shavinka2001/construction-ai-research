"""
Add the `users.status` and `users.last_login_at` columns to an existing database.

STOPGAP. `init_db()` calls `Base.metadata.create_all`, which creates missing
tables but never alters existing ones, so a model that gains a column leaves
every already-created database behind — the app then fails on the first query
that selects it. There is no migration tool in the project yet, so this script
applies the one change by hand.

The project needs Alembic before the next schema change. The membership and
invitation tables cannot be delivered this way: each hand-written script is
another thing to remember to run, in the right order, on every environment.

Idempotent: running it twice is a no-op. Safe on SQLite and PostgreSQL.

    python scripts/add_user_status_columns.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `python scripts/add_user_status_columns.py` from the backend root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text  # noqa: E402

from app.db.database import engine  # noqa: E402
from app.models.user_status import UserStatus  # noqa: E402

COLUMNS = {
    "status": (
        f"VARCHAR(20) NOT NULL DEFAULT '{UserStatus.ACTIVE.value}'",
        "account lifecycle state",
    ),
    "last_login_at": ("TIMESTAMP NULL", "last successful sign-in"),
}


def main() -> int:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        print("No `users` table yet — start the app once to create the schema.")
        return 0

    existing = {col["name"] for col in inspector.get_columns("users")}
    added: list[str] = []

    with engine.begin() as conn:
        for name, (ddl, description) in COLUMNS.items():
            if name in existing:
                print(f"  already present: users.{name}")
                continue
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl}"))
            added.append(name)
            print(f"  added: users.{name}  ({description})")

    if added:
        print(f"\nDone — {len(added)} column(s) added.")
    else:
        print("\nNothing to do — schema already current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
