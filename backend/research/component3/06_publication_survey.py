"""
How many Sri Lankan local authorities publish their building permit checklist?

This is the second measurement, and unlike the coverage figure it is about the
world rather than about our own data. It exists because of what the coverage
work could not settle.

Every condition in the UDA requirements list resolves given the right inputs.
What no amount of engineering establishes is whether that list is **complete**
for a particular site. UDA administers approvals directly in declared urban
development areas, so for those the list is the list. Outside that arrangement
an authority may add requirements of its own, and an applicant can only find
out what those are if the authority publishes them.

So the question worth measuring: of the authorities an applicant might deal
with, how many publish the checklist at all? Where the answer is no, a
pre-submission checker cannot be built for that jurisdiction by anyone, which
is a finding about the provision of regulatory information rather than about
this system.

### Protocol

Reproducible, and deliberately conservative about what counts as published.

1. The sample is fixed in `publication_survey.csv` before searching, so the
   result cannot be shaped by which authorities turned out to be convenient.
2. For each authority: search its official domain and the open web for a
   building permit or development permit document checklist.
3. `published` is **yes** only when a page or downloadable document lists the
   documents required. A page that merely names the service, gives an office
   address, or describes fees is **no**.
4. Record the URL that satisfied it, and the date checked.
5. `not_found` is recorded as "no evidence of publication", never as proof of
   absence. A checklist may exist in a place a search does not reach.

Run: python backend/research/component3/06_publication_survey.py
Reads: publication_survey.csv
Writes: publication_survey.json
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
SURVEY = HERE / "publication_survey.csv"

COLUMNS = [
    "authority",
    "type",
    "province",
    "published",
    "evidence_url",
    "notes",
    "checked_date",
]

VALID_TYPES = {"MC", "UC", "PS"}
VALID_PUBLISHED = {"yes", "no"}


def load() -> list[dict[str, str]]:
    if not SURVEY.is_file():
        raise SystemExit(f"missing sample file: {SURVEY}")
    with SURVEY.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if list(reader.fieldnames or []) != COLUMNS:
            raise SystemExit(
                f"header mismatch\n  expected: {COLUMNS}\n  found:    {reader.fieldnames}"
            )
        return [r for r in reader if (r.get("authority") or "").strip()]


def validate(rows: list[dict[str, str]]) -> list[str]:
    errors: list[str] = []
    today = datetime.now().date()
    for i, row in enumerate(rows, start=2):
        where = f"line {i} ({row['authority']})"

        if row["type"] not in VALID_TYPES:
            errors.append(f"{where}: type {row['type']!r} not in {sorted(VALID_TYPES)}")

        published = row["published"].strip().lower()
        if published not in VALID_PUBLISHED:
            errors.append(f"{where}: published {published!r} must be yes or no")
        elif published == "yes" and not row["evidence_url"].strip():
            errors.append(f"{where}: published=yes with no evidence_url")
        elif published == "no" and row["evidence_url"].strip():
            errors.append(
                f"{where}: published=no but an evidence_url is recorded — "
                "either it satisfies the criterion or it does not"
            )

        raw = row["checked_date"].strip()
        if not raw:
            errors.append(f"{where}: checked_date is empty")
        else:
            try:
                checked = datetime.strptime(raw, "%Y-%m-%d").date()
            except ValueError:
                errors.append(f"{where}: checked_date {raw!r} is not YYYY-MM-DD")
            else:
                if checked > today:
                    errors.append(f"{where}: checked_date is in the future")
    return errors


def main() -> int:
    rows = load()
    errors = validate(rows)
    if errors:
        print(f"FAILED - {len(errors)} problem(s) in {SURVEY.name}\n")
        for e in errors:
            print(f"  - {e}")
        return 1

    total = len(rows)
    published = [r for r in rows if r["published"].strip().lower() == "yes"]
    by_type: Counter[str] = Counter(r["type"] for r in rows)
    published_by_type: Counter[str] = Counter(r["type"] for r in published)

    result = {
        "protocol": (
            "Sample fixed before searching. 'published' means a page or "
            "document listing the required documents was found on the open "
            "web; a service name, address or fee schedule does not count. "
            "'no' records no evidence of publication, not proof of absence."
        ),
        "sample_size": total,
        "published_count": len(published),
        "published_share": round(len(published) / total, 3) if total else 0.0,
        "by_type": {
            t: {
                "sampled": by_type[t],
                "published": published_by_type[t],
                "share": round(published_by_type[t] / by_type[t], 3),
            }
            for t in sorted(by_type)
        },
        "published_authorities": [
            {"authority": r["authority"], "url": r["evidence_url"]} for r in published
        ],
        "reading": (
            "Where an authority does not publish its checklist, an applicant "
            "cannot determine what their application needs before submitting "
            "it, and no automated pre-submission checker can be built for that "
            "jurisdiction by anyone. That is a gap in the provision of "
            "regulatory information, not in any one system."
        ),
    }

    (HERE / "publication_survey.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )

    print(f"sampled {total} authorities")
    print(
        f"publish a checklist: {len(published)}/{total} "
        f"({result['published_share']:.0%})"
    )
    for t, data in result["by_type"].items():
        print(f"  {t:<4} {data['published']:>2}/{data['sampled']:<3} ({data['share']:.0%})")
    print(f"\nwrote {HERE / 'publication_survey.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
