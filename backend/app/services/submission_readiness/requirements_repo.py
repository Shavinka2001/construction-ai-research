"""
Load the official requirements dataset and answer questions about it.

``data/uda_requirements.csv`` is the regulatory knowledge base: one row per
required document, each carrying the official source it was read from. It is
read once and cached, because it changes only when someone re-verifies a source.

Rows that fail the traceability rules are dropped rather than trusted, and the
reason is logged. A requirement the system cannot point at a source for should
not be telling a user their application is incomplete.
"""

from __future__ import annotations

import csv
import logging
import threading
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal, Optional

from app.core.config import BASE_DIR

logger = logging.getLogger(__name__)

REQUIREMENTS_PATH = BASE_DIR / "data" / "uda_requirements.csv"

RequirementType = Literal["mandatory", "conditional"]

SUPPORTED_APPLICATION_TYPES: frozenset[str] = frozenset({"building_permit", "coc"})

#: Requirements whose absence means the applicant must obtain a clearance from
#: another authority, as opposed to producing a document they already hold.
#: The risk model carries these as a separate feature.
CLEARANCE_KEYS: frozenset[str] = frozenset(
    {
        "non_residential_or_apartment",
        "is_condominium",
        "ppc_specifies_clearances",
        "in_cmc_area",
    }
)


@dataclass(frozen=True)
class Requirement:
    requirement_id: str
    application_type: str
    document_name: str
    requirement_type: RequirementType
    condition: Optional[str]
    condition_key: Optional[str]
    authority: str
    source_url: Optional[str]
    source_section: Optional[str]
    verified_date: Optional[date]

    @property
    def is_clearance(self) -> bool:
        return bool(self.condition_key and self.condition_key in CLEARANCE_KEYS)


_cache: Optional[list[Requirement]] = None
_lock = threading.Lock()


def _parse_row(row: dict[str, str], line: int) -> Optional[Requirement]:
    rid = (row.get("requirement_id") or "").strip()
    app_type = (row.get("application_type") or "").strip().lower()
    doc = (row.get("document_name") or "").strip()
    req_type = (row.get("requirement_type") or "").strip().lower()
    key = (row.get("condition_key") or "").strip() or None

    if not rid or not doc:
        logger.warning("requirements line %d: missing id or document name, skipped", line)
        return None
    if app_type not in SUPPORTED_APPLICATION_TYPES:
        logger.warning("requirements line %d (%s): unsupported type %r, skipped", line, rid, app_type)
        return None
    if req_type not in ("mandatory", "conditional"):
        logger.warning("requirements line %d (%s): bad requirement_type %r, skipped", line, rid, req_type)
        return None
    if req_type == "conditional" and not key:
        logger.warning(
            "requirements line %d (%s): conditional with no condition_key, skipped", line, rid
        )
        return None

    url = (row.get("source_url") or "").strip() or None
    section = (row.get("source_section") or "").strip() or None
    if not url and not section:
        logger.warning("requirements line %d (%s): untraceable, skipped", line, rid)
        return None

    verified: Optional[date] = None
    raw_date = (row.get("verified_date") or "").strip()
    if raw_date:
        try:
            verified = datetime.strptime(raw_date, "%Y-%m-%d").date()
        except ValueError:
            logger.warning("requirements line %d (%s): bad verified_date %r", line, rid, raw_date)

    return Requirement(
        requirement_id=rid,
        application_type=app_type,
        document_name=doc,
        requirement_type=req_type,  # type: ignore[arg-type]
        condition=(row.get("condition") or "").strip() or None,
        condition_key=key,
        authority=(row.get("authority") or "").strip() or "Unknown authority",
        source_url=url,
        source_section=section,
        verified_date=verified,
    )


def load_requirements(force_reload: bool = False) -> list[Requirement]:
    """Read and cache the dataset. Safe to call from any request."""
    global _cache
    if _cache is not None and not force_reload:
        return _cache

    with _lock:
        if _cache is not None and not force_reload:
            return _cache

        if not REQUIREMENTS_PATH.is_file():
            logger.error("requirements dataset not found at %s", REQUIREMENTS_PATH)
            _cache = []
            return _cache

        parsed: list[Requirement] = []
        with REQUIREMENTS_PATH.open(newline="", encoding="utf-8") as fh:
            for line, row in enumerate(csv.DictReader(fh), start=2):
                requirement = _parse_row(row, line)
                if requirement is not None:
                    parsed.append(requirement)

        unverified = sum(1 for r in parsed if r.verified_date is None)
        if unverified:
            logger.warning(
                "%d of %d requirements have no verified_date — they are still "
                "candidates and should not be presented as confirmed",
                unverified,
                len(parsed),
            )

        logger.info("loaded %d requirements from %s", len(parsed), REQUIREMENTS_PATH)
        _cache = parsed
        return _cache


def for_application_type(application_type: str) -> list[Requirement]:
    """Every requirement on record for one application type."""
    wanted = application_type.strip().lower()
    return [r for r in load_requirements() if r.application_type == wanted]


def condition_keys(application_type: Optional[str] = None) -> list[str]:
    """The condition flags a caller may supply in ``context``."""
    rows = for_application_type(application_type) if application_type else load_requirements()
    return sorted({r.condition_key for r in rows if r.condition_key})


def is_supported(application_type: str) -> bool:
    """Whether the dataset actually carries rules for this application type."""
    return bool(for_application_type(application_type))
