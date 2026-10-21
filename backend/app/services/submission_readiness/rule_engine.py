"""
Deterministic requirement matching. No model is involved here.

Given an application type, the documents a user uploaded and a set of condition
flags, this decides which official requirements apply and which of them are
satisfied. Every finding it emits carries the requirement id and the source the
requirement was read from, so a user can check the claim against the regulation.

Three rules govern the awkward cases, and they matter more than the happy path:

* An unknown condition is not a false condition. If the caller did not say
  whether the site is in a landslide zone, the clearance that depends on it is
  flagged ``manual_review``, never ``missing``. Telling someone they are missing
  a document that may not apply to them is worse than saying so.
* ``verified`` is a claim about extraction, not authenticity. A document the
  OCR module could read but could not validate stays ``unverified`` and raises
  an attention-level finding, not a blocking one.
* An unsupported application type yields no findings at all rather than an
  empty checklist that reads like a clean bill of health.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from app.schemas.submission_readiness import (
    AcquisitionGuide,
    RequirementOutcome,
    RuleFinding,
    RuleSummary,
    SubmittedDocument,
)
from app.services.submission_readiness import acquisition_guide, document_mapper
from app.services.submission_readiness.requirements_repo import (
    Requirement,
    for_application_type,
)

logger = logging.getLogger(__name__)

#: Statuses that mean the document is present but not yet dependable.
_PROBLEM_STATUSES = {"needs_review", "unverified", "expired"}


@dataclass
class RuleResult:
    outcomes: list[RequirementOutcome] = field(default_factory=list)
    findings: list[RuleFinding] = field(default_factory=list)
    summary: RuleSummary = field(
        default_factory=lambda: RuleSummary(
            required_document_count=0,
            submitted_document_count=0,
            missing_document_count=0,
            document_mismatch_count=0,
            expired_document_count=0,
            unverified_document_count=0,
            manual_review_count=0,
            conditional_clearance_required=False,
            conditional_clearance_submitted=False,
        )
    )
    unrecognised_uploads: list[str] = field(default_factory=list)
    supported: bool = True


def _applicability(
    requirement: Requirement, context: dict[str, bool]
) -> Optional[bool]:
    """
    ``True`` applies, ``False`` does not, ``None`` cannot be determined.

    The third case is the point of this function.
    """
    if requirement.requirement_type == "mandatory":
        return True
    key = requirement.condition_key
    if not key:
        return None
    if key not in context:
        return None
    return bool(context[key])


def _finding(
    requirement: Requirement,
    state: str,
    severity: str,
    issue: str,
    corrective_action: str,
) -> RuleFinding:
    return RuleFinding(
        requirement_id=requirement.requirement_id,
        document_name=requirement.document_name,
        state=state,  # type: ignore[arg-type]
        severity=severity,  # type: ignore[arg-type]
        issue=issue,
        corrective_action=corrective_action,
        authority=requirement.authority,
        condition=requirement.condition,
        source_url=requirement.source_url,
        source_section=requirement.source_section,
    )


def evaluate(
    application_type: str,
    documents: list[SubmittedDocument],
    context: dict[str, bool],
) -> RuleResult:
    """Match uploads against the official requirements for this application."""
    requirements = for_application_type(application_type)
    if not requirements:
        logger.warning(
            "no requirements on record for application_type=%r — returning "
            "unsupported rather than an empty checklist",
            application_type,
        )
        return RuleResult(supported=False)

    result = RuleResult()

    # --- bind each upload to the requirement it satisfies -----------------
    bound: dict[str, SubmittedDocument] = {}
    for document in documents:
        requirement = document_mapper.match(document.type, requirements)
        if requirement is None:
            result.unrecognised_uploads.append(document.type)
            continue
        # If the same requirement is uploaded twice, keep the healthier one so a
        # corrected re-upload supersedes the copy it replaced.
        existing = bound.get(requirement.requirement_id)
        if existing is None or _health(document) > _health(existing):
            bound[requirement.requirement_id] = document

    applicable = 0
    satisfied = 0
    missing = 0
    mismatches = 0
    expired = 0
    unverified = 0
    manual = 0
    clearance_required = False
    clearance_satisfied = True

    for requirement in requirements:
        applies = _applicability(requirement, context)
        document = bound.get(requirement.requirement_id)

        # --- condition cannot be resolved ---------------------------------
        if applies is None:
            manual += 1
            state = "manual_review"
            result.findings.append(
                _finding(
                    requirement,
                    state,
                    "attention",
                    f"Cannot determine whether {requirement.document_name} applies to this application.",
                    (
                        f"Confirm with {requirement.authority} whether this applies: "
                        f"{requirement.condition or 'condition not recorded'}."
                    ),
                )
            )
            result.outcomes.append(_outcome(requirement, state))
            continue

        # --- condition resolved to "does not apply" ------------------------
        if applies is False:
            result.outcomes.append(_outcome(requirement, "not_applicable"))
            continue

        applicable += 1
        if requirement.is_clearance:
            clearance_required = True

        # --- applicable but nothing uploaded -------------------------------
        if document is None or document.status == "missing":
            missing += 1
            if requirement.is_clearance:
                clearance_satisfied = False
            severity = "blocking" if requirement.requirement_type == "mandatory" else "attention"
            result.findings.append(
                _finding(
                    requirement,
                    "missing",
                    severity,
                    f"{requirement.document_name} has not been submitted.",
                    f"Obtain {requirement.document_name} from {requirement.authority} and upload it.",
                )
            )
            result.outcomes.append(_outcome(requirement, "missing"))
            continue

        # --- uploaded; judge its condition ---------------------------------
        state = _state_for(document)
        if state != "satisfied" and requirement.is_clearance:
            clearance_satisfied = False

        if document.expired or document.status == "expired":
            expired += 1
            result.findings.append(
                _finding(
                    requirement,
                    "expired",
                    "blocking",
                    f"{requirement.document_name} has expired.",
                    f"Obtain a current {requirement.document_name} from {requirement.authority}.",
                )
            )
        elif document.mismatch_count > 0 or document.status == "needs_review":
            mismatches += document.mismatch_count
            result.findings.append(
                _finding(
                    requirement,
                    "needs_review",
                    "attention",
                    (
                        f"{requirement.document_name} has "
                        f"{document.mismatch_count} field(s) that disagree with other documents."
                        if document.mismatch_count
                        else f"{requirement.document_name} needs review."
                    ),
                    f"Correct the inconsistency in {requirement.document_name} and upload it again.",
                )
            )
        elif document.status == "unverified":
            unverified += 1
            result.findings.append(
                _finding(
                    requirement,
                    "unverified",
                    "attention",
                    (
                        f"{requirement.document_name} was accepted but could not be "
                        "verified against a trusted issuer."
                    ),
                    f"Have {requirement.authority} confirm {requirement.document_name}, or submit a certified copy.",
                )
            )
        else:
            satisfied += 1

        result.outcomes.append(_outcome(requirement, state))

    for label in result.unrecognised_uploads:
        logger.info("upload %r did not match any requirement for %s", label, application_type)

    result.summary = RuleSummary(
        required_document_count=applicable,
        submitted_document_count=applicable - missing,
        missing_document_count=missing,
        document_mismatch_count=mismatches,
        expired_document_count=expired,
        unverified_document_count=unverified,
        manual_review_count=manual,
        conditional_clearance_required=clearance_required,
        conditional_clearance_submitted=clearance_required and clearance_satisfied,
    )
    return result


def _health(document: SubmittedDocument) -> int:
    """Rank a document so a better re-upload wins over the copy it replaces."""
    order = {"verified": 4, "unverified": 3, "needs_review": 2, "expired": 1, "missing": 0}
    return order.get(document.status, 0)


def _state_for(document: SubmittedDocument) -> str:
    if document.expired or document.status == "expired":
        return "expired"
    if document.mismatch_count > 0 or document.status == "needs_review":
        return "needs_review"
    if document.status == "unverified":
        return "unverified"
    return "satisfied"


def _outcome(requirement: Requirement, state: str) -> RequirementOutcome:
    # Attach how to obtain it, or the fact that nobody publishes how.
    guide = acquisition_guide.for_authority(requirement.authority)
    acquisition = (
        AcquisitionGuide(
            authority=guide.authority,
            publication_status=guide.publication_status,
            how_to_obtain=guide.how_to_obtain,
            obtain_url=guide.obtain_url,
            source_url=guide.source_url,
            source_section=guide.source_section,
            note=guide.note,
        )
        if guide is not None
        else None
    )
    return RequirementOutcome(
        requirement_id=requirement.requirement_id,
        document_name=requirement.document_name,
        requirement_type=requirement.requirement_type,
        state=state,  # type: ignore[arg-type]
        condition=requirement.condition,
        authority=requirement.authority,
        acquisition=acquisition,
    )
