"""
Combine the deterministic findings and the risk prediction into one result.

Order matters. The rule engine runs first and produces the counts; the model
reads those counts. The model never decides whether a document is missing — that
is a fact the rule engine establishes from the requirements dataset.

The two halves stay separate all the way out to the client, because a user
acting on "your street line certificate is missing" and a user reading "this
application looks likely to need rework" are doing different things with
different levels of certainty behind them.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app.schemas.submission_readiness import (
    AssessmentRequest,
    AssessmentResult,
    AssessmentStatus,
    ProcedureStep,
    RuleFinding,
    RuleSummary,
)
from app.services.submission_readiness import (
    acquisition_guide,
    jurisdiction_context,
    recourse as recourse_service,
    risk_model,
    rule_engine,
)
from app.services.submission_readiness.requirements_repo import is_supported

logger = logging.getLogger(__name__)

MAX_RECOMMENDED_ACTIONS = 8


def _status(summary: RuleSummary, findings: list[RuleFinding]) -> AssessmentStatus:
    """
    ``incomplete`` beats ``review_required`` beats ``ready``.

    ``ready`` says the paperwork is complete, never that approval will follow.
    """
    if any(f.severity == "blocking" for f in findings):
        return "incomplete"
    if findings or summary.manual_review_count:
        return "review_required"
    return "ready"


def _recommended_actions(findings: list[RuleFinding]) -> list[str]:
    """Corrective actions, most urgent first, de-duplicated."""
    rank = {"blocking": 0, "attention": 1, "informational": 2}
    ordered = sorted(findings, key=lambda f: rank.get(f.severity, 3))
    seen: set[str] = set()
    actions: list[str] = []
    for finding in ordered:
        if finding.corrective_action in seen:
            continue
        seen.add(finding.corrective_action)
        actions.append(finding.corrective_action)
        if len(actions) >= MAX_RECOMMENDED_ACTIONS:
            break
    return actions


def assess_application(request: AssessmentRequest) -> Optional[AssessmentResult]:
    """
    Assess one application.

    Returns ``None`` when the application type has no rules on record, so the
    caller can answer with a clear "unsupported" rather than an empty checklist
    that would read as a pass.
    """
    if not is_supported(request.application_type):
        logger.warning(
            "assessment requested for unsupported application_type=%r",
            request.application_type,
        )
        return None

    # Geographic conditions follow from the jurisdiction, so they are settled
    # here rather than being asked of the caller. An explicit flag in the
    # request still wins, which is how a caller corrects a jurisdiction the
    # system has mapped wrongly.
    context = {
        **jurisdiction_context.derive_context(request.jurisdiction),
        **request.context,
    }

    rules = rule_engine.evaluate(
        application_type=request.application_type,
        documents=request.documents,
        context=context,
    )
    if not rules.supported:
        return None

    prediction = risk_model.predict(request.application_type, rules.summary)
    ml_available = prediction is not None

    # What would actually move the band down. Only meaningful when there is a
    # band to move, so it is skipped when the model is unavailable.
    recourse = None
    if prediction is not None:
        recourse = recourse_service.compute(
            application_type=request.application_type,
            summary=rules.summary,
            outcomes=rules.outcomes,
            current_band=prediction.risk_level,
            predict_band=lambda row: risk_model.predict_row(
                request.application_type, row
            ),
        )

    actions = _recommended_actions(rules.findings)
    if rules.unrecognised_uploads:
        labels = ", ".join(sorted(set(rules.unrecognised_uploads)))
        actions.append(
            f"Check these uploads — they did not match any requirement: {labels}."
        )

    return AssessmentResult(
        assessment_id=f"ASSESS-{uuid4().hex[:12].upper()}",
        project_id=request.project_id,
        application_type=request.application_type,
        jurisdiction=request.jurisdiction,
        assessment_status=_status(rules.summary, rules.findings),
        summary=rules.summary,
        requirements=rules.outcomes,
        rule_based_findings=rules.findings,
        ml_prediction=prediction,
        ml_available=ml_available,
        ml_unavailable_reason=None if ml_available else risk_model.unavailable_reason(),
        recommended_actions=actions,
        recourse=recourse,
        application_procedure=[
            ProcedureStep(
                step_order=s.step_order,
                step=s.step,
                source_url=s.source_url,
                source_section=s.source_section,
            )
            for s in acquisition_guide.procedure_for(request.application_type)
        ],
        acquisition_coverage=acquisition_guide.publication_summary(),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
