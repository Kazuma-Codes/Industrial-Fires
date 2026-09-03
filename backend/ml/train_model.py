import os
import sys
from pathlib import Path
import logging
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import ThermalEvent, EventIntel, Facility

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("train_model")


def extract_training_dataset():
    """Extract tabular features and weak labels from classified database records"""
    db = SessionLocal()
    try:
        records = (
            db.query(ThermalEvent, EventIntel, Facility)
            .join(EventIntel, EventIntel.event_id == ThermalEvent.id)
            .outerjoin(Facility, Facility.id == EventIntel.nearest_facility_id)
            .filter(EventIntel.classification != "unknown")
            .all()
        )

        rows = []
        for ev, intel, fac in records:
            time_val = ev.acq_time.zfill(4)
            hour = int(time_val[:2])
            month = ev.acq_date.month

            rows.append({
                "frp": ev.frp,
                "bright_ti4": ev.bright_ti4 or 310.0,
                "confidence_val": 1 if ev.confidence in ["h", "high"] else 0,
                "is_night": 1 if ev.daynight == "N" else 0,
                "distance_to_facility_m": intel.distance_to_facility_m if intel.distance_to_facility_m else 9999.0,
                "facility_criticality": fac.criticality if fac else 0,
                "inside_facility": 1 if intel.inside_facility else 0,
                "persistence_30d": intel.persistence_30d or 0.0,
                "detections_7d": intel.detections_7d or 0,
                "detections_30d": intel.detections_30d or 0,
                "frp_anomaly_ratio": intel.frp_anomaly_ratio or 1.0,
                "month": month,
                "hour": hour,
                "label": intel.classification
            })

        df = pd.DataFrame(rows)
        return df
    finally:
        db.close()


def train_classifier():
    df = extract_training_dataset()
    if len(df) < 10:
        logger.warning("Fewer than 10 records available in database. Generating synthetic samples to pre-train model.")
        # Generate synthetic representative samples
        synthetic = []
        # Persistent source
        for _ in range(40):
            synthetic.append({
                "frp": np.random.uniform(5, 15), "bright_ti4": np.random.uniform(325, 340), "confidence_val": 1,
                "is_night": np.random.choice([0, 1]), "distance_to_facility_m": np.random.uniform(50, 350),
                "facility_criticality": np.random.choice([4, 5]), "inside_facility": 1,
                "persistence_30d": np.random.uniform(0.6, 0.95), "detections_7d": np.random.randint(4, 8),
                "detections_30d": np.random.randint(18, 30), "frp_anomaly_ratio": np.random.uniform(0.8, 1.4),
                "month": np.random.randint(1, 13), "hour": np.random.randint(0, 24), "label": "persistent_industrial_source"
            })
        # Gas flare
        for _ in range(40):
            synthetic.append({
                "frp": np.random.uniform(8, 18), "bright_ti4": np.random.uniform(335, 360), "confidence_val": 1,
                "is_night": 1, "distance_to_facility_m": np.random.uniform(30, 250),
                "facility_criticality": 5, "inside_facility": 1,
                "persistence_30d": np.random.uniform(0.7, 1.0), "detections_7d": np.random.randint(5, 8),
                "detections_30d": np.random.randint(22, 30), "frp_anomaly_ratio": np.random.uniform(0.9, 1.5),
                "month": np.random.randint(1, 13), "hour": np.random.choice([20, 21, 22, 23, 0, 1, 2, 3]), "label": "gas_flare"
            })
        # Industrial fire
        for _ in range(30):
            synthetic.append({
                "frp": np.random.uniform(30, 80), "bright_ti4": np.random.uniform(355, 385), "confidence_val": 1,
                "is_night": np.random.choice([0, 1]), "distance_to_facility_m": np.random.uniform(80, 450),
                "facility_criticality": np.random.choice([3, 4, 5]), "inside_facility": 1,
                "persistence_30d": np.random.uniform(0.03, 0.15), "detections_7d": 1,
                "detections_30d": np.random.randint(1, 3), "frp_anomaly_ratio": np.random.uniform(3.0, 7.5),
                "month": np.random.randint(1, 13), "hour": np.random.randint(0, 24), "label": "industrial_fire"
            })
        # Wildfire
        for _ in range(40):
            synthetic.append({
                "frp": np.random.uniform(15, 60), "bright_ti4": np.random.uniform(330, 360), "confidence_val": 1,
                "is_night": 0, "distance_to_facility_m": np.random.uniform(2500, 15000),
                "facility_criticality": 0, "inside_facility": 0,
                "persistence_30d": np.random.uniform(0.05, 0.20), "detections_7d": np.random.randint(2, 6),
                "detections_30d": np.random.randint(2, 6), "frp_anomaly_ratio": np.random.uniform(1.2, 3.5),
                "month": np.random.choice([2, 3, 4, 5]), "hour": np.random.randint(6, 17), "label": "wildfire"
            })
        # Agricultural burning
        for _ in range(50):
            synthetic.append({
                "frp": np.random.uniform(3, 14), "bright_ti4": np.random.uniform(312, 328), "confidence_val": 0,
                "is_night": 0, "distance_to_facility_m": np.random.uniform(1500, 10000),
                "facility_criticality": 0, "inside_facility": 0,
                "persistence_30d": np.random.uniform(0.01, 0.10), "detections_7d": 1,
                "detections_30d": 1, "frp_anomaly_ratio": np.random.uniform(0.4, 1.1),
                "month": np.random.choice([10, 11, 4, 5]), "hour": np.random.randint(8, 16), "label": "agricultural_burning"
            })
        df = pd.DataFrame(synthetic)

    feature_cols = [
        "frp", "bright_ti4", "confidence_val", "is_night", "distance_to_facility_m",
        "facility_criticality", "inside_facility", "persistence_30d", "detections_7d",
        "detections_30d", "frp_anomaly_ratio", "month", "hour"
    ]
    X = df[feature_cols]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    logger.info(f"Training Random Forest Classifier on {len(X_train)} samples...")
    clf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    clf.fit(X_train, y_train)

    accuracy = clf.score(X_test, y_test)
    logger.info(f"Model test accuracy: {accuracy * 100:.2f}%")

    out_path = Path(__file__).resolve().parent / "model.joblib"
    joblib.dump({"model": clf, "features": feature_cols, "classes": clf.classes_}, out_path)
    logger.info(f"Saved trained model to {out_path}")


if __name__ == "__main__":
    train_classifier()
