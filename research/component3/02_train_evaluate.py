"""
Train and evaluate the submission-readiness risk model for Component 3.

Four models are compared so the gain from learning is visible rather than
asserted:

* ``dummy``     - always predicts the majority class. The floor.
* ``rule``      - a deterministic weighted-evidence rule, its two cut points
                  tuned on the training folds. This is what the rule engine
                  alone can do, and it is the baseline that matters: if the
                  forest cannot beat it, the forest is not earning its place.
* ``logistic``  - linear model on the same features.
* ``forest``    - random forest, the candidate for deployment.

The split is grouped by ``template_id``. Variants of one scenario archetype are
near-duplicates, so a random row split would leak them across train and test
and inflate every score.

The deployed model is whichever of these scores best under grouped
cross-validation on the training side. It is NOT fixed to the forest in
advance: the labelling policy in ``01_generate_synthetic.py`` was frozen before
this comparison ran, and tuning the generator until a preferred model won would
be fitting the data to the conclusion.

The winner is saved as a complete ``Pipeline`` (preprocessing and classifier
together) with a fixed ``random_state``. The v1 prototype was saved as a bare
classifier whose fitted vectorizer was lost, which made its predictions
meaningless; a pipeline makes that failure impossible.

Outputs:
    research/component3/metrics.json
    research/component3/confusion_matrices.txt
    backend/app/ml/submission_risk_v1.joblib
    backend/app/ml/feature_schema.json
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SEED = 20261020
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend" / "data" / "approval_scenarios_synthetic.csv"
ML_DIR = ROOT / "backend" / "app" / "ml"
HERE = Path(__file__).resolve().parent

LABELS = ["low", "medium", "high"]

CATEGORICAL = ["application_type"]
NUMERIC = [
    "required_document_count",
    "submitted_document_count",
    "missing_document_count",
    "document_mismatch_count",
    "expired_document_count",
    "unverified_document_count",
    "conditional_clearance_required",
    "conditional_clearance_submitted",
]
FEATURES = CATEGORICAL + NUMERIC


class RuleBaseline(BaseEstimator, ClassifierMixin):
    """
    What a deterministic rule engine can do on its own.

    Weighted evidence against two cut points. The weights are the ones a
    reviewer would write down by hand; the cut points are grid-searched on the
    training data so the baseline is as strong as it can honestly be.
    """

    def __init__(self, low_cut: float = 3.0, high_cut: float = 6.0):
        self.low_cut = low_cut
        self.high_cut = high_cut

    @staticmethod
    def _evidence(X: pd.DataFrame) -> np.ndarray:
        gap = (
            X["conditional_clearance_required"].astype(int)
            * (1 - X["conditional_clearance_submitted"].astype(int))
        )
        return (
            2.0 * X["missing_document_count"]
            + 1.0 * X["document_mismatch_count"]
            + 1.0 * X["expired_document_count"]
            + 0.5 * X["unverified_document_count"]
            + 2.0 * gap
        ).to_numpy(dtype=float)

    def fit(self, X: pd.DataFrame, y) -> "RuleBaseline":
        self.classes_ = np.array(LABELS, dtype=object)
        ev = self._evidence(X)
        y = np.asarray(y)
        best = (-1.0, self.low_cut, self.high_cut)
        for lo in np.arange(1.0, 8.0, 0.5):
            for hi in np.arange(lo + 0.5, 12.0, 0.5):
                pred = np.where(ev >= hi, "high", np.where(ev >= lo, "medium", "low"))
                score = f1_score(y, pred, average="macro", labels=LABELS, zero_division=0)
                if score > best[0]:
                    best = (score, float(lo), float(hi))
        _, self.low_cut, self.high_cut = best
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        ev = self._evidence(X)
        return np.where(
            ev >= self.high_cut, "high", np.where(ev >= self.low_cut, "medium", "low")
        )


def _explain(model) -> list[tuple[str, float]]:
    """
    Per-feature influence, for the UI's "why this risk?" panel and the report.

    Tree models expose impurity importances; linear models expose coefficients,
    summarised here as the mean absolute weight across the three classes.
    """
    if not isinstance(model, Pipeline):
        return []
    clf = model.named_steps["clf"]
    names = model.named_steps["pre"].get_feature_names_out()
    if hasattr(clf, "feature_importances_"):
        values = clf.feature_importances_
    elif hasattr(clf, "coef_"):
        values = np.abs(clf.coef_).mean(axis=0)
    else:
        return []
    return sorted(zip(names, values), key=lambda t: -t[1])[:10]


def make_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        [
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
            ("num", StandardScaler(), NUMERIC),
        ]
    )


def build_models() -> dict[str, object]:
    return {
        "dummy": Pipeline(
            [("pre", make_preprocessor()), ("clf", DummyClassifier(strategy="most_frequent"))]
        ),
        "rule": RuleBaseline(),
        "logistic": Pipeline(
            [
                ("pre", make_preprocessor()),
                ("clf", LogisticRegression(max_iter=2000, random_state=SEED)),
            ]
        ),
        "forest": Pipeline(
            [
                ("pre", make_preprocessor()),
                (
                    "clf",
                    RandomForestClassifier(
                        n_estimators=400,
                        max_depth=8,
                        min_samples_leaf=5,
                        class_weight="balanced",
                        random_state=SEED,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
    }


def main() -> None:
    df = pd.read_csv(DATA)
    X = df[FEATURES].copy()
    y = df["risk_label"].to_numpy()
    groups = df["template_id"].to_numpy()

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    train_idx, test_idx = next(splitter.split(X, y, groups))
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    g_train = groups[train_idx]

    print(
        f"rows {len(df)} | train {len(train_idx)} / test {len(test_idx)} | "
        f"templates train {len(set(g_train))} / test {len(set(groups[test_idx]))}"
    )
    assert not (set(g_train) & set(groups[test_idx])), "template leaked across split"

    results: dict[str, dict] = {}
    cms: list[str] = []
    fitted: dict[str, object] = {}

    for name, model in build_models().items():
        # Grouped CV on the training side only.
        cv = cross_val_score(
            model, X_train, y_train, groups=g_train,
            cv=GroupKFold(n_splits=5), scoring="f1_macro",
        )
        model.fit(X_train, y_train)
        fitted[name] = model
        pred = model.predict(X_test)

        report = classification_report(
            y_test, pred, labels=LABELS, output_dict=True, zero_division=0
        )
        cm = confusion_matrix(y_test, pred, labels=LABELS)

        results[name] = {
            "cv_macro_f1_mean": round(float(cv.mean()), 4),
            "cv_macro_f1_std": round(float(cv.std()), 4),
            "test_accuracy": round(float(accuracy_score(y_test, pred)), 4),
            "test_macro_f1": round(float(f1_score(y_test, pred, average="macro", zero_division=0)), 4),
            "per_class": {
                c: {k: round(float(report[c][k]), 4) for k in ("precision", "recall", "f1-score")}
                for c in LABELS
            },
            "confusion_matrix": cm.tolist(),
            "confusion_matrix_labels": LABELS,
        }

        cms.append(f"{name}\n{'':>10}" + "".join(f"{l:>10}" for l in LABELS))
        for lab, row in zip(LABELS, cm):
            cms.append(f"{lab:>10}" + "".join(f"{v:>10}" for v in row))
        cms.append("")

        print(
            f"  {name:<9} cv_f1={cv.mean():.3f}+-{cv.std():.3f}  "
            f"test_acc={results[name]['test_accuracy']:.3f}  "
            f"test_f1={results[name]['test_macro_f1']:.3f}"
        )

    results["rule"]["tuned_cut_points"] = {
        "low_cut": fitted["rule"].low_cut,
        "high_cut": fitted["rule"].high_cut,
    }

    # --- pick and ship the winner ----------------------------------------
    # Selected on grouped CV over the training folds only, so the held-out
    # test set plays no part in the choice.
    candidates = {k: v["cv_macro_f1_mean"] for k, v in results.items() if k != "dummy"}
    best_name = max(candidates, key=candidates.__getitem__)
    final = fitted[best_name]
    print(f"\nselected: {best_name} (cv_macro_f1={candidates[best_name]:.3f})")

    ML_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final, ML_DIR / "submission_risk_v1.joblib")

    top = _explain(final)

    (ML_DIR / "feature_schema.json").write_text(
        json.dumps(
            {
                "model_version": "submission_risk_v1",
                "selected_model": best_name,
                "sklearn_version": __import__("sklearn").__version__,
                "classes": LABELS,
                "categorical_features": CATEGORICAL,
                "numeric_features": NUMERIC,
                "input": "pandas.DataFrame with exactly these columns, any order",
                "note": "Preprocessing is inside the pipeline. Never call the classifier directly.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    results["_meta"] = {
        "seed": SEED,
        "rows": len(df),
        "train_rows": len(train_idx),
        "test_rows": len(test_idx),
        "train_templates": len(set(g_train)),
        "test_templates": len(set(groups[test_idx])),
        "split": "GroupShuffleSplit on template_id, test_size=0.2",
        "selected_model": best_name,
        "selection_rule": "highest grouped-CV macro F1 on the training folds",
        "top_features": [[n, round(float(v), 4)] for n, v in top],
        "warning": (
            "Labels are synthetic. These metrics measure how learnable the "
            "documented labelling policy is, not real approval or rework "
            "outcomes. Latent factors withheld from the features cap the "
            "attainable score by design."
        ),
    }

    (HERE / "metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (HERE / "confusion_matrices.txt").write_text("\n".join(cms), encoding="utf-8")

    print("\ntop features:")
    for n, v in top[:6]:
        print(f"  {n:<40} {v:.4f}")
    print(f"\nsaved -> {ML_DIR / 'submission_risk_v1.joblib'}")


if __name__ == "__main__":
    main()
