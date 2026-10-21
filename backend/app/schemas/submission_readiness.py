"""
Component 3 — pre-submission compliance / submission-readiness contract.

The response deliberately keeps two kinds of statement apart:

* ``rule_based_findings`` are deterministic. They come from matching the
  uploaded documents against ``data/uda_requirements.csv`` and each one carries
  the requirement id and official source it came from.
* ``ml_prediction`` is a probabilistic estimate of how likely the application is
  to come back for rework. It is trained on synthetic scenarios and says so.

Nothing here is an approval. ``official_approval`` is always ``False``.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ApplicationType = Literal["building_permit", "coc"]

#: How the document-verification module reports a single upload. ``unverified``
#: is the honest default: an OCR pass that extracted text has not established
#: that the document is authentic.
DocumentStatus = Literal["verified", "needs_review", "unverified", "expired", "missing"]

#: Outcome of matching one requirement against the submitted documents.
RequirementState = Literal[
    "satisfied",
    "missing",
    "needs_review",
    "unverified",
    "expired",
    "not_applicable",
    "manual_review",
]

FindingSeverity = Literal["blocking", "attention", "informational"]

AssessmentStatus = Literal["ready", "review_required", "incomplete"]

RiskLevel = Literal["low", "medium", "high"]


# --------------------------------------------------------------------------- #
# Request
# --------------------------------------------------------------------------- #
class SubmittedDocument(BaseModel):
    """One upload as the document-verification module describes it."""

    type: str = Field(..., description="Document name or alias; mapped to a canonical name")
    status: DocumentStatus = "unverified"
    mismatch_count: int = Field(0, ge=0, description="Fields that disagree with other documents")
    expired: bool = False

    model_config = ConfigDict(extra="ignore")


class AssessmentRequest(BaseModel):
    project_id: Optional[int] = Field(
        None, description="Persist the assessment against this project when given"
    )
    application_type: ApplicationType
    jurisdiction: str = Field("matara", description="Local authority area")
    documents: list[SubmittedDocument] = Field(default_factory=list)
    context: dict[str, bool] = Field(
        default_factory=dict,
        description=(
            "Condition flags keyed by condition_key, e.g. "
            '{"non_residential_or_apartment": true}. A key that is absent is '
            "unknown, not false: its requirement is flagged for manual review."
        ),
    )


# --------------------------------------------------------------------------- #
# Response
# --------------------------------------------------------------------------- #
class RuleFinding(BaseModel):
    """One deterministic issue, traceable back to the official source."""

    requirement_id: str
    document_name: str
    state: RequirementState
    severity: FindingSeverity
    issue: str
    corrective_action: str
    authority: str
    condition: Optional[str] = None
    source_url: Optional[str] = None
    source_section: Optional[str] = None


class AcquisitionGuide(BaseModel):
    """
    How to obtain this document, where that is published.

    ``publication_status`` is the point of this model. For most issuing
    authorities no procedure is published, and the UI shows that rather than a
    plausible-sounding invention — the blank is information.
    """

    authority: str
    publication_status: Literal["published", "not_published"]
    how_to_obtain: Optional[str] = None
    obtain_url: Optional[str] = None
    source_url: Optional[str] = None
    source_section: Optional[str] = None
    note: Optional[str] = None


class ProcedureStep(BaseModel):
    """One sourced step for lodging the application itself."""

    step_order: int
    step: str
    source_url: Optional[str] = None
    source_section: Optional[str] = None


class RequirementOutcome(BaseModel):
    """Every applicable requirement, satisfied or not, for the UI checklist."""

    requirement_id: str
    document_name: str
    requirement_type: Literal["mandatory", "conditional"]
    state: RequirementState
    condition: Optional[str] = None
    authority: str
    acquisition: Optional[AcquisitionGuide] = None


class RuleSummary(BaseModel):
    """Counts the risk model consumes, and the checklist header shows."""

    required_document_count: int
    submitted_document_count: int
    missing_document_count: int
    document_mismatch_count: int
    expired_document_count: int
    unverified_document_count: int
    manual_review_count: int
    conditional_clearance_required: bool
    conditional_clearance_submitted: bool


class MlPrediction(BaseModel):
    risk_level: RiskLevel
    probabilities: dict[str, float]
    model_version: str
    model_type: Literal["synthetic_prototype"] = "synthetic_prototype"
    disclaimer: str = (
        "Trained on synthetic scenarios. Not a prediction of a government "
        "approval or rejection decision."
    )


class AssessmentResult(BaseModel):
    assessment_id: str
    project_id: Optional[int] = None
    application_type: ApplicationType
    jurisdiction: str
    assessment_status: AssessmentStatus
    summary: RuleSummary
    requirements: list[RequirementOutcome]
    rule_based_findings: list[RuleFinding]
    ml_prediction: Optional[MlPrediction] = None
    ml_available: bool = True
    ml_unavailable_reason: Optional[str] = None
    recommended_actions: list[str] = Field(default_factory=list)
    application_procedure: list[ProcedureStep] = Field(
        default_factory=list,
        description="Sourced steps for lodging this application type",
    )
    acquisition_coverage: dict[str, int] = Field(
        default_factory=dict,
        description=(
            "How many issuing authorities publish a procedure at all. The "
            "shortfall is a gap in published regulatory information, not in "
            "this system."
        ),
    )
    official_approval: Literal[False] = False
    generated_at: str


class RequirementsResponse(BaseModel):
    """The checklist for an application type, before anything is uploaded."""

    application_type: ApplicationType
    requirements: list[RequirementOutcome]
    condition_keys: list[str] = Field(
        ..., description="Flags the caller may supply in context{}"
    )
