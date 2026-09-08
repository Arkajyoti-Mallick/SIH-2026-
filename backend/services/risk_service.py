"""
Risk Service for LandSlideX
Orchestrates AI inference, environmental inputs, threshold calibration, and trend tracking.
"""

from typing import Dict, Any
from ml.risk_prediction.inference import predict_landslide_risk
from backend.database.db import ADMIN_CONFIG

def evaluate_zone_risk(zone_data: Dict[str, Any]) -> Dict[str, Any]:
    # Extract feature inputs
    inputs = {
        "rainfall_intensity_mmh": zone_data.get("rainfall_intensity_mmh", 8.0),
        "rainfall_24h_mm": zone_data.get("rainfall_24h_mm", 35.0),
        "rainfall_72h_mm": zone_data.get("rainfall_72h_mm", 75.0),
        "antecedent_precip_index": zone_data.get("antecedent_precip_index", 45.0),
        "soil_moisture_vwc": zone_data.get("soil_moisture_vwc", 50.0),
        "pore_water_pressure_kpa": zone_data.get("pore_pressure_kpa", 14.0),
        "slope_deg": zone_data.get("slope_deg", 38.0),
        "elevation_m": zone_data.get("elevation_m", 1500.0),
        "lithology_weakness": zone_data.get("lithology_weakness", 3),
        "historical_density": zone_data.get("historical_density", 1.8),
        "distance_to_road_cut_m": zone_data.get("distance_to_road_cut_m", 50.0),
        "distance_to_drainage_m": zone_data.get("distance_to_drainage_m", 100.0),
        "sensor_anomaly_score": zone_data.get("sensor_anomaly_score", 10.0)
    }

    prediction = predict_landslide_risk(inputs)

    # Calibrate level against active admin thresholds
    score = prediction["risk_score"]
    t_low = ADMIN_CONFIG["threshold_low"]
    t_mod = ADMIN_CONFIG["threshold_moderate"]
    t_high = ADMIN_CONFIG["threshold_high"]

    if score <= t_low:
        calibrated_level = "LOW"
    elif score <= t_mod:
        calibrated_level = "MODERATE"
    elif score <= t_high:
        calibrated_level = "HIGH"
    else:
        calibrated_level = "EXTREME"

    prediction["risk_level"] = calibrated_level
    return prediction
