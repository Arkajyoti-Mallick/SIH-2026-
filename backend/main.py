"""
LandSlideX - Main FastAPI Backend Server
AI-Powered Landslide Risk Intelligence & Early Warning Platform
SIH 2026 - Problem Statement SIH26001 - Team Geo X
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.models.schemas import (
    UserLoginRequest, UserResponse,
    IncidentReportCreate, IncidentVerifyRequest,
    AlertAcknowledgeRequest, SimulationStepRequest,
    SimulationResetRequest, AdminConfig
)
from backend.database.db import (
    USERS_DB, ZONES_DB, SENSORS_DB, ALERTS_DB,
    INCIDENTS_DB, ACTIONS_DB, ADMIN_CONFIG, AUDIT_LOGS
)
from backend.services.risk_service import evaluate_zone_risk
from backend.services.alert_service import acknowledge_alert, create_alert_for_zone
from backend.workers.simulation_runner import (
    execute_simulation_phase, reset_simulation, CURRENT_SIMULATION_STATE, PHASE_CONFIGS
)

app = FastAPI(
    title="LandSlideX API",
    description="AI-Powered Landslide Risk Intelligence & Early Warning Platform (SIH 2026)",
    version="2.4.1"
)

# Enable CORS for frontend and PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Managers
class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

ws_telemetry_mgr = WebSocketManager()
ws_dashboard_mgr = WebSocketManager()
ws_alerts_mgr = WebSocketManager()

# ==========================================
# 1. AUTHENTICATION & USERS
# ==========================================
@app.post("/api/auth/login", response_model=UserResponse)
def login(creds: UserLoginRequest):
    user = next((u for u in USERS_DB if u["email"].lower() == creds.email.lower()), None)
    if not user or user["password_hash"] != creds.password:
        # For hackathon demo ease, allow demo login if demo password used or match found
        if creds.password in ["demo123", "GeoX@2026"]:
            # fallback to super admin or requested role
            user = USERS_DB[0]
        else:
            raise HTTPException(status_code=401, detail="Invalid email or password.")

    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        agency=user["agency"],
        district=user["district"],
        token=user["token"]
    )

@app.get("/api/users")
def get_users():
    return [{"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"], "agency": u["agency"], "district": u["district"]} for u in USERS_DB]

@app.post("/api/users")
def create_user(user_data: Dict[str, Any]):
    new_user = {
        "id": f"USR-{len(USERS_DB)+1:03d}",
        "name": user_data.get("name", "New Officer"),
        "email": user_data.get("email"),
        "password_hash": "demo123",
        "role": user_data.get("role", "Field Officer"),
        "agency": user_data.get("agency", "Disaster Agency"),
        "district": user_data.get("district", "NER Command"),
        "token": f"token-{len(USERS_DB)+1}"
    }
    USERS_DB.append(new_user)
    return new_user

# ==========================================
# 2. DASHBOARD SUMMARY & KPIS
# ==========================================
@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    zones_list = list(ZONES_DB.values())
    avg_risk = round(sum(z["risk_score"] for z in zones_list) / len(zones_list), 1)
    max_risk = max(z["risk_score"] for z in zones_list)

    active_alerts = [a for a in ALERTS_DB if a["status"] == "ACTIVE"]
    extreme_alerts_count = sum(1 for a in active_alerts if a["risk_level"] == "EXTREME")
    high_alerts_count = sum(1 for a in active_alerts if a["risk_level"] == "HIGH")

    online_sensors = sum(1 for s in SENSORS_DB if s["status"] == "ONLINE")
    critical_zones = [z for z in zones_list if z["risk_level"] in ["HIGH", "EXTREME"]]

    return {
        "system_status": "OPERATIONAL",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "kpis": {
            "overall_risk_score": max_risk,
            "overall_risk_level": "EXTREME" if max_risk >= 75 else ("HIGH" if max_risk >= 50 else "MODERATE"),
            "active_alerts_total": len(active_alerts),
            "active_alerts_extreme": extreme_alerts_count,
            "active_alerts_high": high_alerts_count,
            "monitored_zones_count": len(zones_list),
            "sensors_online": online_sensors,
            "sensors_total": len(SENSORS_DB),
            "critical_locations_count": len(critical_zones)
        },
        "critical_zones": critical_zones,
        "simulation_state": CURRENT_SIMULATION_STATE
    }

# ==========================================
# 3. RISK ZONES & GIS
# ==========================================
@app.get("/api/risk/zones")
def get_risk_zones():
    return list(ZONES_DB.values())

@app.get("/api/risk/zones/{zone_id}")
def get_zone_details(zone_id: str):
    zone = ZONES_DB.get(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    # Return evaluated risk with XAI explanation
    risk_info = evaluate_zone_risk(zone)
    return {"zone": zone, "risk_details": risk_info}

@app.get("/api/gis/zones")
def get_gis_zones_geojson():
    file_path = "gis/layers/ner_risk_zones.geojson"
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            data = json.load(f)
            # Sync dynamic risk scores from DB into GeoJSON properties
            for feat in data.get("features", []):
                zid = feat["properties"].get("zone_id")
                if zid in ZONES_DB:
                    z = ZONES_DB[zid]
                    feat["properties"]["risk_score"] = z["risk_score"]
                    feat["properties"]["risk_level"] = z["risk_level"]
                    feat["properties"]["rainfall_24h_mm"] = z["rainfall_24h_mm"]
                    feat["properties"]["soil_moisture_vwc"] = z["soil_moisture_vwc"]
                    feat["properties"]["trend"] = z["trend"]
            return data
    return {"type": "FeatureCollection", "features": []}

@app.get("/api/gis/highways")
def get_gis_highways():
    file_path = "gis/roads/ner_highways.geojson"
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}

@app.get("/api/gis/settlements")
def get_gis_settlements():
    file_path = "gis/villages/ner_settlements.geojson"
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}

@app.get("/api/gis/landslides")
def get_gis_landslides():
    file_path = "gis/landslide_inventory/gsi_historical_landslides.geojson"
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}

# ==========================================
# 4. AI PREDICTION & XAI EXPLANATIONS
# ==========================================
@app.get("/api/predictions")
def get_prediction_for_zone(zone_id: str = "NER-024"):
    zone = ZONES_DB.get(zone_id, ZONES_DB["NER-024"])
    risk_data = evaluate_zone_risk(zone)
    return {
        "zone_id": zone_id,
        "zone_name": zone["name"],
        "evaluation": risk_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ==========================================
# 5. SENSORS & TELEMETRY
# ==========================================
@app.get("/api/sensors")
def get_sensors(status_filter: Optional[str] = None):
    if status_filter:
        return [s for s in SENSORS_DB if s["status"].upper() == status_filter.upper()]
    return SENSORS_DB

@app.get("/api/sensors/{sensor_id}")
def get_sensor(sensor_id: str):
    s = next((s for s in SENSORS_DB if s["sensor_id"] == sensor_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return s

@app.get("/api/sensors/{sensor_id}/telemetry")
def get_sensor_telemetry_history(sensor_id: str):
    s = next((s for s in SENSORS_DB if s["sensor_id"] == sensor_id), SENSORS_DB[0])
    # Generate 12 historical time points (hourly)
    times = ["12h ago", "10h ago", "8h ago", "6h ago", "4h ago", "3h ago", "2h ago", "1h ago", "45m ago", "30m ago", "15m ago", "Now"]
    base_m = s["soil_moisture_vwc"]
    base_r = s["rainfall_24h_mm"]

    history = []
    for i, t in enumerate(times):
        prog = i / len(times)
        history.append({
            "time": t,
            "soil_moisture": round(max(20.0, base_m - (1.0 - prog) * 15.0), 1),
            "rainfall_accrual": round(max(0.0, base_r - (1.0 - prog) * 22.0), 1),
            "pore_pressure": round(s["pore_pressure_kpa"] - (1.0 - prog) * 6.0, 1),
            "tilt": round(s["tilt_deg"] * (0.4 + 0.6 * prog), 2),
            "battery": round(s["battery_pct"], 0)
        })
    return {"sensor": s, "telemetry_series": history}

# ==========================================
# 6. ALERTS & NOTIFICATIONS
# ==========================================
@app.get("/api/alerts")
def get_alerts():
    return ALERTS_DB

@app.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert_endpoint(alert_id: str, req: AlertAcknowledgeRequest):
    updated = acknowledge_alert(alert_id, req.acknowledged_by, req.notes)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found")
    await ws_alerts_mgr.broadcast({"type": "ALERT_ACKNOWLEDGED", "alert": updated})
    return updated

# ==========================================
# 7. INCIDENT REPORTING & FIELD OFFICER
# ==========================================
@app.get("/api/incidents")
def get_incidents():
    return INCIDENTS_DB

@app.post("/api/incidents")
async def create_incident(report: IncidentReportCreate):
    new_inc = {
        "incident_id": f"INC-2026-{len(INCIDENTS_DB)+1:03d}",
        "zone_id": report.zone_id,
        "location_name": report.location_name,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "incident_type": report.incident_type,
        "severity": report.severity,
        "description": report.description,
        "reported_by": report.reported_by,
        "reporter_role": report.reporter_role,
        "photo_url": report.photo_url or "/demo/crack_generic.jpg",
        "video_url": report.video_url,
        "status": "Submitted" if report.reporter_role == "Citizen" else "Verified",
        "verified_by": report.reported_by if report.reporter_role == "Field Officer" else None,
        "verification_notes": "Direct field officer observation" if report.reporter_role == "Field Officer" else None,
        "timestamp": "Just now"
    }
    INCIDENTS_DB.insert(0, new_inc)
    AUDIT_LOGS.insert(0, {
        "id": f"LOG-{len(AUDIT_LOGS)+101}",
        "timestamp": "Just now",
        "actor": report.reported_by,
        "action": f"Submitted Incident Report {new_inc['incident_id']} ({report.incident_type} at {report.location_name})",
        "status": "SUCCESS"
    })
    await ws_dashboard_mgr.broadcast({"type": "NEW_INCIDENT", "incident": new_inc})
    return new_inc

@app.post("/api/incidents/{incident_id}/verify")
async def verify_incident(incident_id: str, req: IncidentVerifyRequest):
    inc = next((i for i in INCIDENTS_DB if i["incident_id"] == incident_id), None)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    inc["status"] = req.status
    inc["verified_by"] = req.verified_by
    inc["verification_notes"] = req.verification_notes

    AUDIT_LOGS.insert(0, {
        "id": f"LOG-{len(AUDIT_LOGS)+101}",
        "timestamp": "Just now",
        "actor": req.verified_by,
        "action": f"Field Officer marked {incident_id} as {req.status}. Retraining queue updated.",
        "status": "SUCCESS"
    })
    await ws_dashboard_mgr.broadcast({"type": "INCIDENT_VERIFIED", "incident": inc})
    return inc

# ==========================================
# 8. RECOMMENDATION ACTIONS (SOP)
# ==========================================
@app.get("/api/recommendations")
def get_recommendations():
    return ACTIONS_DB

@app.post("/api/recommendations/{action_id}/status")
def update_action_status(action_id: str, payload: Dict[str, str]):
    act = next((a for a in ACTIONS_DB if a["action_id"] == action_id), None)
    if not act:
        raise HTTPException(status_code=404, detail="Action not found")
    act["status"] = payload.get("status", "IN_PROGRESS")
    return act

# ==========================================
# 9. ANALYTICS & REPORTS
# ==========================================
@app.get("/api/analytics")
def get_analytics():
    return {
        "false_alarm_rate_pct": 11.8,
        "verification_rate_pct": 88.2,
        "sensor_uptime_pct": 96.5,
        "mean_acknowledgement_time_min": 4.2,
        "monthly_incidents": [
            {"month": "Apr", "incidents": 4, "alerts": 7, "rainfall_avg": 42},
            {"month": "May", "incidents": 9, "alerts": 14, "rainfall_avg": 88},
            {"month": "Jun", "incidents": 26, "alerts": 38, "rainfall_avg": 240},
            {"month": "Jul", "incidents": 44, "alerts": 62, "rainfall_avg": 380},
            {"month": "Aug", "incidents": 38, "alerts": 55, "rainfall_avg": 310},
            {"month": "Sep", "incidents": 18, "alerts": 29, "rainfall_avg": 160}
        ],
        "risk_distribution": [
            {"level": "LOW", "count": 1, "color": "#10B981"},
            {"level": "MODERATE", "count": 2, "color": "#F59E0B"},
            {"level": "HIGH", "count": 2, "color": "#F97316"},
            {"level": "EXTREME", "count": 1, "color": "#EF4444"}
        ],
        "zone_comparison": [
            {"zone": "NER-024 Gangtok", "risk": ZONES_DB["NER-024"]["risk_score"], "moisture": ZONES_DB["NER-024"]["soil_moisture_vwc"]},
            {"zone": "NER-025 Rangpo", "risk": ZONES_DB["NER-025"]["risk_score"], "moisture": ZONES_DB["NER-025"]["soil_moisture_vwc"]},
            {"zone": "NER-026 Darjeeling", "risk": ZONES_DB["NER-026"]["risk_score"], "moisture": ZONES_DB["NER-026"]["soil_moisture_vwc"]},
            {"zone": "NER-027 Shillong", "risk": ZONES_DB["NER-027"]["risk_score"], "moisture": ZONES_DB["NER-027"]["soil_moisture_vwc"]},
            {"zone": "NER-028 Kohima", "risk": ZONES_DB["NER-028"]["risk_score"], "moisture": ZONES_DB["NER-028"]["soil_moisture_vwc"]},
            {"zone": "NER-029 Aizawl", "risk": ZONES_DB["NER-029"]["risk_score"], "moisture": ZONES_DB["NER-029"]["soil_moisture_vwc"]}
        ]
    }

# ==========================================
# 10. SIH SIMULATION CONTROLLER
# ==========================================
@app.post("/api/simulation/step")
async def simulation_step(req: SimulationStepRequest):
    result = execute_simulation_phase(req.phase, req.zone_id)
    # Broadcast to all connected command center sessions
    await ws_dashboard_mgr.broadcast({
        "type": "SIMULATION_PHASE_UPDATE",
        "data": result
    })
    if result.get("alert"):
        await ws_alerts_mgr.broadcast({
            "type": "NEW_ALERT_TRIGGERED",
            "alert": result["alert"]
        })
    return result

@app.post("/api/simulation/reset")
async def simulation_reset(req: SimulationResetRequest):
    result = reset_simulation(req.zone_id)
    await ws_dashboard_mgr.broadcast({
        "type": "SIMULATION_RESET",
        "data": result
    })
    return result

# ==========================================
# 11. ADMIN CONFIG & AUDIT LOGS
# ==========================================
@app.get("/api/admin/config")
def get_admin_config():
    return ADMIN_CONFIG

@app.post("/api/admin/config")
def update_admin_config(cfg: AdminConfig):
    ADMIN_CONFIG.update(cfg.model_dump())
    AUDIT_LOGS.insert(0, {
        "id": f"LOG-{len(AUDIT_LOGS)+101}",
        "timestamp": "Just now",
        "actor": "Super Admin",
        "action": f"Updated System Risk Thresholds: Low<{cfg.threshold_low}, Mod<{cfg.threshold_moderate}, High<{cfg.threshold_high}",
        "status": "SUCCESS"
    })
    return ADMIN_CONFIG

@app.get("/api/audit-logs")
def get_audit_logs():
    return AUDIT_LOGS

# ==========================================
# 12. OFFLINE SYNC ENDPOINT
# ==========================================
@app.post("/api/offline/sync")
async def offline_sync(events: List[Dict[str, Any]]):
    synced_count = 0
    for ev in events:
        if ev.get("type") == "INCIDENT_REPORT":
            data = ev.get("data", {})
            new_inc = {
                "incident_id": f"INC-SYNC-{len(INCIDENTS_DB)+1:03d}",
                "zone_id": data.get("zone_id", "NER-024"),
                "location_name": data.get("location_name", "Field Inspection Point"),
                "latitude": data.get("latitude", 27.34),
                "longitude": data.get("longitude", 88.61),
                "incident_type": data.get("incident_type", "Ground Crack"),
                "severity": data.get("severity", "MODERATE"),
                "description": data.get("description", "Recorded in offline field inspection mode."),
                "reported_by": data.get("reported_by", "Field Officer Bhutia"),
                "reporter_role": "Field Officer",
                "photo_url": data.get("photo_url", "/demo/crack_burtuk.jpg"),
                "status": "Verified",
                "verified_by": data.get("reported_by", "Field Officer Bhutia"),
                "verification_notes": "Offline field inspection verified and synchronized upon network reconnection.",
                "timestamp": "Synchronized just now"
            }
            INCIDENTS_DB.insert(0, new_inc)
            synced_count += 1

    return {
        "status": "SYNCHRONIZATION_SUCCESS",
        "events_synced": synced_count,
        "message": f"{synced_count} field events synchronized successfully."
    }

# ==========================================
# 13. WEBSOCKET ENDPOINTS
# ==========================================
@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    await ws_telemetry_mgr.connect(websocket)
    try:
        while True:
            # Send live telemetry updates every 3 seconds
            await asyncio.sleep(3.0)
            # Pick a dynamic sensor reading to simulate real-time packet
            await websocket.send_json({
                "type": "SENSOR_TELEMETRY_STREAM",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "sensors": SENSORS_DB[:10]
            })
    except WebSocketDisconnect:
        ws_telemetry_mgr.disconnect(websocket)

@app.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    await ws_dashboard_mgr.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or handle incoming client ping
    except WebSocketDisconnect:
        ws_dashboard_mgr.disconnect(websocket)

@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await ws_alerts_mgr.connect(websocket)
    try:
        while True:
            await asyncio.sleep(10.0)
    except WebSocketDisconnect:
        ws_alerts_mgr.disconnect(websocket)

# Health check
@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "LandSlideX Backend",
        "version": "v2.4.1-SIH2026",
        "database": "ONLINE",
        "ml_engine": "ONLINE",
        "sensor_gateway": "ONLINE",
        "alert_service": "ONLINE"
    }

# ==========================================
# 14. FRONTEND STATIC ASSETS & SPA SERVING
# ==========================================
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))

# Mount frontend directory for static assets
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/app.js")
def get_app_js():
    return FileResponse(os.path.join(frontend_path, "app.js"))

@app.get("/app.css")
def get_app_css():
    return FileResponse(os.path.join(frontend_path, "app.css"))

@app.get("/manifest.json")
def get_manifest():
    return FileResponse(os.path.join(frontend_path, "public", "manifest.json"))

@app.get("/service-worker.js")
def get_service_worker():
    return FileResponse(os.path.join(frontend_path, "public", "service-worker.js"))

# SPA Fallback for all public and dashboard paths
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    # Check if a direct file exists in frontend
    candidate = os.path.join(frontend_path, full_path)
    if os.path.isfile(candidate):
        return FileResponse(candidate)
    return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
