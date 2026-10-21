# Synthetic labelling policy — Component 3 submission readiness

**Status:** frozen before the model comparison in `02_train_evaluate.py` was run.
**Generator:** `01_generate_synthetic.py` · **Seed:** 20261020 · **Output:** `backend/data/approval_scenarios_synthetic.csv`

## Why the data is generated

Sri Lankan building-approval outcomes are not published. There is no public record
of which applications were approved, rejected, or sent back for rework, so no
historical label set exists to train on. The alternatives were to use an unrelated
foreign dataset, which would not transfer to the Matara approval process, or to
generate cases from a stated policy. This project does the latter, and states the
limitation rather than hiding it.

## The trap this policy is built to avoid

The obvious approach is to count missing and mismatched documents with a rule,
then label each case from those same counts. A classifier given those counts as
features would simply relearn the rule and report near-perfect accuracy. That
number would say nothing except that a forest can memorise an `if` statement, and
it would collapse under the first question about why the model is needed at all.

Two devices prevent it.

### 1. Latent factors

Three influences shape the label and are never exported as features:

| Latent factor | Values | Role |
| --- | --- | --- |
| `drawing_complexity` | simple / moderate / complex | Complex drawings draw more review. Leans on project scale. |
| `condition_ambiguity` | 0.0–1.0 (Beta(2,3)) | How clearly an applicable condition resolves. Conditional cases only. |
| `applicant_type` | first_time / repeat / agent | First-time applicants file more reworkable submissions. |

These stand for what a reviewer reacts to but a submission form does not capture.
They put a ceiling on attainable accuracy, which is the realistic situation: the
true outcome is not fully determined by what is observable at submission time.

### 2. Stochastic labels

The risk score is not cut at a hard threshold. It is converted to class
probabilities and sampled:

```
P(high)   = sigmoid((score - 7.20) / 1.15)
P(low)    = sigmoid((2.80 - score) / 1.15)
P(medium) = 1 - P(high) - P(low)
```

Neighbouring cases therefore overlap, as real ones do. Two applications with
identical paperwork can land in different risk bands.

## The risk score

Visible terms, which the model can learn, are deliberately **not** a plain
weighted sum. A purely additive score is optimally classified by thresholding
that same sum, which is exactly what the rule baseline does, leaving a learner
nothing to find. Each interaction below is one a reviewer would state in words.

| Term | Form | Reasoning |
| --- | --- | --- |
| Missing documents | `2.60 × type_mult × min(missing, 3) ^ 0.85` | CoC requirements are lighter than Building Permit (`type_mult` 0.60 vs 1.00). Deficiencies saturate: past about three missing items the file is returned regardless. |
| Applicable total | `mandatory + triggered conditionals` | Taken from `uda_requirements.csv`: 8 mandatory for a Building Permit, 2 for a CoC. Triggered conditionals follow the real condition groups, so totals run 8–17 and 2–8, including the case where no condition applies at all. |
| Mismatches | `0.85 × mismatch × (0.5 + submitted/required)` | Mismatches surface in proportion to how much was actually submitted. |
| Expired documents | `2.20 × expired × 1.60 if unverified ≥ 2` | Weighted close to a missing document: an expired certificate must be obtained again, so in rework terms the applicant does not have it. An expiry is worse amid several unverified ones. |
| Unverified documents | `0.38 × unverified` | Linear. |
| Conditional clearance gap | `1.60 × gap × 1.85 if missing == 0` | A missing clearance dominates when it is the only outstanding item. |
| Latent | complexity, ambiguity, applicant | See above. Not exported. |
| Noise | `N(0, 0.38)` | Residual variation. |

## Dataset structure

- **1,728 rows** from **96 scenario templates**, 18 variants each.
- Templates vary application type, base missing count, whether a conditional
  clearance applies, defect profile (clean / mismatch-heavy / expiry-heavy /
  mixed), and project scale.
- Class balance: low 13.9%, medium 38.5%, high 47.5%. `low` is the thin band; the model card records what that costs.
- `template_id` is carried on every row so train/test can be split by archetype.
  Variants of one template are near-duplicates; a random row split would leak
  them across the boundary and inflate every score.

## Internal consistency rules

A case cannot contradict itself. A document that was never submitted cannot be
flagged as mismatched, expired or unverified, so those counts are clipped to the
submitted count. `submitted = required - missing` always holds.

## Limitation to state in the report and in the UI

> Labels are generated, not observed. Reported metrics measure how learnable this
> documented policy is. They are not evidence of accuracy against real approval or
> rework outcomes, and the system does not claim to predict government decisions.

## Changing this policy

If any weight, threshold or latent factor changes, the cut points `T_LOW` and
`T_HIGH` must be re-checked against the score distribution, the dataset
regenerated, and the model comparison re-run in full. Do not adjust the generator
in order to make a preferred model win; that fits the data to the conclusion and
is the failure this policy exists to prevent.
