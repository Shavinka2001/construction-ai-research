"""
Validate ``backend/data/uda_requirements.csv`` before it is used anywhere.

The dataset's whole value is that every requirement traces to something a panel
member can open. This script enforces that mechanically, so an untraceable row
cannot quietly reach the rule engine.

Run: python backend/research/component3/03_validate_requirements.py
"""

from __future__ import annotations

import csv
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "data" / "uda_requirements.csv"

COLUMNS = [
    "requirement_id",
    "application_type",
    "document_name",
    "requirement_type",
    "condition",
    "condition_key",
    "authority",
    "source_url",
    "source_section",
    "verified_date",
]

APPLICATION_TYPES = {"building_permit", "coc"}
REQUIREMENT_TYPES = {"mandatory", "conditional"}
MAX_AGE_DAYS = 365


def validate(rows: list[dict], header: list[str]) -> list[str]:
    errors: list[str] = []

    if header != COLUMNS:
        errors.append(f"header mismatch\n  expected: {COLUMNS}\n  found:    {header}")
        return errors

    if not rows:
        errors.append("no rows - the dataset is still empty")
        return errors

    seen_ids: set[str] = set()
    today = date.today()

    for i, row in enumerate(rows, start=2):  # line 1 is the header
        rid = (row.get("requirement_id") or "").strip()
        where = f"line {i} ({rid or 'no id'})"

        if not rid:
            errors.append(f"{where}: requirement_id is empty")
        elif rid in seen_ids:
            errors.append(f"{where}: duplicate requirement_id")
        else:
            seen_ids.add(rid)

        app = (row.get("application_type") or "").strip().lower()
        if app not in APPLICATION_TYPES:
            errors.append(f"{where}: application_type {app!r} not in {sorted(APPLICATION_TYPES)}")

        if not (row.get("document_name") or "").strip():
            errors.append(f"{where}: document_name is empty")

        req_type = (row.get("requirement_type") or "").strip().lower()
        if req_type not in REQUIREMENT_TYPES:
            errors.append(f"{where}: requirement_type {req_type!r} not in {sorted(REQUIREMENT_TYPES)}")
        elif req_type == "conditional":
            if not (row.get("condition") or "").strip():
                errors.append(f"{where}: conditional requirement with no condition text")
            # Without a machine-evaluable key the rule engine cannot decide
            # whether the requirement applies, so every such case would fall
            # through to manual review and the rule engine would do half a job.
            key = (row.get("condition_key") or "").strip()
            if not key:
                errors.append(f"{where}: conditional requirement with no condition_key")
            elif key != key.lower() or " " in key:
                errors.append(f"{where}: condition_key {key!r} must be lower_snake_case")
        elif req_type == "mandatory" and (row.get("condition_key") or "").strip():
            errors.append(f"{where}: mandatory requirement must not carry a condition_key")

        if not (row.get("authority") or "").strip():
            errors.append(f"{where}: authority is empty")

        # Traceability: at least one of url / section, and a fresh check date.
        url = (row.get("source_url") or "").strip()
        section = (row.get("source_section") or "").strip()
        if not url and not section:
            errors.append(f"{where}: no source_url and no source_section - untraceable")

        raw_date = (row.get("verified_date") or "").strip()
        if not raw_date:
            errors.append(f"{where}: verified_date is empty")
        else:
            try:
                checked = datetime.strptime(raw_date, "%Y-%m-%d").date()
            except ValueError:
                errors.append(f"{where}: verified_date {raw_date!r} is not YYYY-MM-DD")
            else:
                if checked > today:
                    errors.append(f"{where}: verified_date is in the future")
                elif (today - checked).days > MAX_AGE_DAYS:
                    errors.append(
                        f"{where}: verified_date is {(today - checked).days} days old "
                        f"(limit {MAX_AGE_DAYS}) - re-check the source"
                    )

    return errors


def main() -> int:
    if not CSV_PATH.is_file():
        print(f"missing: {CSV_PATH}")
        return 1

    with CSV_PATH.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        header = list(reader.fieldnames or [])
        rows = [r for r in reader if any((v or "").strip() for v in r.values())]

    errors = validate(rows, header)

    if errors:
        print(f"FAILED - {len(errors)} problem(s) in {CSV_PATH.name}\n")
        for e in errors:
            print(f"  - {e}")
        return 1

    by_type: dict[str, int] = {}
    conditional = 0
    for r in rows:
        by_type[r["application_type"]] = by_type.get(r["application_type"], 0) + 1
        if r["requirement_type"].strip().lower() == "conditional":
            conditional += 1

    print(f"OK - {len(rows)} requirements, all traceable")
    for app, n in sorted(by_type.items()):
        print(f"  {app:<18} {n}")
    print(f"  conditional        {conditional}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
