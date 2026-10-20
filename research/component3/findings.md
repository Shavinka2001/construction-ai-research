# Component 3 — research findings

Three results, in the order they would be defended. Each is reproducible from a
script in this directory.

---

## 1. The gap: published requirements do not resolve to a jurisdiction

The Urban Development Authority publishes what a development permit needs, as
prose, at national level. What is not published in any resolvable form is
**whether a given requirement applies to a given site under a given local
authority**.

The clearest instance is in the dataset. `REQ-BP-010`, the Street Line /
Building Line Certificate, carries the official condition:

> "If the proposed building is situated in CMC area"

CMC is the Colombo Municipal Council. For a site in Matara the condition is
clear prose and completely undecidable: it names a different local authority,
and no published source states the Matara equivalent. The same applies to
`REQ-BP-011`.

This is not a shortcoming of the extraction. It is a property of how the
requirements are published, and it is what stops an applicant knowing what their
particular application needs before they submit it. The UDA One Stop Unit
digitises the *submission*; it does not digitise the *applicability decision*.

**Why this matters for the system.** Most compliance checkers would resolve an
unknown condition to false and report the requirement as not applicable, or to
true and report it as missing. Both are wrong, and both are confidently wrong.

---

## 2. Measuring the gap: condition resolvability coverage

Reproduce: `python research/component3/05_condition_coverage.py`

Each `condition_key` is attributed to the data source that could settle it:
a field the system could capture at project creation (`project_record`), a fact
the document-verification module could extract (`document_ocr`), a site
classification the zoning module could supply (`geospatial`), or nothing the
system can hold (`local_authority`).

| | Building Permit (22 reqs) | Certificate of Conformity (12 reqs) |
| --- | --- | --- |
| Decidable today | 8 — **36%** | 2 — **17%** |
| Project-record fields would add | 9 | 10 |
| Document OCR would add | 2 | — |
| Geospatial module would add | 1 | — |
| **All modules integrated** | **91%** | **100%** |
| **Never decidable by the system** | **2 (9%)** | 0 |

Three things follow.

**Most of the gap is engineering, not regulation.** Building-permit coverage
goes from 36% to 77% on project-record fields alone — building use, tenure,
activity type, whether a PPC exists. That is a form and a migration, not
research. The single highest-value field is building use, which gates the
five-clearance group for non-residential buildings and apartments.

**The metric is an integration roadmap.** It states what each unbuilt module
buys, in requirements, which is a more useful thing to hand the rest of the team
than a model accuracy figure.

**9% of the building-permit checklist is not reachable by any amount of
engineering.** Those two requirements need a local authority to say what the
Matara condition is. That residue is the regulatory gap, and it is the number
this component exists to put a figure on.

**Design consequence.** The rule engine treats an unresolvable condition as a
third outcome — `manual_review` — carrying the official condition text, the
requirement id and the source link, rather than guessing. Abstention is a
reportable result, not a failure.

---

## 3. Synthetic labels: what the obvious policy would have reported

Reproduce: `python research/component3/04_labelling_ablation.py`

No historical approved/rejected/rework outcomes are published for Sri Lankan
building approvals, so training cases are generated. The risk is that a
generated label becomes a deterministic function of the features the model is
given, in which case the model recovers the generator's own formula and the
reported accuracy measures nothing.

Two datasets, identical except in how the label is produced. The naive policy
cuts the weighted evidence at its terciles. The adopted policy withholds three
latent factors from the features and samples labels from class probabilities;
it is documented in `labelling_policy.md`.

Macro F1 on a held-out, template-grouped split:

| Labelling policy | Rule baseline | Logistic | Forest | Unrestricted forest |
| --- | --- | --- | --- | --- |
| Naive (deterministic) | 0.706 | 0.917 | 0.886 | **0.920** |
| Adopted (latent + sampled) | 0.609 | 0.653 | 0.607 | **0.602** |

The last column is the diagnostic. Under the naive policy extra capacity keeps
paying — 0.886 to 0.920 — because the label is a formula waiting to be
recovered. Under the adopted policy extra capacity buys nothing at all, 0.607 to
0.602, because the withheld factors leave irreducible uncertainty.

So: had the obvious policy been used, this component would have reported **0.92
macro F1**. That number would have described the generator. The reported **0.65**
is lower and means more, and the gap between the two columns is the evidence for
saying so.

---

## What is claimed, and what is not

Claimed:

- The requirements dataset is traceable. Every row carries an official
  `source_url`, `source_section` and the date the source was read.
- The rule engine's findings are deterministic and auditable against that
  dataset.
- The coverage figures above describe the published regulations as of
  2026-10-20.

Not claimed:

- That the requirements apply in Matara. `verified_date` records that the UDA
  source was read on that date, not that a local authority confirmed
  applicability. Sources S1 and S2 in `source_register.md` close that gap and
  are still open.
- Any accuracy against real approval or rework outcomes. The labels are
  generated; the metrics measure how learnable the documented policy is.
- That the system approves anything. `official_approval` is always false.
