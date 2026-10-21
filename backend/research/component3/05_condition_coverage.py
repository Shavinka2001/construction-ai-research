"""
Measure how much of the approval checklist can be decided without a human.

This is the component's main empirical claim, and it is a claim about the
regulations rather than about the model.

UDA publishes what documents a development permit needs. What it does not
publish, in any resolvable form, is whether a given requirement applies to a
given site under a given local authority. A requirement like "Street Line /
Building Line Certificate — if the proposed building is situated in CMC area"
is perfectly clear prose and completely undecidable for a site in Matara: the
condition names a different local authority, and no published source says what
the Matara equivalent is.

So the question worth measuring is not "how accurate is the model" but: **given
everything the system could know about an application, what fraction of the
official checklist can it settle on its own?**

Each `condition_key` is attributed to the data source that could settle it.
Four sources, in increasing order of how hard they are to obtain:

* `always`          — mandatory, applies to every application of this type.
* `project_record`  — a field the system could capture when a project is
                      created. Cheap: a form field and a migration.
* `document_ocr`    — needs the document-verification module to read a
                      submitted document and extract a fact from it.
* `geospatial`      — needs the zoning / hazard module to classify the site.
* `jurisdiction`    — follows from where the site is, which the request
                      already carries.

Note on what this does *not* measure. Every condition in the UDA list resolves
given the right data; the open question is whether that list is *complete* for
a given site, which is a separate matter and not something a coverage figure
can settle. See findings.md.

The output is a coverage figure per application type and, more usefully, what
each unintegrated module would add if it were wired up. That turns the metric
into an integration roadmap instead of a grade.

Run: python backend/research/component3/05_condition_coverage.py
Writes: backend/research/component3/condition_coverage.json
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
REQUIREMENTS = ROOT / "data" / "uda_requirements.csv"

#: Which data source could settle each condition, and why.
CONDITION_SOURCES: dict[str, tuple[str, str]] = {
    "declarations_applicable": (
        "project_record",
        "Whether the applicant, owner and qualified persons must file declaration forms follows from who is filing.",
    ),
    "applicant_is_organization": (
        "project_record",
        "A company or an individual — known at registration.",
    ),
    "applicant_not_owner": (
        "document_ocr",
        "Needs the deed read and the owner name compared with the applicant.",
    ),
    "existing_building_on_land": (
        "geospatial",
        "Derivable from the site survey or imagery the land module already holds.",
    ),
    "ppc_available": (
        "project_record",
        "Whether a Preliminary Planning Clearance was obtained — a yes/no the applicant states.",
    ),
    "ppc_specifies_clearances": (
        "document_ocr",
        "Needs the PPC document itself read, since the clearances it names vary per case.",
    ),
    "non_residential_or_apartment": (
        "project_record",
        "Building use. One field, and it gates the five-clearance group — the highest-value single field on this list.",
    ),
    "is_condominium": (
        "project_record",
        "Tenure type, stated at project creation.",
    ),
    "activity_is_building_construction": (
        "project_record",
        "Development activity type.",
    ),
    "activity_is_land_subdivision": (
        "project_record",
        "Development activity type.",
    ),
    "in_cmc_area": (
        "jurisdiction",
        "The condition names the Colombo Municipal Council area, so it follows from where the site is. A Matara site resolves it to false.",
    ),
}

SOURCE_ORDER = ["always", "jurisdiction", "project_record", "document_ocr", "geospatial"]

#: Condition keys the running system supplies today, from project attributes
#: captured at project creation. Kept in sync with DERIVABLE_KEYS in
#: app/services/submission_readiness/project_context.py — the test suite
#: asserts the numbers this produces.
#:
#: Everything else is reported as manual review by the rule engine, which is
#: the correct behaviour and also the thing this script quantifies.
CURRENTLY_SUPPLIED: set[str] = {
    "non_residential_or_apartment",
    "is_condominium",
    "applicant_is_organization",
    "ppc_available",
    "declarations_applicable",
    "activity_is_building_construction",
    "activity_is_land_subdivision",
    # Settled from the request's jurisdiction — see
    # app/services/submission_readiness/jurisdiction_context.py
    "in_cmc_area",
}


def load_rows() -> list[dict[str, str]]:
    with REQUIREMENTS.open(newline="", encoding="utf-8") as fh:
        return [r for r in csv.DictReader(fh) if (r.get("requirement_id") or "").strip()]


def main() -> None:
    rows = load_rows()
    by_type: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_type[row["application_type"]].append(row)

    unmapped = sorted(
        {
            r["condition_key"]
            for r in rows
            if r["condition_key"] and r["condition_key"] not in CONDITION_SOURCES
        }
    )
    if unmapped:
        raise SystemExit(
            "condition_key(s) with no attributed data source: " + ", ".join(unmapped)
        )

    report: dict[str, object] = {}

    for app_type, group in sorted(by_type.items()):
        counts: Counter[str] = Counter()
        for row in group:
            key = row["condition_key"]
            source = "always" if not key else CONDITION_SOURCES[key][0]
            counts[source] += 1

        total = len(group)
        decidable_now = counts["always"] + sum(
            1
            for r in group
            if r["condition_key"] and r["condition_key"] in CURRENTLY_SUPPLIED
        )

        # What each module would add on top of what is already decidable.
        gains: dict[str, int] = {}
        running = decidable_now
        for source in ("project_record", "document_ocr", "geospatial"):
            # Only count what is not already supplied.
            outstanding = sum(
                1
                for r in group
                if r["condition_key"]
                and CONDITION_SOURCES[r["condition_key"]][0] == source
                and r["condition_key"] not in CURRENTLY_SUPPLIED
            )
            gains[source] = outstanding
            running += outstanding

        report[app_type] = {
            "total_requirements": total,
            "by_source": {s: counts[s] for s in SOURCE_ORDER if counts[s]},
            "decidable_today": decidable_now,
            "coverage_today": round(decidable_now / total, 3),
            "coverage_if_all_modules_integrated": round(running / total, 3),
            "gain_per_module": gains,
            "settled_by_jurisdiction": counts["jurisdiction"],
        }

    report["_reading"] = (
        "Coverage counts requirements the system can settle without asking a "
        "person. The remainder are not errors: the rule engine reports them as "
        "manual review carrying the condition text and the official source. "
        "The distance from today to full integration is an engineering "
        "backlog, and it is the only thing this figure measures. Whether the "
        "UDA list is complete for a site under an authority operating outside "
        "the UDA arrangement is a separate question, and no coverage figure "
        "answers it."
    )
    report["_currently_supplied_keys"] = sorted(CURRENTLY_SUPPLIED)

    (HERE / "condition_coverage.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )

    for app_type in sorted(by_type):
        data = report[app_type]  # type: ignore[index]
        print(f"\n{app_type}  ({data['total_requirements']} requirements)")
        print(
            f"  decidable today              {data['decidable_today']:>3}"
            f"   ({data['coverage_today']:.0%})"
        )
        outstanding = {s: n for s, n in data["gain_per_module"].items() if n}
        if outstanding:
            print("  would be added by wiring up:")
            for source, n in outstanding.items():
                print(f"    {source:<24} {n:>3}")
            print(
                f"  if all modules integrated        "
                f"({data['coverage_if_all_modules_integrated']:.0%})"
            )
        else:
            print("  nothing left for the unbuilt modules to add")
        print(
            f"  settled by jurisdiction        {data['settled_by_jurisdiction']:>3}"
        )

    print(f"\nwrote {HERE / 'condition_coverage.json'}")


if __name__ == "__main__":
    main()
