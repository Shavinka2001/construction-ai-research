# Official source register — Component 3 requirements dataset

Every row in `backend/data/uda_requirements.csv` must trace to a source listed
here. A row without a source that a panel member can open is worse than no row:
it turns the whole traceability claim into a liability.

**Scope:** Building Permit and Certificate of Conformity, Matara jurisdiction.
Target size is 14–18 requirements across both types. Quality over count.

## What `verified_date` means here

All 34 rows carry `2026-10-20`. That date records one specific thing: the UDA
source document was opened on that date and the requirement text was extracted
from it, so the wording in the dataset matches the wording in the source.

It does **not** record that the requirement applies in Matara. That is a
separate claim and it is still outstanding. Two things in particular:

- `REQ-BP-010` and `REQ-BP-011` carry the condition "If the proposed building is
  situated in CMC area", which is Colombo Municipal Council. Matara needs its
  own equivalent condition, or these two rows need removing for this
  jurisdiction.
- The UDA list applies to declared urban development areas. Whether Matara
  Municipal Council or the relevant Pradeshiya Sabha adds local requirements on
  top is not established by this source.

So the dataset is traceable and its wording is faithful, and the validator
passes on that basis. Sources S1 and S2 below — the Matara application forms —
close the applicability gap, and they are the two still unticked.

## Status

| # | Source | Type | Covers | Collected | Verified on |
| --- | --- | --- | --- | --- | --- |
| S1 | Matara MC/PS building permit application form | Primary | Building Permit checklist | ☐ | |
| S2 | Matara MC/PS CoC application form | Primary | CoC checklist | ☐ | |
| S3 | [UDA Development Approval Process (PDF)](https://www.uda.gov.lk/attachments/help/Instructions%20Webpage-%20PDF.pdf) | Primary | All 34 rows currently in the dataset | ☑ | 2026-10-20 |
| S4 | [UDA One Stop Unit guidelines](https://osu.uda.lk/Guidelines.aspx?n=1) | Secondary | Cross-check of the same list | ☑ | 2026-10-20 |
| S5 | [UDA Planning & Development Regulations](https://www.uda.gov.lk/upload/attach/Planning%20and%20Development%20Regulations.pdf) | Primary | Statutory basis, section numbers | ☐ | |
| S6 | NBRO clearance requirement (conditional trigger) | Primary | When landslide clearance applies | ☐ | |

S3 is where every current row came from. The two sections used are
"What Are the Information Required for Applying for Development Permit?" and
"What are the information required to apply for a Certificate of Conformity?",
and both are recorded in each row's `source_section`.

S1, S2, S5 and S6 are still open. Regulations change, so re-check S3 and S4 and
move their dates forward rather than trusting this entry indefinitely.

## How to collect, best method first

1. **Get the application form itself.** The building permit application form
   issued by Matara Municipal Council or the relevant Pradeshiya Sabha carries
   the required-document checklist printed on the form. Photograph or scan it.
   This is a primary source, it is citable, and it is the single highest-value
   afternoon of work on this component. Do the same for the CoC form.
2. **UDA One Stop Unit.** The online application flow lists document
   requirements per application type. Screenshot the step that lists them and
   note the date.
3. **The Planning & Development Regulations.** Where a requirement has a
   statutory basis, cite the gazette section number, not a summary page. This is
   what makes `source_section` meaningful.
4. **Ask at the counter.** Students are routinely given the checklist on
   request. Say it is for a university research project. Note who you spoke to
   and when; an interview is a legitimate source if it is recorded as one.

## Recording a source

For each source keep, in `backend/data/sources/`:

- the scan, screenshot or photograph
- the URL if it has one, and the date you opened it
- for a document, its title and issuing body exactly as printed

A screenshot with no date is not a source. A search-result snippet is not a
source — open the actual page.

## Conditional requirements

These matter more than the mandatory ones, because they are what the rule engine
has to reason about rather than just tick off. For each one, record the exact
condition text that triggers it, not a paraphrase:

- NBRO clearance — which zones or slope conditions trigger it
- Street line / building line certificate — when required
- CEA or environmental clearance — thresholds that trigger it
- Drainage or sewerage approval — when it applies

Where the trigger condition cannot be resolved from the source text, that is a
finding, not a gap: the engine flags such cases **Manual Review Required**, and
the report should say which conditions could not be resolved automatically.

## Definition of done

`python research/component3/03_validate_requirements.py` passes with no errors,
which requires every row to carry a non-empty `source_url` or `source_section`,
a `verified_date` within the last 12 months, and a valid `requirement_type`.
