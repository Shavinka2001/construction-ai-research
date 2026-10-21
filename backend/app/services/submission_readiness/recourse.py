"""
What would actually move this application to a lower risk band.

The checklist says what is outstanding and the model says how risky that looks.
Neither answers the question an applicant asks next: *of all this, what is the
least I can do, and is it even worth starting?*

This searches for the smallest set of real actions that moves the predicted
band down. Actions are named against actual requirements — "Upload the Approved
Subdivision Plan" — rather than as feature deltas, because a feature delta is
not something a person can go and do.

Two properties make the answer honest rather than decorative:

* **Feasibility.** Only actions the applicant can take are considered. The
  number of required documents is not something they can lower, so it is never
  proposed.
* **Who controls it.** Correcting a mismatch in your own drawing takes an
  afternoon. Obtaining a clearance from the Ceylon Electricity Board does not
  depend on you at all. The search prefers the first kind, and the result
  labels each action so the two are never presented as equivalent.

When no set of up to ``MAX_ACTIONS`` actions reaches the target, that is
reported plainly. Across the synthetic set roughly a third of high-risk cases
have no short path, and saying so is more useful than a list that does not
work.
"""

from __future__ import annotations

import itertools
import logging
from typing import Literal, Optional

from app.schemas.submission_readiness import (
    RecourseAction,
    RecourseResult,
    RequirementOutcome,
    RuleSummary,
)

logger = logging.getLogger(__name__)

MAX_ACTIONS = 4

#: Beyond this the search is not worth the time; candidates are already sorted
#: by how cheap they are, so the cheap ones survive the cut.
MAX_CANDIDATES = 10

BAND_ORDER = {"low": 0, "medium": 1, "high": 2}

#: Bodies other than the one receiving the application. An action against one
#: of these is outside the applicant's control and takes as long as it takes.
EXTERNAL_AUTHORITIES = {
    "Ceylon Electricity Board",
    "National Water Supply & Drainage Board",
    "Fire Service Department",
    "Condominium Management Authority",
    "Respective Local Authority",
}

Control = Literal["applicant", "external_authority"]


def control_for(authority: str) -> Control:
    return "external_authority" if authority in EXTERNAL_AUTHORITIES else "applicant"


class _Candidate:
    """One action, with the effect it has on the model's inputs."""

    __slots__ = ("label", "requirement_id", "document_name", "control", "field", "is_clearance")

    def __init__(
        self,
        label: str,
        requirement_id: str,
        document_name: str,
        control: Control,
        field: str,
        is_clearance: bool,
    ):
        self.label = label
        self.requirement_id = requirement_id
        self.document_name = document_name
        self.control = control
        self.field = field
        self.is_clearance = is_clearance


def _candidates(outcomes: list[RequirementOutcome]) -> list[_Candidate]:
    verbs = {
        "missing": ("Obtain and upload", "missing_document_count"),
        "expired": ("Renew", "expired_document_count"),
        "needs_review": ("Correct the inconsistency in", "document_mismatch_count"),
        "unverified": ("Get verified:", "unverified_document_count"),
    }
    out: list[_Candidate] = []
    for o in outcomes:
        spec = verbs.get(o.state)
        if spec is None:
            continue
        verb, field = spec
        control = control_for(o.authority)
        out.append(
            _Candidate(
                label=f"{verb} {o.document_name}",
                requirement_id=o.requirement_id,
                document_name=o.document_name,
                control=control,
                field=field,
                is_clearance=control == "external_authority",
            )
        )
    # Cheapest first: what the applicant controls, and missing documents before
    # softer states, so the surviving candidates are the actionable ones.
    weight = {"missing_document_count": 0, "expired_document_count": 1,
              "document_mismatch_count": 2, "unverified_document_count": 3}
    out.sort(key=lambda c: (c.control != "applicant", weight.get(c.field, 9)))
    return out[:MAX_CANDIDATES]


def _apply(summary: RuleSummary, combo: tuple[_Candidate, ...], outstanding_clearances: int) -> dict:
    row = {
        "required_document_count": summary.required_document_count,
        "submitted_document_count": summary.submitted_document_count,
        "missing_document_count": summary.missing_document_count,
        "document_mismatch_count": summary.document_mismatch_count,
        "expired_document_count": summary.expired_document_count,
        "unverified_document_count": summary.unverified_document_count,
        "conditional_clearance_required": summary.conditional_clearance_required,
        "conditional_clearance_submitted": summary.conditional_clearance_submitted,
    }
    cleared = 0
    for c in combo:
        row[c.field] = max(0, row[c.field] - 1)
        if c.field == "missing_document_count":
            row["submitted_document_count"] += 1
        if c.is_clearance:
            cleared += 1
    # The clearance flag flips only once every outstanding clearance is handled.
    if row["conditional_clearance_required"] and cleared >= outstanding_clearances > 0:
        row["conditional_clearance_submitted"] = True
    return row


def compute(
    application_type: str,
    summary: RuleSummary,
    outcomes: list[RequirementOutcome],
    current_band: str,
    predict_band,
) -> Optional[RecourseResult]:
    """
    Smallest feasible action set that lowers the band, or ``None`` when the
    model is unavailable or the application is already at ``low``.

    ``predict_band`` takes a feature dict and returns a band, so this module
    does not need to know how the model is loaded.
    """
    if current_band not in BAND_ORDER or current_band == "low":
        return None

    candidates = _candidates(outcomes)
    if not candidates:
        return RecourseResult(
            attainable=False,
            target_band="low",
            actions=[],
            note="No action available to the applicant would change the inputs the model uses.",
        )

    outstanding_clearances = sum(1 for c in candidates if c.is_clearance)

    for depth in range(1, MAX_ACTIONS + 1):
        # Among sets of this size that work, prefer the one that lands lowest
        # and leans least on another authority.
        best_rank: Optional[tuple[int, int]] = None
        best: Optional[tuple[tuple[_Candidate, ...], str]] = None

        for combo in itertools.combinations(candidates, depth):
            try:
                band = predict_band(_apply(summary, combo, outstanding_clearances))
            except Exception:  # noqa: BLE001 — a prediction failure is not fatal here
                logger.exception("recourse prediction failed")
                return None
            if BAND_ORDER.get(band, 9) >= BAND_ORDER[current_band]:
                continue
            rank = (
                BAND_ORDER[band],
                sum(1 for c in combo if c.control == "external_authority"),
            )
            if best_rank is None or rank < best_rank:
                best_rank, best = rank, (combo, band)

        if best is not None:
            combo, band = best
            return RecourseResult(
                attainable=True,
                target_band=band,
                actions=[
                    RecourseAction(
                        action=c.label,
                        requirement_id=c.requirement_id,
                        document_name=c.document_name,
                        control=c.control,
                    )
                    for c in combo
                ],
                note=(
                    f"{len(combo)} action(s) would move this from {current_band} to {band}."
                ),
            )

    return RecourseResult(
        attainable=False,
        target_band="low",
        actions=[],
        note=(
            f"No combination of up to {MAX_ACTIONS} actions reaches a lower band. "
            "This application is structurally incomplete rather than a few fixes away."
        ),
    )
