"""
Condition flags that follow from where the site is.

Some official conditions are geographic. The UDA development permit list
carries two requirements gated on "If the proposed building is situated in CMC
area" — the Colombo Municipal Council area. That is decidable the moment the
jurisdiction is known, and treating it as unresolvable was a misreading: the
question "does this UDA condition apply here?" has an answer, even where the
separate question "does the local authority add requirements of its own?" does
not.

Scope note. UDA administers development approvals directly in declared urban
development areas: the powers it had delegated to local authorities were partly
taken back with effect from 1 February 2017, and applications are made to a UDA
Provincial or District Office. The requirements dataset is therefore the
applicable list for a site in a declared urban area, which is the scope this
component claims. What it does not establish is whether an authority operating
outside that arrangement adds requirements on top — a question of the list's
*completeness*, not of resolving these conditions.

Source: UDA, "Development Approval Process in Declared Urban Areas",
https://www.uda.gov.lk/attachments/help/Instructions%20Webpage-%20PDF.pdf
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

#: Condition keys this module settles from the jurisdiction alone.
DERIVABLE_KEYS: frozenset[str] = frozenset({"in_cmc_area"})

#: Jurisdiction values that denote the Colombo Municipal Council area. Kept as
#: a set rather than a single string because the field is free text and callers
#: spell it differently.
_CMC_JURISDICTIONS: frozenset[str] = frozenset(
    {"colombo", "cmc", "colombo_mc", "colombo-mc", "colombo municipal council"}
)


def derive_context(jurisdiction: str | None) -> dict[str, bool]:
    """
    Flags implied by the site's jurisdiction.

    An empty or unrecognised jurisdiction yields no flag, so the requirement
    falls back to manual review rather than being assumed not to apply. Only a
    jurisdiction we actually recognise produces an answer.
    """
    if not jurisdiction:
        return {}

    normalised = jurisdiction.strip().lower().replace("_", " ").replace("-", " ")
    normalised = " ".join(normalised.split())

    if normalised in {j.replace("_", " ").replace("-", " ") for j in _CMC_JURISDICTIONS}:
        return {"in_cmc_area": True}

    # A named jurisdiction that is not Colombo settles the condition as false.
    # This is the common case and the reason these two requirements are
    # decidable at all.
    return {"in_cmc_area": False}
