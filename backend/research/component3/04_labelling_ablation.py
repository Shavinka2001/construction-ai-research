"""
Ablation: what a naive synthetic labelling policy would have reported.

This exists to answer the obvious question about any model trained on
generated data — "you wrote the labels, so what does the accuracy mean?" —
with a number rather than an assurance.

Two datasets, identical in every respect except how the label is produced:

* **naive**   — the label is a deterministic threshold on the same weighted
                evidence the model is given as features. No latent factors, no
                sampling. This is the obvious way to generate the data, and it
                is what a reader should assume was done unless told otherwise.
* **adopted** — the policy actually used, documented in labelling_policy.md:
                three latent factors withheld from the features, and labels
                sampled from class probabilities rather than cut at a line.

The naive dataset is the control. If a classifier scores near-perfectly on it
*and so does the rule baseline*, the classifier has learned nothing the rule
did not already encode, and the headline accuracy measures the generator, not
the problem.

Run: python backend/research/component3/04_labelling_ablation.py
Writes: backend/research/component3/ablation.json
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import f1_score
from sklearn.model_selection import GroupShuffleSplit

HERE = Path(__file__).resolve().parent
SEED = 20261020
LABELS = ["low", "medium", "high"]


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


gen = _load("generator", "01_generate_synthetic.py")
trainer = _load("trainer", "02_train_evaluate.py")


def visible_score(case: dict) -> float:
    """
    The weighted evidence a rule engine can see. This is exactly the quantity
    the adopted policy also uses, minus every latent term and the noise.
    """
    required = case["required_document_count"]
    submitted = case["submitted_document_count"]
    missing = case["missing_document_count"]
    gap = float(
        case["conditional_clearance_required"]
        and not case["conditional_clearance_submitted"]
    )
    return (
        gen.W_MISSING
        * gen.TYPE_MISSING_MULTIPLIER[case["application_type"]]
        * min(missing, gen.MISSING_SATURATION) ** 0.85
        + gen.W_MISMATCH * case["document_mismatch_count"] * (0.5 + submitted / required)
        + gen.W_EXPIRED
        * case["expired_document_count"]
        * (gen.EXPIRED_COMPOUNDING if case["unverified_document_count"] >= 2 else 1.0)
        + gen.W_UNVERIFIED * case["unverified_document_count"]
        + gen.W_CLEARANCE_GAP * gap * (gen.CLEARANCE_SOLE_BLOCKER if missing == 0 else 1.0)
    )


def build_naive() -> pd.DataFrame:
    """
    Same cases, relabelled the obvious way: cut the visible score at the
    terciles. Deterministic, no latent influence, no noise.
    """
    rng = np.random.default_rng(SEED)
    rows = []
    for template in gen.build_templates():
        for _ in range(gen.VARIANTS_PER_TEMPLATE):
            case = gen.sample_case(rng, template)
            case["_score"] = visible_score(case)
            rows.append(case)

    frame = pd.DataFrame(rows)
    low_cut, high_cut = np.percentile(frame["_score"], [33.3, 66.7])
    frame["risk_label"] = np.where(
        frame["_score"] >= high_cut,
        "high",
        np.where(frame["_score"] >= low_cut, "medium", "low"),
    )
    return frame.drop(columns=["_score"])


def evaluate(frame: pd.DataFrame) -> dict[str, float]:
    """Rule baseline and random forest on one dataset, grouped split."""
    X = frame[trainer.FEATURES].copy()
    y = frame["risk_label"].to_numpy()
    groups = frame["template_id"].to_numpy()

    train_idx, test_idx = next(
        GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(X, y, groups)
    )
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    scores: dict[str, float] = {}
    models = trainer.build_models()

    # An unrestricted forest, added to probe the ceiling rather than to be
    # deployed: if extra capacity keeps paying off, the label is still a
    # function waiting to be recovered rather than a genuinely uncertain
    # outcome.
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.pipeline import Pipeline

    models["forest_unrestricted"] = Pipeline(
        [
            ("pre", trainer.make_preprocessor()),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=600, min_samples_leaf=1, random_state=SEED, n_jobs=-1
                ),
            ),
        ]
    )

    for name in ("rule", "logistic", "forest", "forest_unrestricted"):
        model = models[name]
        model.fit(X_train, y_train)
        scores[name] = round(
            float(f1_score(y_test, model.predict(X_test), average="macro", zero_division=0)),
            4,
        )
    return scores


def main() -> None:
    naive = build_naive()
    adopted = pd.read_csv(trainer.DATA)

    naive_scores = evaluate(naive)
    adopted_scores = evaluate(adopted)

    result = {
        "naive_policy": {
            "description": (
                "Label is a deterministic tercile cut on the same weighted "
                "evidence the model receives as features."
            ),
            "rows": int(len(naive)),
            "macro_f1": naive_scores,
            "ceiling": naive_scores["forest_unrestricted"],
        },
        "adopted_policy": {
            "description": (
                "Three latent factors withheld from the features; labels "
                "sampled from class probabilities. See labelling_policy.md."
            ),
            "rows": int(len(adopted)),
            "macro_f1": adopted_scores,
            "ceiling": adopted_scores["forest_unrestricted"],
        },
        "reading": (
            "Under the naive policy the label is a deterministic function of "
            "the features, so a learner recovers the generator's own formula "
            "and the score approaches its ceiling. Reporting that number would "
            "describe the generator, not the difficulty of the task. The "
            "adopted policy withholds three factors that are genuinely "
            "unobservable at submission time, which caps attainable "
            "performance well short of 1.0. The lower number is the honest one."
        ),
    }

    (HERE / "ablation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

    header = f"{'policy':<10} {'rule':>7} {'logistic':>9} {'forest':>8} {'unrestricted':>13}"
    print(header)
    print("-" * len(header))
    for key, label in (("naive_policy", "naive"), ("adopted_policy", "adopted")):
        s = result[key]["macro_f1"]  # type: ignore[index]
        print(
            f"{label:<10} {s['rule']:>7.3f} {s['logistic']:>9.3f} "
            f"{s['forest']:>8.3f} {s['forest_unrestricted']:>13.3f}"
        )
    print(f"\nwrote {HERE / 'ablation.json'}")


if __name__ == "__main__":
    main()
