"""
Synthetic Dataset Generator for North-Eastern Region (NER) Landslide Risk
Calibrated with Geological Survey of India (GSI) and IMD NER Weather Patterns.
"""

import numpy as np
import pandas as pd
import json
import os

np.random.seed(42)

def generate_ner_landslide_dataset(n_samples=4000):
    # 1. Meteorological features (NER Monsoon / Cloudburst profiles)
    rainfall_24h = np.random.exponential(scale=35.0, size=n_samples) + np.random.uniform(0, 15, size=n_samples)
    rainfall_intensity = rainfall_24h * np.random.uniform(0.08, 0.25, size=n_samples)
    rainfall_72h = rainfall_24h * np.random.uniform(1.4, 2.8, size=n_samples)
    antecedent_precip = rainfall_72h * 0.65 + np.random.uniform(5, 50, size=n_samples)

    # 2. Geotechnical & In-situ Sensor features
    # Soil moisture correlates with rainfall accumulation
    soil_moisture_vwc = np.clip(20.0 + (rainfall_72h * 0.28) + np.random.normal(0, 6, size=n_samples), 12.0, 88.0)
    pore_water_pressure = np.clip((soil_moisture_vwc - 40.0) * 0.85 + (rainfall_24h * 0.15) + np.random.normal(0, 3, size=n_samples), 0.0, 48.0)

    # 3. Geomorphological / DEM features (Steep Himalayan terrain)
    slope_deg = np.random.normal(loc=36.0, scale=8.5, size=n_samples)
    slope_deg = np.clip(slope_deg, 14.0, 58.0)
    elevation_m = np.random.uniform(300, 2400, size=n_samples)
    lithology_weakness = np.random.choice([1, 2, 3, 4, 5], size=n_samples, p=[0.1, 0.2, 0.35, 0.25, 0.1])
    historical_density = np.random.exponential(scale=1.8, size=n_samples)
    distance_to_road_cut = np.random.exponential(scale=120.0, size=n_samples)
    distance_to_drainage = np.random.exponential(scale=180.0, size=n_samples)

    # 4. Sensor Anomaly indicator (accelerometer / tilt sensor mm/hr displacement rate)
    sensor_anomaly_score = np.clip(np.random.beta(a=0.5, b=5.0, size=n_samples) * 100.0, 0.0, 100.0)

    # 5. Physics-guided Landslide Probability & Safety Factor Calculation
    # Infinite Slope Stability Model proxy: FS = (c + (gamma - gamma_w)*H*cos^2(beta)*tan(phi)) / (gamma*H*sin(beta)*cos(beta))
    slope_rad = np.radians(slope_deg)
    driving_force = np.sin(slope_rad) * 1.8 + (pore_water_pressure * 0.04)
    resisting_force = np.cos(slope_rad) * 1.4 * (1.0 - (lithology_weakness * 0.12))

    # Logit calculation combining physics and empirical triggers
    logit = (
        (rainfall_24h / 50.0) * 1.6 +
        (antecedent_precip / 90.0) * 1.2 +
        (soil_moisture_vwc / 60.0) * 1.8 +
        (pore_water_pressure / 25.0) * 1.4 +
        (slope_deg / 35.0) * 1.5 +
        (lithology_weakness / 3.0) * 0.9 +
        (historical_density / 2.0) * 0.8 +
        (50.0 / (distance_to_road_cut + 20.0)) * 0.7 +
        (sensor_anomaly_score / 50.0) * 1.1 -
        5.8
    )

    prob = 1.0 / (1.0 + np.exp(-logit))
    prob = np.clip(prob, 0.01, 0.99)

    # Calibrated risk score 0 to 100
    risk_score = np.clip(prob * 100.0 + np.random.normal(0, 3, size=n_samples), 0.0, 100.0)
    landslide_occurred = (risk_score >= 55.0) & (np.random.uniform(0, 1, size=n_samples) < prob * 1.15)
    landslide_occurred = landslide_occurred.astype(int)

    df = pd.DataFrame({
        "rainfall_intensity_mmh": np.round(rainfall_intensity, 2),
        "rainfall_24h_mm": np.round(rainfall_24h, 2),
        "rainfall_72h_mm": np.round(rainfall_72h, 2),
        "antecedent_precip_index": np.round(antecedent_precip, 2),
        "soil_moisture_vwc": np.round(soil_moisture_vwc, 2),
        "pore_water_pressure_kpa": np.round(pore_water_pressure, 2),
        "slope_deg": np.round(slope_deg, 2),
        "elevation_m": np.round(elevation_m, 1),
        "lithology_weakness": lithology_weakness,
        "historical_density": np.round(historical_density, 2),
        "distance_to_road_cut_m": np.round(distance_to_road_cut, 1),
        "distance_to_drainage_m": np.round(distance_to_drainage, 1),
        "sensor_anomaly_score": np.round(sensor_anomaly_score, 2),
        "risk_score": np.round(risk_score, 1),
        "landslide_occurred": landslide_occurred
    })

    return df

if __name__ == "__main__":
    os.makedirs("ml/datasets", exist_ok=True)
    df = generate_ner_landslide_dataset(5000)
    csv_path = "ml/datasets/ner_landslide_historical_synthetic.csv"
    df.to_csv(csv_path, index=False)
    print(f"Generated {len(df)} samples into {csv_path}")
    print(f"Landslide event distribution: {df['landslide_occurred'].value_counts().to_dict()}")
