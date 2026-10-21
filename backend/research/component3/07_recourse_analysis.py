"""
How often is a high-risk application actually fixable, and at what cost?

The risk band tells an applicant where they stand. It does not tell them
whether standing there is recoverable. This measures that across the synthetic
set: for every case the model puts in a band above `low`, what is the smallest
set of feasible actions that moves it down, and how often is there none?

Two things make the question worth asking rather than decorative.

**Feasibility.** Only actions an applicant can take are searched. The number of
documents their application requires is not one of them, so it is never
proposed — a counterfactual that says "need fewer requirements" is not recourse.

**Who controls it.** Correcting a mismatch in your own drawing and obtaining a
clearance from the Ceylon Electricity Board are both one action and are not
remotely the same task. The analysis reports them separately, because an
applicant told "two actions" where both sit with another authority has been
told something misleading.

Run: python backend/research/component3/07_recourse_analysis.py
Writes: recourse_analysis.json
"""

from __future__ import annotations

import itertools
import json
import sys
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1]
sys.path.insert(0, str(BACKEND))

MODEL = BACKEND / "app" / "ml" / "submission_risk_v1.joblib"
DATA = BACKEND / "data" / "approval_scenarios_synthetic.csv"

MAX_ACTIONS = 4
BAND_ORDER = {"low": 0, "medium": 1, "high": 2}

#: Each action, as the feature it moves. `clearance` is the only one that
#: stands for a third party.
ACTIONS = [
    ("supply a missing document", "missing_document_count", False),
    ("renew an expired document", "expired_document_count", False),
    ("correct a mismatch", "document_mismatch_count", False),
    ("get a document verified", "unverified_document_count", False),
    ("obtain the applicable clearance", "__clearance__", True),
]


def available(row: dict) -> list[tuple[str, str, bool]]:
    out = []
    for label, field, external in ACTIONS:
        if field == "__clearance__":
            if row["conditional_clearance_required"] and not row["conditional_clearance_submitted"]:
                out.append((label, field, external))
        elif row.get(field, 0) > 0:
            out.append((label, field, external))
    return out


def apply(row: dict, combo) -> dict:
    r = dict(row)
    for _, field, _ in combo:
        if field == "__clearance__":
            r["conditional_clearance_submitted"] = True
        else:
            r[field] = max(0, r[field] - 1)
            if field == "missing_document_count":
                r["submitted_document_count"] += 1
    return r


def main() -> None:
    model = joblib.load(MODEL)
    feats = list(model.feature_names_in_)
    df = pd.read_csv(DATA)

    rows = df[feats].to_dict("records")
    bands = model.predict(pd.DataFrame(rows)[feats])

    depths: list[int] = []
    externals: list[int] = []
    unreachable = 0
    probed = 0

    for row, band in zip(rows, bands):
        if band == "low":
            continue
        probed += 1
        found = None
        for depth in range(1, MAX_ACTIONS + 1):
            pool = available(row)
            if depth > len(pool):
                break
            best = None
            for combo in itertools.combinations(pool, depth):
                cand = apply(row, combo)
                if BAND_ORDER[model.predict(pd.DataFrame([cand])[feats])[0]] < BAND_ORDER[band]:
                    ext = sum(1 for _, _, e in combo if e)
                    if best is None or ext < best:
                        best = ext
            if best is not None:
                found = (depth, best)
                break
        if found:
            depths.append(found[0])
            externals.append(found[1])
        else:
            unreachable += 1

    n = probed or 1
    result = {
        "max_actions_searched": MAX_ACTIONS,
        "cases_above_low": probed,
        "recoverable": len(depths),
        "recoverable_share": round(len(depths) / n, 3),
        "no_short_path": unreachable,
        "no_short_path_share": round(unreachable / n, 3),
        "median_actions": int(np.median(depths)) if depths else None,
        "actions_distribution": {str(k): v for k, v in sorted(Counter(depths).items())},
        "needing_another_authority": sum(1 for e in externals if e > 0),
        "reading": (
            "A band on its own does not say whether the application is "
            "recoverable. Where no set of up to four feasible actions lowers "
            "it, the application is structurally incomplete rather than a few "
            "fixes away, and telling the applicant that is more useful than a "
            "list of actions that would not work."
        ),
    }

    (HERE / "recourse_analysis.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(f"cases above low        : {probed}")
    print(f"recoverable in <= {MAX_ACTIONS}    : {len(depths)} ({result['recoverable_share']:.0%})")
    print(f"no short path          : {unreachable} ({result['no_short_path_share']:.0%})")
    print(f"median actions         : {result['median_actions']}")
    print(f"distribution           : {result['actions_distribution']}")
    print(f"needing another body   : {result['needing_another_authority']}")
    print(f"\nwrote {HERE / 'recourse_analysis.json'}")


if __name__ == "__main__":
    main()
