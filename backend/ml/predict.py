import os
from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
import joblib

MODEL_PATH = Path(__file__).resolve().parent / "model.joblib"
_cached_bundle = None


def load_model_bundle():
    global _cached_bundle
    if _cached_bundle is None and MODEL_PATH.exists():
        try:
            _cached_bundle = joblib.load(MODEL_PATH)
        except Exception:
            _cached_bundle = None
    return _cached_bundle


def predict_thermal_anomaly(features: Dict[str, Any]) -> Tuple[str, float, Dict[str, float]]:
    """
    Predict anomaly class and return (predicted_class, confidence, probabilities)
    """
    bundle = load_model_bundle()
    if bundle is None:
        return "unknown", 0.5, {}

    model = bundle["model"]
    feature_cols = bundle["features"]
    classes = bundle["classes"]

    row = {col: features.get(col, 0.0) for col in feature_cols}
    X = pd.DataFrame([row])

    probs = model.predict_proba(X)[0]
    prob_dict = {cls_name: round(float(p), 4) for cls_name, p in zip(classes, probs)}

    best_idx = int(np.argmax(probs))
    best_class = classes[best_idx]
    best_conf = float(probs[best_idx])

    return best_class, best_conf, prob_dict
