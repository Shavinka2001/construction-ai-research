"""
Project attributes that decide which approval requirements apply.

Each of these settles one or more `condition_key` values in
``data/uda_requirements.csv``. They are captured once, when the project is
created, instead of being asked again at every assessment.

Every one is optional on the model. An attribute nobody has filled in is
*unknown*, and the rule engine reports its requirements as manual review
rather than assuming they do not apply — see
``services/submission_readiness/project_context.py``.
"""

from enum import Enum


class ApplicationType(str, Enum):
    """Which approval the project is working towards."""

    BUILDING_PERMIT = "building_permit"
    COC = "coc"


class BuildingUse(str, Enum):
    """
    Settles ``non_residential_or_apartment``.

    This is the highest-value attribute on the list: it gates the five-clearance
    group (fire, electricity, water, solid waste, sewerage) that UDA requires of
    non-residential buildings and apartments.
    """

    RESIDENTIAL = "residential"
    NON_RESIDENTIAL = "non_residential"
    APARTMENT = "apartment"


class TenureType(str, Enum):
    """Settles ``is_condominium``."""

    FREEHOLD = "freehold"
    CONDOMINIUM = "condominium"


class ApplicantType(str, Enum):
    """Settles ``applicant_is_organization``."""

    INDIVIDUAL = "individual"
    ORGANIZATION = "organization"


class DevelopmentActivity(str, Enum):
    """
    Settles ``activity_is_building_construction`` and
    ``activity_is_land_subdivision``, which between them decide nine of the
    twelve Certificate of Conformity requirements.
    """

    BUILDING_CONSTRUCTION = "building_construction"
    LAND_SUBDIVISION = "land_subdivision"
