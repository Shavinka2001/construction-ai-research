"""
Generate the synthetic application-scenario dataset for Component 3.

No historical approved/rejected/rework labels exist for Sri Lankan building
approvals, so training cases are generated from a documented policy instead of
collected. See ``labelling_policy.md`` for the reasoning; the short version is
that a label must NOT be a clean function of the features the model is given,
otherwise the classifier only relearns the rule engine and reports a
meaningless accuracy.

Two devices keep the task honest:

1. Latent factors. Drawing complexity, how ambiguous an applicable condition
   is, and who filed the application all move the risk score, and none of them
   is exported as a feature. They put a ceiling on achievable accuracy, exactly
   as unobservable factors do in the real process.
2. Stochastic labels. The score is mapped to class probabilities and then
   sampled, rather than cut at a hard threshold, so neighbouring cases overlap.

Output: ``backend/data/approval_scenarios_synthetic.csv``
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np

SEED = 20261020
ROOT = Path(__file__).resolve().parents[2]
OUT_CSV = ROOT / "backend" / "data" / "approval_scenarios_synthetic.csv"
OUT_META = ROOT / "backend" / "data" / "approval_scenarios_synthetic.meta.json"

VARIANTS_PER_TEMPLATE = 18

# Mandatory-document counts, taken from backend/data/uda_requirements.csv.
# The applicable total is this plus whichever conditional requirements the case
# triggers, so required_document_count varies per case rather than being fixed
# per application type — which is how the rule engine computes it at runtime.
MANDATORY_DOCS = {"building_permit": 8, "coc": 2}

RISK_CLASSES = ("low", "medium", "high")

# --- score weights -------------------------------------------------------
# Visible: exported as features, so the model can learn these.
#
# These terms are deliberately NOT a plain weighted sum. A purely additive
# score is optimally classified by thresholding that same sum, which is what
# the rule baseline does, so an additive policy leaves a learner nothing to
# find. The interactions below are the ones a reviewer would actually describe:
#
#   * Requirements for a Certificate of Conformity are lighter than for a
#     Building Permit, so a missing document costs less there.
#   * Deficiencies saturate. Past about three missing items the application is
#     returned regardless, so the fourth adds little.
#   * Mismatches surface in proportion to how much was actually submitted.
#   * A missing conditional clearance dominates when it is the only thing
#     outstanding, because nothing else is holding the file up.
#   * An expired document is worse amid several unverified ones.
# Raised from 1.85 after integration testing: with the old weight, missing
# documents saturated at 4.77 against a high-risk cut point of 8.25, so no
# number of missing mandatory documents could on its own produce a high band.
# Three missing mandatory documents is definitionally a rework, so the
# saturation ceiling has to sit above the cut point, not below it.
W_MISSING = 2.60
W_MISMATCH = 0.85
# Close to the per-item weight of a missing document, and for the same reason:
# an expired certificate has to be obtained again before the file can proceed,
# so in rework terms the applicant does not have it. At 0.65 a case whose only
# defect was an expired document came out low risk, which contradicted the rule
# engine calling the same case blocking.
W_EXPIRED = 2.20
W_UNVERIFIED = 0.38
W_CLEARANCE_GAP = 1.60

TYPE_MISSING_MULTIPLIER = {"building_permit": 1.00, "coc": 0.60}
MISSING_SATURATION = 3          # items beyond this add almost nothing
CLEARANCE_SOLE_BLOCKER = 1.85   # multiplier when nothing else is missing
EXPIRED_COMPOUNDING = 1.60      # multiplier when unverified_count >= 2

# Latent: shape the label, never exported. These are what cap the ceiling.
# Sized so that a good model lands in the high 0.70s / low 0.80s rather than
# near 1.0: enough unobservable influence to be realistic, not so much that the
# visible evidence stops mattering.
W_COMPLEXITY = 0.70          # x complexity level (0 simple, 1 moderate, 2 complex)
W_AMBIGUITY = 1.10           # x condition_ambiguity in [0, 1], conditional cases only
APPLICANT_PENALTY = {"first_time": 0.55, "repeat": 0.20, "agent": 0.0}

NOISE_SD = 0.38

# How many mismatched / expired / unverified documents a template tends to
# carry. A template dimension, so these archetypes never straddle the split.
DEFECT_PROFILES = {
    "clean": {"mismatch": (0, 1), "expired": (0, 1), "unverified": (0, 2)},
    "mismatch_heavy": {"mismatch": (1, 4), "expired": (0, 2), "unverified": (0, 2)},
    "expiry_heavy": {"mismatch": (0, 2), "expired": (1, 3), "unverified": (1, 4)},
    "mixed": {"mismatch": (0, 3), "expired": (0, 3), "unverified": (0, 3)},
}

# Logistic cut points turning a score into class probabilities. Set near the
# 33rd and 67th percentiles of the total score so the three classes come out
# roughly balanced; re-check these if any weight above changes.
# T_HIGH sits just below the score of a case whose only defect is three missing
# mandatory documents (8.81), so that case lands in the high band. An
# application missing three mandatory documents will be returned, and a policy
# that called it medium would be wrong about its own domain.
T_LOW, T_HIGH, SOFTNESS = 2.80, 7.20, 1.15

# Drawing complexity leans on project scale, which is a template dimension.
COMPLEXITY_P = {
    "small": [0.55, 0.33, 0.12],
    "large": [0.15, 0.35, 0.50],
}


def _sigmoid(x: float) -> float:
    return float(1.0 / (1.0 + np.exp(-x)))


def build_templates() -> list[dict]:
    """
    Scenario archetypes. A template fixes the shape of a case; variants jitter
    the counts around it. Train/test is split on ``template_id`` so that no
    archetype appears on both sides of the split.
    """
    templates: list[dict] = []
    tid = 0
    for app_type in ("building_permit", "coc"):
        for missing in range(0, 3):
            for clearance in (False, True):
                for profile in DEFECT_PROFILES:
                    for scale in ("small", "large"):
                        templates.append(
                            {
                                "template_id": f"T{tid:03d}",
                                "application_type": app_type,
                                "base_missing": missing,
                                "conditional_clearance_required": clearance,
                                "defect_profile": profile,
                                "scale": scale,
                            }
                        )
                        tid += 1
    return templates


def _triggered_conditionals(rng: np.random.Generator, tpl: dict) -> int:
    """
    How many conditional requirements this case triggers.

    Mirrors the condition groups in ``uda_requirements.csv``: a non-residential
    building or apartment pulls in the five-clearance group, a Certificate of
    Conformity pulls in either the building-construction set or the larger land
    subdivision set, and declaration forms apply to nearly everyone.

    The count may be zero. That is the case where the caller resolved every
    condition to "does not apply", and the rule engine then reports only the
    mandatory documents. Leaving it out would train the model on a narrower
    range of ``required_document_count`` than it is served at runtime, which is
    the train/serve skew this project already got caught by once.
    """
    if tpl["application_type"] == "building_permit":
        count = int(rng.integers(0, 4))             # declarations / organisation / PPC / POA
        if tpl["scale"] == "large":
            count += 5                              # non-residential or apartment clearances
        if tpl["conditional_clearance_required"]:
            count += 1                              # clearances named in the PPC
        return count

    # Certificate of Conformity: one activity group, plus declarations.
    if rng.random() < 0.15:
        return 0
    return int(rng.integers(0, 2)) + (4 if rng.random() < 0.7 else 5)


def sample_case(rng: np.random.Generator, tpl: dict) -> dict:
    app_type = tpl["application_type"]
    required = MANDATORY_DOCS[app_type] + _triggered_conditionals(rng, tpl)
    profile = DEFECT_PROFILES[tpl["defect_profile"]]

    missing = int(np.clip(tpl["base_missing"] + rng.integers(-1, 2), 0, required))
    submitted = required - missing

    mismatch = int(rng.integers(*profile["mismatch"]))
    expired = int(rng.integers(*profile["expired"]))
    unverified = int(rng.integers(*profile["unverified"]))

    # A document cannot be flagged if it was never submitted.
    mismatch = min(mismatch, submitted)
    expired = min(expired, submitted)
    unverified = min(unverified, max(submitted - mismatch, 0))

    clearance_required = bool(tpl["conditional_clearance_required"])
    if clearance_required:
        clearance_submitted = bool(rng.random() < (0.45 if submitted < required else 0.75))
    else:
        clearance_submitted = False

    # --- latent factors: used for the label, never exported ---------------
    complexity = int(rng.choice([0, 1, 2], p=COMPLEXITY_P[tpl["scale"]]))
    applicant = str(rng.choice(["first_time", "repeat", "agent"], p=[0.45, 0.35, 0.20]))
    ambiguity = float(rng.beta(2, 3)) if clearance_required else 0.0

    clearance_gap = float(clearance_required and not clearance_submitted)

    missing_term = (
        W_MISSING
        * TYPE_MISSING_MULTIPLIER[tpl["application_type"]]
        * min(missing, MISSING_SATURATION) ** 0.85
    )
    mismatch_term = W_MISMATCH * mismatch * (0.5 + submitted / required)
    clearance_term = (
        W_CLEARANCE_GAP
        * clearance_gap
        * (CLEARANCE_SOLE_BLOCKER if missing == 0 else 1.0)
    )
    expired_term = W_EXPIRED * expired * (EXPIRED_COMPOUNDING if unverified >= 2 else 1.0)

    score = (
        missing_term
        + mismatch_term
        + expired_term
        + W_UNVERIFIED * unverified
        + clearance_term
        + W_COMPLEXITY * complexity
        + W_AMBIGUITY * ambiguity
        + APPLICANT_PENALTY[applicant]
        + float(rng.normal(0.0, NOISE_SD))
    )

    p_high = _sigmoid((score - T_HIGH) / SOFTNESS)
    p_low = _sigmoid((T_LOW - score) / SOFTNESS)
    p_medium = max(0.0, 1.0 - p_high - p_low)
    probs = np.array([p_low, p_medium, p_high], dtype=float)
    probs /= probs.sum()

    label = str(rng.choice(RISK_CLASSES, p=probs))

    return {
        "case_id": "",  # filled by the caller
        "template_id": tpl["template_id"],
        "application_type": tpl["application_type"],
        "required_document_count": required,
        "submitted_document_count": submitted,
        "missing_document_count": missing,
        "document_mismatch_count": mismatch,
        "expired_document_count": expired,
        "unverified_document_count": unverified,
        "conditional_clearance_required": clearance_required,
        "conditional_clearance_submitted": clearance_submitted,
        "risk_label": label,
    }


def main() -> None:
    rng = np.random.default_rng(SEED)
    templates = build_templates()

    rows: list[dict] = []
    for tpl in templates:
        for _ in range(VARIANTS_PER_TEMPLATE):
            case = sample_case(rng, tpl)
            case["case_id"] = f"SYN-{len(rows):04d}"
            rows.append(case)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    counts = {c: sum(r["risk_label"] == c for r in rows) for c in RISK_CLASSES}
    meta = {
        "synthetic": True,
        "seed": SEED,
        "generator": "research/component3/01_generate_synthetic.py",
        "labelling_policy": "research/component3/labelling_policy.md",
        "rows": len(rows),
        "templates": len(templates),
        "variants_per_template": VARIANTS_PER_TEMPLATE,
        "class_counts": counts,
        "latent_factors_not_exported": [
            "drawing_complexity",
            "condition_ambiguity",
            "applicant_type",
        ],
        "warning": (
            "Labels are generated, not observed. Metrics measure how learnable "
            "the labelling policy is, not real approval or rework outcomes."
        ),
    }
    OUT_META.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"wrote {len(rows)} rows from {len(templates)} templates -> {OUT_CSV}")
    for cls, n in counts.items():
        print(f"  {cls:<7} {n:>4}  ({100 * n / len(rows):.1f}%)")


if __name__ == "__main__":
    main()
