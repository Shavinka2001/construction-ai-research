# Component 3 — research findings

Three results, in the order they would be defended. Each is reproducible from a
script in this directory.

---

## 1. The gap: published requirements do not resolve to a jurisdiction

An applicant cannot find out what their application needs before submitting it.
Not because the rules are secret, but because of where they stop.

The Urban Development Authority publishes a document list for development
permits, as prose, at national level. UDA administers approvals directly in
declared urban development areas — the powers it had delegated to local
authorities were partly taken back with effect from 1 February 2017, and
applications go to a UDA Provincial or District Office. So for a site in a
declared urban area, the UDA list **is** the applicable list, and the component
scopes itself there.

Outside that arrangement the applicant is on their own, and that is where the
gap sits. It is a question of the list's **completeness**, not of resolving its
conditions. Section 2 shows every condition resolves given the right inputs;
Section 3 measures whether an applicant can find the list at all.

## 2. Measuring resolvability: condition coverage

Reproduce: `python backend/research/component3/05_condition_coverage.py`

Each `condition_key` is attributed to the data source that could settle it: the
site's jurisdiction, a field the system could capture at project creation, a
fact the document-verification module could extract, or a site classification
the zoning module could supply.

| | Building Permit (22 reqs) | Certificate of Conformity (12 reqs) |
| --- | --- | --- |
| Before this work | 8 — 36% | 2 — 17% |
| **Decidable today** | **19 — 86%** | **12 — 100%** |
| Document OCR would add | 2 | — |
| Geospatial module would add | 1 | — |
| **All modules integrated** | **100%** | **100%** |

Two steps got there. Six optional attributes were added to the project record —
application type, building use, development activity, applicant type, tenure
and whether a PPC exists — and a derivation turns them into condition flags;
that moved building-permit coverage from 36% to 77%. Then the two requirements
gated on "if situated in CMC area" were recognised as geographic and settled
from the site's jurisdiction, which took it to 86%.

**A correction worth recording.** Those two rows were first classified as never
decidable, on the reasoning that no published source gives the Matara
equivalent of the CMC condition. That conflated two questions. *Does this UDA
condition apply to a Matara site?* has an answer — no, Matara is not the CMC
area. *Does Matara add requirements of its own?* does not, and that is the real
gap. Separating them moved the finding from Section 2 to Section 3, where it is
measured properly.

**The coverage metric is an integration roadmap.** It states what each unbuilt
module buys, in requirements, which is a more useful thing to hand the rest of
the team than a model accuracy figure.

**Design consequence.** The rule engine treats an unresolvable condition as a
third outcome — `manual_review` — carrying the condition text, the requirement
id and the source link, rather than guessing. Flags are omitted rather than
defaulted to `false`: a default would raise the coverage figure while making the
system confidently wrong. A test asserts the empty case.

## 3. Measuring the real gap: who publishes a checklist at all

Reproduce: `python backend/research/component3/06_publication_survey.py`

Sixteen local authorities across seven provinces, the sample fixed before
searching. For each: does it publish, anywhere on the open web, a list of the
documents a building permit application requires? A page naming the service,
giving an office address or listing fees does not count.

| | Sampled | Publish a checklist | Share |
| --- | --- | --- | --- |
| Municipal Councils | 12 | 1 | **8%** |
| Urban Councils | 2 | 0 | 0% |
| Pradeshiya Sabhas | 2 | 1 | 50% |
| **All** | **16** | **2** | **12%** |

The two that publish are Colombo Municipal Council, whose building-application
page lists the legal documents required, and Akmeemana Pradeshiya Sabha, whose
citizen-services PDF lists four certified copies of the building plan, two
copies of the approved survey plan and two copies of the land deed. Both were
opened and read, not inferred from a search snippet.

Matara Municipal Council does not publish one. Neither do Kandy, Galle,
Negombo, Jaffna, Kurunegala, Batticaloa, Gampaha or Anuradhapura.

The Local Government Department's own portal is the sharpest illustration. Its
per-authority service pages carry a fee schedule for the building permit
service and then say: *"No online application or forms available at the moment.
Please visit our office."* What it costs is published. What to bring is not.

**What this means.** Where an authority does not publish its checklist, no
automated pre-submission checker can be built for that jurisdiction — not by
this project and not by anyone, because the input does not exist in public. For
88% of the sample, the obstacle is the provision of regulatory information
rather than any engineering problem.

**Honest limits.** Sixteen authorities is a pilot, not a census; Sri Lanka has
roughly 340 local authorities. A result of "no" records no evidence of
publication found by open-web search, never proof of absence — a checklist may
sit on a noticeboard, in a Sinhala or Tamil document a search does not reach, or
behind a form handed out at a counter. The protocol and the per-authority
evidence are in `publication_survey.csv` so the sample can be extended or
challenged.

## 4. Synthetic labels: what the obvious policy would have reported

Reproduce: `python backend/research/component3/04_labelling_ablation.py`

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
- The rule engine's findings are deterministic and auditable against it.
- The coverage figures describe the published UDA requirements as of
  2026-10-20, for sites in declared urban development areas.
- The publication figures describe 16 named authorities as searched on
  2026-10-21, under the protocol in `06_publication_survey.py`.

Not claimed:

- That the UDA list is complete for a site under an authority operating
  outside the UDA arrangement. That is the open question, and Section 3
  measures how often an applicant could even find out.
- That an authority recorded as not publishing has no checklist. It records no
  evidence found by open-web search.
- Any accuracy against real approval or rework outcomes. The labels are
  generated; the metrics measure how learnable the documented policy is.
- That the system approves anything. `official_approval` is always false.
