import os
import sys
import json
import joblib
import numpy as np
import pandas as pd

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report, confusion_matrix

from ml.datasets.generate_synthetic_ner_data import generate_ner_landslide_dataset
from ml.feature_engineering.features import FEATURE_COLUMNS

def train_and_export():
    os.makedirs("ml/models", exist_ok=True)
    os.makedirs("ml/datasets", exist_ok=True)

    csv_path = "ml/datasets/ner_landslide_historical_synthetic.csv"
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
    else:
        df = generate_ner_landslide_dataset(5000)
        df.to_csv(csv_path, index=False)

    print(f"Loaded dataset with {len(df)} rows.")

    X = df[FEATURE_COLUMNS]
    y = df["landslide_occurred"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 1. Train Random Forest Classifier
    rf_model = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)

    y_pred = rf_model.predict(X_test)
    y_prob = rf_model.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, y_prob)
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"Random Forest Performance: AUC = {auc:.4f}, Accuracy = {acc:.4f}")

    # Feature importances
    importances = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in rf_model.feature_importances_]))
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    # 2. Train Isolation Forest for Sensor Anomaly Detection
    # Train on sensor telemetry subsets
    sensor_features = ["soil_moisture_vwc", "pore_water_pressure_kpa", "sensor_anomaly_score"]
    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=0.08,
        random_state=42
    )
    iso_forest.fit(X_train[sensor_features])

    # Save models
    joblib.dump(rf_model, "ml/models/risk_model.joblib")
    joblib.dump(iso_forest, "ml/models/anomaly_detector.joblib")

    # Metrics and metadata
    metadata = {
        "model_name": "LandSlideX-NER-Ensemble",
        "version": "v2.4.1-SIH2026",
        "algorithm": "RandomForestClassifier + IsolationForest",
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "metrics": {
            "roc_auc": round(float(auc), 4),
            "accuracy": round(float(acc), 4),
            "confusion_matrix": cm
        },
        "feature_importances": sorted_importances,
        "features": FEATURE_COLUMNS,
        "thresholds": {
            "low": 25,
            "moderate": 50,
            "high": 75,
            "extreme": 100
        }
    }

    with open("ml/models/model_metrics.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("Model and metrics successfully saved to ml/models/")

if __name__ == "__main__":
    train_and_export()
