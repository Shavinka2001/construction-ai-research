"""
How to obtain each required document, and where that is not published.

The checklist answers "what do I need". This answers the question that follows,
which for most applicants is the harder one: "where do I get it".

The honest finding is that mostly nobody says. Of the six authorities that
issue documents on the UDA list, one publishes how to apply. For the other
five there is no published procedure to point at, so this module returns
``publication_status="not_published"`` with the authority to contact, rather
than inventing a plausible-sounding set of steps. A fabricated procedure would
be worse than a blank: it reads as authoritative and it is not traceable to
anything.

That blank is the component's research finding rendered as product. The
publication survey measured that 2 of 16 local authorities publish a document
checklist; this is the same gap one level down.

Two datasets, both traceable:
    data/authority_guide.csv       — per issuing authority
    data/application_procedure.csv — per application type, from the UDA source
"""

from __future__ import annotations

import csv
import logging
import threading
from dataclasses import dataclass
from typing import Literal, Optional

from app.core.config import BASE_DIR

logger = logging.getLogger(__name__)

AUTHORITY_PATH = BASE_DIR / "data" / "authority_guide.csv"
PROCEDURE_PATH = BASE_DIR / "data" / "application_procedure.csv"

PublicationStatus = Literal["published", "not_published"]


@dataclass(frozen=True)
class AuthorityGuide:
    authority: str
    publication_status: PublicationStatus
    how_to_obtain: Optional[str]
    obtain_url: Optional[str]
    source_url: Optional[str]
    source_section: Optional[str]
    note: Optional[str]


@dataclass(frozen=True)
class ProcedureStep:
    step_order: int
    step: str
    source_url: Optional[str]
    source_section: Optional[str]


_authorities: Optional[dict[str, AuthorityGuide]] = None
_procedures: Optional[dict[str, list[ProcedureStep]]] = None
_lock = threading.Lock()


def _load() -> tuple[dict[str, AuthorityGuide], dict[str, list[ProcedureStep]]]:
    global _authorities, _procedures
    if _authorities is not None and _procedures is not None:
        return _authorities, _procedures

    with _lock:
        if _authorities is not None and _procedures is not None:
            return _authorities, _procedures

        authorities: dict[str, AuthorityGuide] = {}
        if AUTHORITY_PATH.is_file():
            with AUTHORITY_PATH.open(newline="", encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    name = (row.get("authority") or "").strip()
                    if not name:
                        continue
                    status = (row.get("publication_status") or "").strip().lower()
                    if status not in ("published", "not_published"):
                        logger.warning("authority %r: bad publication_status %r", name, status)
                        continue
                    steps = (row.get("how_to_obtain") or "").strip() or None
                    if status == "published" and not steps:
                        logger.warning("authority %r: marked published with no steps", name)
                        status = "not_published"
                    authorities[name] = AuthorityGuide(
                        authority=name,
                        publication_status=status,  # type: ignore[arg-type]
                        how_to_obtain=steps,
                        obtain_url=(row.get("obtain_url") or "").strip() or None,
                        source_url=(row.get("source_url") or "").strip() or None,
                        source_section=(row.get("source_section") or "").strip() or None,
                        note=(row.get("note") or "").strip() or None,
                    )
        else:
            logger.error("authority guide not found at %s", AUTHORITY_PATH)

        procedures: dict[str, list[ProcedureStep]] = {}
        if PROCEDURE_PATH.is_file():
            with PROCEDURE_PATH.open(newline="", encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    app_type = (row.get("application_type") or "").strip().lower()
                    text = (row.get("step") or "").strip()
                    if not app_type or not text:
                        continue
                    try:
                        order = int(row.get("step_order") or 0)
                    except ValueError:
                        order = 0
                    procedures.setdefault(app_type, []).append(
                        ProcedureStep(
                            step_order=order,
                            step=text,
                            source_url=(row.get("source_url") or "").strip() or None,
                            source_section=(row.get("source_section") or "").strip() or None,
                        )
                    )
            for steps in procedures.values():
                steps.sort(key=lambda s: s.step_order)
        else:
            logger.error("application procedure not found at %s", PROCEDURE_PATH)

        published = sum(1 for a in authorities.values() if a.publication_status == "published")
        logger.info(
            "acquisition guide: %d authorities (%d publish a procedure), %d application types",
            len(authorities),
            published,
            len(procedures),
        )
        _authorities, _procedures = authorities, procedures
        return _authorities, _procedures


def for_authority(authority: str) -> Optional[AuthorityGuide]:
    """Guidance for one issuing authority, or ``None`` if it is not on record."""
    authorities, _ = _load()
    return authorities.get((authority or "").strip())


def procedure_for(application_type: str) -> list[ProcedureStep]:
    """The sourced steps for lodging this application type."""
    _, procedures = _load()
    return procedures.get((application_type or "").strip().lower(), [])


def publication_summary() -> dict[str, int]:
    """How many issuing authorities publish a procedure. The finding, in two numbers."""
    authorities, _ = _load()
    published = sum(1 for a in authorities.values() if a.publication_status == "published")
    return {"authorities": len(authorities), "publish_a_procedure": published}
