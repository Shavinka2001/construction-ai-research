"""
Map whatever a caller calls a document onto the requirement it satisfies.

Uploads arrive labelled by people and by the OCR module, so the same document
turns up as ``survey_plan``, ``Survey Plan``, ``approved survey plan`` and
``Approved Survey Plan``. Matching has to be forgiving about that without
becoming so loose that one upload silently satisfies the wrong requirement.

Three passes, each stricter than the next is forgiving:

1. exact match on the normalised requirement name;
2. a curated alias table, for names that normalisation alone will not join;
3. containment, only when exactly one requirement matches, so an ambiguous
   label is left unmatched rather than guessed.
"""

from __future__ import annotations

import re
from typing import Iterable, Optional

from app.services.submission_readiness.requirements_repo import Requirement

#: Words that carry no distinguishing meaning in a document name.
_NOISE = {"a", "an", "the", "of", "for", "and", "or", "copy", "scanned", "pdf", "version"}

#: Alias -> the exact ``document_name`` in the requirements dataset.
#: Keys are normalised; add to this table rather than loosening the matcher.
ALIASES: dict[str, str] = {
    "survey plan": "Approved Survey Plan",
    "approved survey plan": "Approved Survey Plan",
    "subdivision plan": "Approved Subdivision Plan",
    "building plan": "Approved Building Plan",
    "building drawings": "Drawings of the proposed building (04 hard copies signed by Applicant, Chartered Engineer and Chartered Architect)",
    "drawings": "Drawings of the proposed building (04 hard copies signed by Applicant, Chartered Engineer and Chartered Architect)",
    "architectural drawings": "Drawings of the proposed building (04 hard copies signed by Applicant, Chartered Engineer and Chartered Architect)",
    "deed": "Deed or title certificate",
    "title deed": "Deed or title certificate",
    "title certificate": "Deed or title certificate",
    "nic": "National Identity Card or Passport",
    "national identity card": "National Identity Card or Passport",
    "passport": "National Identity Card or Passport",
    "id": "National Identity Card or Passport",
    "payment slip": "Payment slip",
    "rates receipt": "Payment receipt of rates for the relevant year",
    "rates payment receipt": "Payment receipt of rates for the relevant year",
    "e application": "Duly filled e-application",
    "application form": "Duly filled e-application",
    "location sketch": "Sketch or Google Map image indicating the location of the land",
    "google map": "Sketch or Google Map image indicating the location of the land",
    "street line certificate": "Street Line / Building Line Certificate",
    "building line certificate": "Street Line / Building Line Certificate",
    "ppc": "Preliminary Planning Clearance (PPC)",
    "preliminary planning clearance": "Preliminary Planning Clearance (PPC)",
    "power of attorney": "Power of Attorney",
    "poa": "Power of Attorney",
    "business registration": "Business Registration Certificate",
    "fire certificate": "Fire Certificate",
    "ceb clearance": "Clearance from Ceylon Electricity Board",
    "electricity clearance": "Clearance from Ceylon Electricity Board",
    "water clearance": "Clearance from National Water Supply & Drainage Board",
    "nwsdb clearance": "Clearance from National Water Supply & Drainage Board",
    "development permit": "Development Permit",
    "building permit": "Development Permit",
    "condition letter": "Condition Letter",
    "surveyor plan": "Surveyor Plan",
    "declaration forms": "Declaration forms by Applicant/s, Owner/s and Qualified persons",
}


def normalise(name: str) -> str:
    """Lower-case, strip punctuation and noise words, collapse whitespace."""
    text = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower())
    words = [w for w in text.split() if w and w not in _NOISE]
    return " ".join(words)


def match(label: str, requirements: Iterable[Requirement]) -> Optional[Requirement]:
    """
    Find the requirement an uploaded document satisfies, or ``None``.

    ``None`` means "could not tell", never "does not count": the caller reports
    it as an unrecognised upload rather than discarding it.
    """
    target = normalise(label)
    if not target:
        return None

    candidates = list(requirements)

    # 1. Exact match on the normalised official name.
    for requirement in candidates:
        if normalise(requirement.document_name) == target:
            return requirement

    # 2. Curated alias.
    alias = ALIASES.get(target)
    if alias:
        wanted = normalise(alias)
        for requirement in candidates:
            if normalise(requirement.document_name) == wanted:
                return requirement

    # 3. Containment, only when it is unambiguous.
    hits = [
        r
        for r in candidates
        if target in normalise(r.document_name) or normalise(r.document_name) in target
    ]
    if len(hits) == 1:
        return hits[0]

    return None
