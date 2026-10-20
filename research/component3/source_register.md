# Official source register — Component 3 requirements dataset

Every row in `backend/data/uda_requirements.csv` must trace to a source listed
here. A row without a source that a panel member can open is worse than no row:
it turns the whole traceability claim into a liability.

**Scope:** Building Permit and Certificate of Conformity, Matara jurisdiction.
Target size is 14–18 requirements across both types. Quality over count.

## Status

| # | Source | Type | Covers | Collected | Verified on |
| --- | --- | --- | --- | --- | --- |
| S1 | Matara MC/PS building permit application form | Primary | Building Permit checklist | ☐ | |
| S2 | Matara MC/PS CoC application form | Primary | CoC checklist | ☐ | |
| S3 | UDA One Stop Unit — `osu.uda.lk` | Secondary | Online submission requirements | ☐ | |
| S4 | UDA Planning & Development Regulations (Gazette) | Primary | Statutory basis, section numbers | ☐ | |
| S5 | NBRO clearance requirement (conditional trigger) | Primary | When landslide clearance applies | ☐ | |

Tick each box as it is collected and fill the date actually checked. None of the
URLs above has been verified for current content by this project yet, and
regulations change — the date column is the point of the exercise.

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
