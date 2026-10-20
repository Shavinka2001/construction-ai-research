"""
Turn a project's stored attributes into condition flags for the rule engine.

The rule engine asks one question of every conditional requirement: does this
apply? It accepts three answers — yes, no, and "cannot tell" — and the third
is the one that has to be protected. A project attribute nobody filled in is
unknown, not false, so this function **omits** the key rather than emitting
``False`` for it. The requirement then comes back as manual review with its
official condition text, which is correct and useful, instead of silently
disappearing from the checklist.

That is why every branch below is guarded on the attribute being present. A
missing guard would convert an unanswered question into a confident "not
required", which is the failure this component exists to avoid.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.models.project import Project
from app.models.project_attributes import (
    ApplicantType,
    BuildingUse,
    DevelopmentActivity,
    TenureType,
)

logger = logging.getLogger(__name__)

#: Condition keys this function can settle, given a fully populated project.
#: Kept in sync with research/component3/05_condition_coverage.py.
DERIVABLE_KEYS: frozenset[str] = frozenset(
    {
        "non_residential_or_apartment",
        "is_condominium",
        "applicant_is_organization",
        "ppc_available",
        "declarations_applicable",
        "activity_is_building_construction",
        "activity_is_land_subdivision",
    }
)


def _value(raw: Optional[str], enum_cls) -> Optional[object]:
    """Parse a stored string into its enum, or ``None`` if it is unusable."""
    if raw is None:
        return None
    try:
        return enum_cls(raw)
    except ValueError:
        logger.warning(
            "project attribute %r is not a valid %s — treating as unknown",
            raw,
            enum_cls.__name__,
        )
        return None


def derive_context(project: Project) -> dict[str, bool]:
    """
    Condition flags implied by this project's attributes.

    Only keys the project actually settles are present. Everything else is
    left out so the rule engine reports it as manual review.
    """
    context: dict[str, bool] = {}

    use = _value(project.building_use, BuildingUse)
    if use is not None:
        context["non_residential_or_apartment"] = use in (
            BuildingUse.NON_RESIDENTIAL,
            BuildingUse.APARTMENT,
        )

    tenure = _value(project.tenure_type, TenureType)
    if tenure is not None:
        context["is_condominium"] = tenure is TenureType.CONDOMINIUM

    applicant = _value(project.applicant_type, ApplicantType)
    if applicant is not None:
        context["applicant_is_organization"] = (
            applicant is ApplicantType.ORGANIZATION
        )
        # The declaration forms are filed by the applicant, the owner and any
        # qualified persons. Knowing who is applying is enough to settle that
        # they apply; the source's "(if applicable)" governs which parties
        # sign, not whether the requirement exists.
        context["declarations_applicable"] = True

    if project.has_ppc is not None:
        context["ppc_available"] = bool(project.has_ppc)

    activity = _value(project.development_activity, DevelopmentActivity)
    if activity is not None:
        context["activity_is_building_construction"] = (
            activity is DevelopmentActivity.BUILDING_CONSTRUCTION
        )
        context["activity_is_land_subdivision"] = (
            activity is DevelopmentActivity.LAND_SUBDIVISION
        )

    return context


def merge_context(
    derived: dict[str, bool], explicit: dict[str, bool]
) -> dict[str, bool]:
    """
    Combine project-derived flags with flags the caller passed in.

    The caller wins. A request can correct a stale project attribute without
    having to update the project first, and an upstream module that resolves a
    condition the project cannot — a zoning classification, say — can supply it
    directly.
    """
    return {**derived, **explicit}
