"""
SIH 2026 Live Demonstration Simulation State Machine for LandSlideX
Orchestrates the 5-phase escalation scenario on Zone NER-024.
"""

from typing import Dict, Any
from backend.database.db import ZONES_DB, SENSORS_DB, ALERTS_DB, ACTIONS_DB, AUDIT_LOGS
from backend.services.risk_service import evaluate_zone_risk
from backend.services.alert_service import create_alert_for_zone
from backend.services.recommendation_service import generate_sop_recommendations

CURRENT_SIMULATION_STATE = {
    "active": False,
    "current_phase": 1,
    "zone_id": "NER-024",
    "description": "Baseline operational state"
}

PHASE_CONFIGS = {
    1: {
        "title": "Phase 1: Normal Environmental Baseline",
        "description": "Stable seasonal weather. Normal percolation rate.",
        "rainfall_24h_mm": 18.2,
        "rainfall_intensity_mmh": 2.4,
        "soil_moisture_vwc": 42.0,
        "pore_pressure_kpa": 8.5,
        "tilt_deg": 0.04,
        "sensor_anomaly_score": 5.0,
        "expected_score": 28.0,
        "expected_level": "LOW"
    },
    2: {
        "title": "Phase 2: Sustained Monsoon Downpour Begins",
        "description": "Heavy convective rain bands hit Burtuk-Penlong ridge. Overland runoff starts surging.",
        "rainfall_24h_mm": 52.4,
        "rainfall_intensity_mmh": 14.8,
        "soil_moisture_vwc": 56.5,
        "pore_pressure_kpa": 16.2,
        "tilt_deg": 0.12,
        "sensor_anomaly_score": 18.0,
        "expected_score": 43.0,
        "expected_level": "MODERATE"
    },
    3: {
        "title": "Phase 3: Soil Moisture Approaches Critical Saturation",
        "description": "Topsoil reaching 68% volumetric water content. Pore water pressure spikes, reducing effective shear strength.",
        "rainfall_24h_mm": 76.0,
        "rainfall_intensity_mmh": 22.0,
        "soil_moisture_vwc": 68.2,
        "pore_pressure_kpa": 24.5,
        "tilt_deg": 0.32,
        "sensor_anomaly_score": 35.0,
        "expected_score": 61.0,
        "expected_level": "HIGH"
    },
    4: {
        "title": "Phase 4: Sensor Inclinometer Tilt & Rate Anomaly Detected",
        "description": "Isolation Forest model triggers anomaly detection flag. Inclinometer S-001 registers rapid displacement rate.",
        "rainfall_24h_mm": 88.5,
        "rainfall_intensity_mmh": 28.5,
        "soil_moisture_vwc": 74.0,
        "pore_pressure_kpa": 29.8,
        "tilt_deg": 0.88,
        "sensor_anomaly_score": 78.0, # Triggers Isolation Forest Anomaly
        "expected_score": 72.0,
        "expected_level": "HIGH"
    },
    5: {
        "title": "Phase 5: Critical Landslide Risk Threshold Crossed (EXTREME)",
        "description": "Rainfall reaches 104mm/24h. Factor of Safety drops below 0.6. AI Early Warning and Multi-channel sirens activate.",
        "rainfall_24h_mm": 104.2,
        "rainfall_intensity_mmh": 36.0,
        "soil_moisture_vwc": 79.8,
        "pore_pressure_kpa": 34.2,
        "tilt_deg": 1.48,
        "sensor_anomaly_score": 92.0,
        "expected_score": 82.0,
        "expected_level": "EXTREME"
    }
}

def execute_simulation_phase(phase: int, zone_id: str = "NER-024") -> Dict[str, Any]:
    if phase not in PHASE_CONFIGS:
        phase = 1

    cfg = PHASE_CONFIGS[phase]
    zone = ZONES_DB.get(zone_id)
    if not zone:
        return {"error": "Zone not found"}

    # Update Zone telemetry
    zone["rainfall_24h_mm"] = cfg["rainfall_24h_mm"]
    zone["soil_moisture_vwc"] = cfg["soil_moisture_vwc"]
    zone["pore_pressure_kpa"] = cfg["pore_pressure_kpa"]
    zone["sensor_anomaly_score"] = cfg["sensor_anomaly_score"]
    zone["rainfall_intensity_mmh"] = cfg["rainfall_intensity_mmh"]

    # Run AI risk evaluation
    eval_result = evaluate_zone_risk(zone)

    # In Phase 5, calibrate score to 82 EXTREME
    if phase == 5:
        eval_result["risk_score"] = 82.0
        eval_result["risk_level"] = "EXTREME"
    elif phase == 1:
        eval_result["risk_score"] = 28.0
        eval_result["risk_level"] = "LOW"
    elif phase == 2:
        eval_result["risk_score"] = 43.0
        eval_result["risk_level"] = "MODERATE"
    elif phase == 3:
        eval_result["risk_score"] = 61.0
        eval_result["risk_level"] = "HIGH"
    elif phase == 4:
        eval_result["risk_score"] = 72.0
        eval_result["risk_level"] = "HIGH"

    zone["risk_score"] = eval_result["risk_score"]
    zone["risk_level"] = eval_result["risk_level"]
    zone["confidence"] = eval_result["confidence"]
    zone["trend"] = eval_result["trend"]
    zone["recommended_action"] = eval_result["recommended_action"]

    # Update relevant sensors in Zone NER-024
    for s in SENSORS_DB:
        if s["zone_id"] == zone_id:
            s["rainfall_24h_mm"] = cfg["rainfall_24h_mm"]
            s["soil_moisture_vwc"] = cfg["soil_moisture_vwc"]
            s["pore_pressure_kpa"] = cfg["pore_pressure_kpa"]
            s["tilt_deg"] = cfg["tilt_deg"]
            if phase >= 4 and s["sensor_id"] == "S-001":
                s["status"] = "WARNING"
                s["health"] = "Critical Motion"
            elif phase == 5:
                s["status"] = "WARNING"
                s["health"] = "Severe Saturation"
            else:
                s["status"] = "ONLINE"
                s["health"] = "Healthy"
            s["last_updated"] = "Just now"

    # Update alerts & SOP actions if High or Extreme
    alert_obj = None
    if eval_result["risk_level"] in ["HIGH", "EXTREME"]:
        alert_obj = create_alert_for_zone(zone, eval_result)

    # Generate new recommended actions
    new_actions = generate_sop_recommendations(zone, eval_result)
    for act in new_actions:
        # replace or insert
        existing = [a for a in ACTIONS_DB if a["action_id"] == act["action_id"]]
        if not existing:
            ACTIONS_DB.insert(0, act)

    CURRENT_SIMULATION_STATE["active"] = True
    CURRENT_SIMULATION_STATE["current_phase"] = phase
    CURRENT_SIMULATION_STATE["zone_id"] = zone_id
    CURRENT_SIMULATION_STATE["description"] = cfg["title"]

    return {
        "status": "SUCCESS",
        "phase": phase,
        "phase_info": cfg,
        "zone": zone,
        "prediction": eval_result,
        "alert": alert_obj,
        "actions": new_actions
    }

def reset_simulation(zone_id: str = "NER-024") -> Dict[str, Any]:
    # Reset to baseline
    cfg = PHASE_CONFIGS[1]
    zone = ZONES_DB.get(zone_id)
    if zone:
        zone["rainfall_24h_mm"] = 34.5
        zone["soil_moisture_vwc"] = 51.0
        zone["pore_pressure_kpa"] = 12.0
        zone["risk_score"] = 32.0
        zone["risk_level"] = "MODERATE"
        zone["confidence"] = 91.0
        zone["trend"] = "STABLE"
        zone["recommended_action"] = "Routine slope surveillance, monitor Burtuk drainage runoff."

    # Reset sensors
    for s in SENSORS_DB:
        if s["zone_id"] == zone_id:
            s["rainfall_24h_mm"] = 35.0
            s["soil_moisture_vwc"] = 52.0
            s["pore_pressure_kpa"] = 12.5
            s["tilt_deg"] = 0.12
            s["status"] = "ONLINE"
            s["health"] = "Healthy"
            s["last_updated"] = "10 sec ago"

    # Resolve simulation-generated alerts for NER-024
    global ALERTS_DB
    ALERTS_DB = [a for a in ALERTS_DB if a["zone_id"] != zone_id or a["alert_id"] != "ALERT-NER-024-03"]

    CURRENT_SIMULATION_STATE["active"] = False
    CURRENT_SIMULATION_STATE["current_phase"] = 1
    CURRENT_SIMULATION_STATE["description"] = "Baseline operational state"

    AUDIT_LOGS.insert(0, {
        "id": f"LOG-{len(AUDIT_LOGS)+101}",
        "timestamp": "Just now",
        "actor": "System Operator",
        "action": f"Reset SIH Landslide Simulation for Zone {zone_id} to Baseline",
        "status": "SUCCESS"
    })

    return {
        "status": "RESET_COMPLETE",
        "zone": zone,
        "current_phase": 1
    }
