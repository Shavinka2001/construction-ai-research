"""
Component 3 behaviour tests.

These follow the test table in the component specification. The awkward cases
carry the weight: an unresolvable condition must not be reported as a missing
document, an unverified document must not pass as authentic, and the rule
findings must survive the risk model being unavailable.
"""

from __future__ import annotations

import pytest

from app.schemas.submission_readiness import AssessmentRequest, SubmittedDocument
from app.services.submission_readiness import risk_model
from app.services.submission_readiness.assessment import assess_application
from app.services.submission_readiness.requirements_repo import (
    condition_keys,
    for_application_type,
)

BUILDING_PERMIT_MANDATORY = [
    "Duly filled e-application",
    "Payment slip",
    "Drawings of the proposed building (04 hard copies signed by Applicant, Chartered Engineer and Chartered Architect)",
    "Approved Subdivision Plan",
    "Deed or title certificate",
    "National Identity Card or Passport",
    "Payment receipt of rates for the relevant year",
    "Sketch or Google Map image indicating the location of the land",
]


def all_conditions_false() -> dict[str, bool]:
    """Every condition resolved, all to 'does not apply'."""
    return {key: False for key in condition_keys("building_permit")}


def verified(names: list[str]) -> list[SubmittedDocument]:
    return [SubmittedDocument(type=n, status="verified") for n in names]


def build(**overrides) -> AssessmentRequest:
    payload = {
        "application_type": "building_permit",
        "jurisdiction": "matara",
        "documents": verified(BUILDING_PERMIT_MANDATORY),
        "context": all_conditions_false(),
    }
    payload.update(overrides)
    return AssessmentRequest(**payload)


def states(result, requirement_id: str) -> str:
    return next(o.state for o in result.requirements if o.requirement_id == requirement_id)


# --------------------------------------------------------------------------- #
# The dataset itself
# --------------------------------------------------------------------------- #
def test_requirements_dataset_loads():
    requirements = for_application_type("building_permit")
    assert len(requirements) >= 8
    assert all(r.source_url or r.source_section for r in requirements), (
        "every requirement must be traceable to an official source"
    )


def test_every_conditional_requirement_has_a_machine_evaluable_key():
    for app_type in ("building_permit", "coc"):
        for requirement in for_application_type(app_type):
            if requirement.requirement_type == "conditional":
                assert requirement.condition_key, requirement.requirement_id


# --------------------------------------------------------------------------- #
# Spec test table
# --------------------------------------------------------------------------- #
def test_all_mandatory_documents_present_raises_no_missing_errors():
    result = assess_application(build())

    assert result is not None
    assert result.summary.missing_document_count == 0
    assert not [f for f in result.rule_based_findings if f.state == "missing"]
    assert result.assessment_status == "ready"
    # Complete paperwork is never an approval.
    assert result.official_approval is False


def test_absent_mandatory_document_is_identified():
    result = assess_application(build(documents=verified(BUILDING_PERMIT_MANDATORY[:-1])))

    assert result is not None
    assert result.summary.missing_document_count == 1
    missing = [f for f in result.rule_based_findings if f.state == "missing"]
    assert len(missing) == 1
    assert missing[0].severity == "blocking"
    assert missing[0].requirement_id
    assert missing[0].corrective_action
    assert result.assessment_status == "incomplete"


def test_applicable_conditional_clearance_missing_raises_an_issue():
    context = all_conditions_false()
    context["non_residential_or_apartment"] = True

    result = assess_application(build(context=context))

    assert result is not None
    assert result.summary.conditional_clearance_required is True
    assert result.summary.conditional_clearance_submitted is False
    clearance_findings = [
        f for f in result.rule_based_findings if f.state == "missing" and f.condition
    ]
    assert clearance_findings, "the five-clearance group should have been raised"
    assert all("Non Residential" in f.condition for f in clearance_findings)


def test_unresolvable_condition_is_manual_review_not_missing():
    # The caller says nothing about whether the site is non-residential.
    context = all_conditions_false()
    del context["non_residential_or_apartment"]

    result = assess_application(build(context=context))

    assert result is not None
    assert result.summary.manual_review_count == 5
    assert result.summary.missing_document_count == 0, (
        "an unknown condition must never be reported as a missing document"
    )
    assert result.assessment_status == "review_required"
    manual = [f for f in result.rule_based_findings if f.state == "manual_review"]
    assert all(f.severity == "attention" for f in manual)


def test_unverified_document_is_not_treated_as_authentic():
    documents = verified(BUILDING_PERMIT_MANDATORY[:-1])
    documents.append(
        SubmittedDocument(type=BUILDING_PERMIT_MANDATORY[-1], status="unverified")
    )

    result = assess_application(build(documents=documents))

    assert result is not None
    assert result.summary.unverified_document_count == 1
    assert result.summary.missing_document_count == 0
    finding = next(f for f in result.rule_based_findings if f.state == "unverified")
    assert finding.severity == "attention"
    assert result.assessment_status == "review_required"


def test_document_mismatch_produces_issue_and_correction():
    documents = verified(BUILDING_PERMIT_MANDATORY[:-1])
    documents.append(
        SubmittedDocument(
            type=BUILDING_PERMIT_MANDATORY[-1], status="needs_review", mismatch_count=1
        )
    )

    result = assess_application(build(documents=documents))

    assert result is not None
    assert result.summary.document_mismatch_count == 1
    finding = next(f for f in result.rule_based_findings if f.state == "needs_review")
    assert "disagree" in finding.issue
    assert finding.corrective_action in result.recommended_actions


def test_expired_document_is_blocking():
    documents = verified(BUILDING_PERMIT_MANDATORY[:-1])
    documents.append(SubmittedDocument(type=BUILDING_PERMIT_MANDATORY[-1], status="expired"))

    result = assess_application(build(documents=documents))

    assert result is not None
    assert result.summary.expired_document_count == 1
    finding = next(f for f in result.rule_based_findings if f.state == "expired")
    assert finding.severity == "blocking"
    assert result.assessment_status == "incomplete"


def test_unsupported_application_type_falls_back_safely():
    request = AssessmentRequest.model_construct(
        project_id=None,
        application_type="subdivision",  # not in the dataset
        jurisdiction="matara",
        documents=[],
        context={},
    )
    assert assess_application(request) is None


def test_rule_findings_survive_the_model_being_unavailable(monkeypatch):
    monkeypatch.setattr(risk_model, "predict", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(risk_model, "unavailable_reason", lambda: "model artifact not found")

    result = assess_application(build(documents=verified(BUILDING_PERMIT_MANDATORY[:-1])))

    assert result is not None
    assert result.ml_available is False
    assert result.ml_unavailable_reason
    assert result.ml_prediction is None
    assert result.rule_based_findings, "rule findings must not depend on the model"
    assert result.summary.missing_document_count == 1


def test_reassessment_uses_the_latest_status():
    before = assess_application(build(documents=verified(BUILDING_PERMIT_MANDATORY[:-1])))
    after = assess_application(build())

    assert before is not None and after is not None
    assert before.summary.missing_document_count == 1
    assert after.summary.missing_document_count == 0
    assert before.assessment_id != after.assessment_id


def test_a_corrected_reupload_supersedes_the_copy_it_replaces():
    documents = verified(BUILDING_PERMIT_MANDATORY)
    documents.append(
        SubmittedDocument(type=BUILDING_PERMIT_MANDATORY[0], status="needs_review", mismatch_count=2)
    )

    result = assess_application(build(documents=documents))

    assert result is not None
    assert result.summary.document_mismatch_count == 0


def test_unrecognised_upload_is_surfaced_not_discarded():
    documents = verified(BUILDING_PERMIT_MANDATORY)
    documents.append(SubmittedDocument(type="holiday photo", status="verified"))

    result = assess_application(build(documents=documents))

    assert result is not None
    assert any("holiday photo" in action for action in result.recommended_actions)


# --------------------------------------------------------------------------- #
# Risk model
# --------------------------------------------------------------------------- #
@pytest.mark.skipif(not risk_model.is_available(), reason="model artifact not built")
def test_model_separates_a_clean_application_from_a_broken_one():
    clean = assess_application(build())
    broken = assess_application(
        build(
            documents=[
                SubmittedDocument(
                    type=BUILDING_PERMIT_MANDATORY[0], status="needs_review", mismatch_count=3
                )
            ]
        )
    )

    assert clean is not None and broken is not None
    assert clean.ml_prediction is not None and broken.ml_prediction is not None
    order = {"low": 0, "medium": 1, "high": 2}
    assert order[broken.ml_prediction.risk_level] > order[clean.ml_prediction.risk_level]


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
def test_assess_requires_authentication(client):
    response = client.post(
        "/api/v1/submission-readiness/assess",
        json={"application_type": "building_permit", "documents": [], "context": {}},
    )
    assert response.status_code == 401


def test_requirements_endpoint_lists_the_checklist(client):
    response = client.get(
        "/api/v1/submission-readiness/requirements",
        params={"application_type": "building_permit"},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert len(data["requirements"]) >= 8
    assert "non_residential_or_apartment" in data["condition_keys"]


def test_requirements_endpoint_rejects_an_unknown_type(client):
    response = client.get(
        "/api/v1/submission-readiness/requirements",
        params={"application_type": "spaceport"},
    )
    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "UNSUPPORTED_APPLICATION_TYPE"


def test_assess_endpoint_returns_an_assessment(client, make_user, auth_headers):
    make_user("owner@example.com")
    response = client.post(
        "/api/v1/submission-readiness/assess",
        headers=auth_headers("owner@example.com"),
        json={
            "application_type": "building_permit",
            "jurisdiction": "matara",
            "documents": [{"type": d, "status": "verified"} for d in BUILDING_PERMIT_MANDATORY],
            "context": all_conditions_false(),
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["assessment_status"] == "ready"
    assert data["official_approval"] is False


def test_assess_rejects_a_project_the_caller_does_not_own(client, make_user, auth_headers):
    make_user("a@example.com")
    response = client.post(
        "/api/v1/submission-readiness/assess",
        headers=auth_headers("a@example.com"),
        json={
            "project_id": 999,
            "application_type": "building_permit",
            "documents": [],
            "context": {},
        },
    )
    assert response.status_code == 404
    assert response.json()["errors"][0]["code"] == "PROJECT_NOT_FOUND"


# --------------------------------------------------------------------------- #
# Project attributes -> condition flags
# --------------------------------------------------------------------------- #
def _project(**attrs):
    from app.models.project import Project

    defaults = {
        "name": "P",
        "user_id": 1,
        "application_type": None,
        "building_use": None,
        "tenure_type": None,
        "applicant_type": None,
        "development_activity": None,
        "has_ppc": None,
    }
    return Project(**{**defaults, **attrs})


def test_an_unset_attribute_yields_no_flag_at_all():
    from app.services.submission_readiness.project_context import derive_context

    # The distinction this whole component rests on: absent, not False.
    assert derive_context(_project()) == {}


def test_building_use_settles_the_clearance_group():
    from app.services.submission_readiness.project_context import derive_context

    assert derive_context(_project(building_use="apartment"))[
        "non_residential_or_apartment"
    ] is True
    assert derive_context(_project(building_use="non_residential"))[
        "non_residential_or_apartment"
    ] is True
    assert derive_context(_project(building_use="residential"))[
        "non_residential_or_apartment"
    ] is False


def test_an_invalid_stored_value_is_treated_as_unknown():
    from app.services.submission_readiness.project_context import derive_context

    # A bad value must not become False, which would silently drop five
    # clearance requirements off the checklist.
    assert "non_residential_or_apartment" not in derive_context(
        _project(building_use="warehouse-ish")
    )


def test_development_activity_settles_both_coc_groups():
    from app.services.submission_readiness.project_context import derive_context

    ctx = derive_context(_project(development_activity="land_subdivision"))
    assert ctx["activity_is_land_subdivision"] is True
    assert ctx["activity_is_building_construction"] is False


def test_explicit_request_flags_override_project_attributes():
    from app.services.submission_readiness.project_context import merge_context

    merged = merge_context({"is_condominium": False}, {"is_condominium": True})
    assert merged["is_condominium"] is True


def test_a_populated_project_removes_manual_reviews(client, make_user, auth_headers):
    from app.models.project import Project

    make_user("owner2@example.com")
    headers = auth_headers("owner2@example.com")

    created = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Matara residence",
            "building_use": "residential",
            "tenure_type": "freehold",
            "applicant_type": "individual",
            "has_ppc": False,
        },
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["data"]["id"]

    def manual_count(body: dict) -> int:
        response = client.post(
            "/api/v1/submission-readiness/assess", headers=headers, json=body
        )
        assert response.status_code == 200, response.text
        return response.json()["data"]["summary"]["manual_review_count"]

    without_project = manual_count(
        {"application_type": "building_permit", "documents": [], "context": {}}
    )
    with_project = manual_count(
        {
            "project_id": project_id,
            "application_type": "building_permit",
            "documents": [],
            "context": {},
        }
    )

    # Building permit has 14 conditional requirements. Four project attributes
    # settle nine of them: building_use decides the five-clearance group,
    # tenure_type decides the condominium clearance, applicant_type decides
    # business registration and the declaration forms, has_ppc decides the PPC.
    # The remaining five need the OCR and geospatial modules, or the local
    # authority in the case of the two CMC-area rows.
    assert without_project == 14
    assert with_project == 5
