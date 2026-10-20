"""
Add the approval-attribute columns to an existing `projects` table.

STOPGAP, in the same shape as `add_user_status_columns.py` and for the same
reason: `init_db()` calls `Base.metadata.create_all`, which creates missing
tables but never alters existing ones, so a model that gains a column leaves
every already-created database behind.

This is the second hand-written migration in the project. The next schema
change should be the one that introduces Alembic instead of adding a third.

Every column is nullable with no default. That is deliberate rather than
lazy: NULL means "nobody has said", and the readiness rule engine reports the
requirements that depend on an unset attribute as manual review. Backfilling a
default would convert "we don't know" into a confident answer for every
project that already exists.

Idempotent: running it twice is a no-op. Safe on SQLite and PostgreSQL.

    python scripts/add_project_approval_columns.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `python scripts/add_project_approval_columns.py` from the backend root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text  # noqa: E402

from app.db.database import engine  # noqa: E402

COLUMNS = {
    "application_type": ("VARCHAR(32) NULL", "building_permit | coc"),
    "building_use": (
        "VARCHAR(32) NULL",
        "residential | non_residential | apartment — gates the clearance group",
    ),
    "tenure_type": ("VARCHAR(32) NULL", "freehold | condominium"),
    "applicant_type": ("VARCHAR(32) NULL", "individual | organization"),
    "development_activity": (
        "VARCHAR(32) NULL",
        "building_construction | land_subdivision",
    ),
    "has_ppc": ("BOOLEAN NULL", "Preliminary Planning Clearance already obtained"),
}


def main() -> int:
    inspector = inspect(engine)
    if "projects" not in inspector.get_table_names():
        print("No `projects` table yet — start the app once to create the schema.")
        return 0

    existing = {col["name"] for col in inspector.get_columns("projects")}
    pending = {name: spec for name, spec in COLUMNS.items() if name not in existing}

    if not pending:
        print("All approval columns already present — nothing to do.")
        return 0

    with engine.begin() as connection:
        for name, (ddl, purpose) in pending.items():
            connection.execute(text(f"ALTER TABLE projects ADD COLUMN {name} {ddl}"))
            print(f"added projects.{name:<22} ({purpose})")

    print(f"\n{len(pending)} column(s) added.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
