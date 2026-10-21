# Model card — `submission_risk_v1`

Predicts a **prototype rework-risk band** (`low` / `medium` / `high`) for a
construction approval application before it is submitted to the authority.

| | |
| --- | --- |
| Artifact | `backend/app/ml/submission_risk_v1.joblib` |
| Type | scikit-learn `Pipeline` — `ColumnTransformer` + `LogisticRegression` |
| Selected by | highest grouped-CV macro F1 on the training folds |
| Trained | 2026-10-20 · seed 20261020 · scikit-learn 1.9.0 |
| Training data | `backend/data/approval_scenarios_synthetic.csv` (**synthetic**) |
| Reproduce | `python backend/research/component3/02_train_evaluate.py` |

## What it is not

It is not an approval decision, a safety certification, or legal advice. It does
not determine whether a document is missing — that is the deterministic rule
engine's job, and its findings are reported separately in the API response. The
model only estimates how likely the application is to come back for rework.

## Inputs

A `pandas.DataFrame` with exactly these nine columns. Preprocessing lives inside
the pipeline; never call the classifier directly.

| Column | Type |
| --- | --- |
| `application_type` | `building_permit` or `coc` |
| `required_document_count` | int |
| `submitted_document_count` | int |
| `missing_document_count` | int |
| `document_mismatch_count` | int |
| `expired_document_count` | int |
| `unverified_document_count` | int |
| `conditional_clearance_required` | bool |
| `conditional_clearance_submitted` | bool |

A missing or misnamed column raises `ValueError` rather than predicting. This is
deliberate — see *History* below.

## Results

Held-out test set: 360 rows across 20 scenario templates, split by `template_id`
so no archetype appears in both train and test. Selection used the grouped-CV
column only; the test set played no part in choosing the model.

| Model | CV macro F1 | Accuracy | Macro F1 | F1 low | F1 medium | F1 high |
| --- | --- | --- | --- | --- | --- | --- |
| Majority-class baseline | 0.223 | 0.369 | 0.180 | 0.000 | 0.000 | 0.541 |
| Rule engine alone | 0.636 | 0.622 | 0.609 | 0.537 | 0.610 | 0.680 |
| **Logistic regression (deployed)** | **0.658** | 0.669 | 0.653 | 0.548 | 0.636 | 0.774 |
| Random forest | 0.626 | 0.603 | 0.607 | 0.580 | 0.511 | 0.731 |

The rule baseline is not a straw man: its two cut points were grid-searched on
the training folds (settling at 1.5 and 5.0), so it is the strongest honest
version of "just apply the rule". Learning adds about two macro-F1 points of CV
over it and about four on test — a real but modest margin, and the honest
summary is that most of this component's value is in the rule engine, with the
model adding a usable risk ordering on top.

The random forest was the expected winner and lost, on cross-validation and on
test. Configurations from unrestricted depth through heavy regularisation were
tried and none closed the gap. The labelling policy is close to monotone in the
visible evidence, which suits a linear model, and the generator was never
retuned to reverse the outcome.

`low` is the weakest band (F1 0.548) and the smallest, at 13.9% of rows. It is
the band most sensitive to the latent factors: a case with clean paperwork can
still be pushed out of `low` by drawing complexity or applicant type, neither of
which the model can see. The UI should lean on the rule findings rather than the
band when the two disagree.

## Feature influence

Mean absolute coefficient across the three classes, for the "why this risk?"
panel.

| Feature | Weight |
| --- | --- |
| `expired_document_count` | 0.827 |
| `missing_document_count` | 0.768 |
| `conditional_clearance_required` | 0.567 |
| `conditional_clearance_submitted` | 0.524 |
| `document_mismatch_count` | 0.499 |
| `unverified_document_count` | 0.428 |

End-to-end behaviour on a Building Permit with all conditions resolved to "does
not apply", which is the ordering a user sees:

| Case | Rule status | Risk |
| --- | --- | --- |
| All 8 mandatory documents verified | ready | low |
| One unverified | review_required | low |
| One mismatch | review_required | low |
| One missing | incomplete | medium |
| One expired | incomplete | medium |
| Two or three missing | incomplete | medium |

## Limitations

- **Labels are synthetic.** The numbers above measure how learnable the
  documented labelling policy is. They are not evidence of accuracy against real
  approval or rework outcomes, because no such outcome data is published.
- The policy withholds three latent factors (drawing complexity, condition
  ambiguity, applicant type) from the features by design, which caps attainable
  accuracy. A score near 1.0 here would indicate a broken experiment, not a good
  model.
- Scoped to two application types, Building Permit and Certificate of
  Conformity, and to Matara jurisdiction assumptions.
- Required-document counts now follow `backend/data/uda_requirements.csv`: 8
  mandatory for a Building Permit and 2 for a Certificate of Conformity, plus
  whichever conditional requirements a case triggers. Applicable totals run 9–17
  and 7–8 respectively.
- Each requirement row carries an official `source_url`, `source_section` and a
  `verified_date` of 2026-10-20. That date records that the UDA source was
  opened and the wording extracted from it on that date. It does **not** record
  that the requirement applies in Matara, which is still open: `REQ-BP-010` and
  `REQ-BP-011` carry a condition written for the CMC area and need a Matara
  equivalent, and whether the local authority adds requirements on top of the
  UDA list is unestablished. See `backend/research/component3/source_register.md`.

## History

`v1` supersedes `compliance_model.pkl`, an earlier prototype that classified free
inspection text into four compliance classes. That artifact was a bare
`RandomForestClassifier` trained on 98 samples with 487 features and
`random_state=None`. Its fitted vectorizer was never saved, so inference
substituted a `HashingVectorizer` of matching width whose column mapping was
unrelated to the one the forest learned. Array shapes agreed, so no error was
raised and the API returned confident-looking labels at chance level: the words
`"compliant"` and `"violation"` both returned *High Risk Violation* at 0.34, and
random vectors containing no text drew the `Compliant` label more often than real
compliance sentences did.

Two decisions follow from that failure and should not be reversed:

1. The artifact is a full `Pipeline`, so preprocessing cannot drift away from the
   classifier.
2. Input is a named `DataFrame`, so a wrong or missing column fails loudly
   instead of silently producing garbage.
