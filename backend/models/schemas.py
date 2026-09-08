"""
Pydantic Schemas for LandSlideX API
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Auth & User
class UserLoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    agency: str
    district: str
    token: str

# Risk Zones
class RiskZone(BaseModel):
    zone_id: str
    name: str
    state: str
    district: str
    highway: str
    risk_score: float
    risk_level: str
    confidence: float
    slope_deg: float
    elevation_m: float
    rainfall_24h_mm: float
    soil_moisture_vwc: float
    pore_pressure_kpa: float
    trend: str
    population_exposed: int
    sensors_online: int
    sensors_total: int
    recommended_action: str
    coordinates: List[float] # [lat, lng] center

# Telemetry
class SensorTelemetry(BaseModel):
    sensor_id: str
    zone_id: str
    location_name: str
    soil_moisture_vwc: float
    rainfall_24h_mm: float
    temperature_c: float
    battery_pct: float
    signal_strength: str
    health: str
    status: str
    tilt_deg: float
    pore_pressure_kpa: float
    last_updated: str

# Weather
class WeatherReading(BaseModel):
    zone_id: str
    location: str
    rainfall_current_mmh: float
    rainfall_24h_mm: float
    rainfall_forecast_48h_mm: float
    humidity_pct: float
    temperature_c: float
    wind_kmh: float
    cloud_cover_pct: int
    pressure_hpa: float
    condition: str
    updated_at: str

# Alerts
class AlertItem(BaseModel):
    alert_id: str
    zone_id: str
    zone_name: str
    risk_level: str
    risk_score: float
    confidence: float
    cause: str
    timestamp: str
    status: str # ACTIVE, ACKNOWLEDGED, RESOLVED
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[str] = None
    nearby_roads: str
    nearby_villages: str
    recommended_action: str
    delivery_status: Dict[str, str] # {"sms": "DELIVERED", "push": "DELIVERED", "email": "DELIVERED", "ivr": "SIMULATED", "siren": "TRIGGERED"}

class AlertAcknowledgeRequest(BaseModel):
    alert_id: str
    acknowledged_by: str
    notes: Optional[str] = ""

# Incidents
class IncidentReportCreate(BaseModel):
    zone_id: str
    location_name: str
    latitude: float
    longitude: float
    incident_type: str # Ground Crack, Slope Movement, Rockfall, Road Blockage, Landslide, Other
    severity: str # LOW, MODERATE, HIGH, CRITICAL
    description: str
    reported_by: str
    reporter_role: str
    photo_url: Optional[str] = None
    video_url: Optional[str] = None

class IncidentReport(IncidentReportCreate):
    incident_id: str
    status: str # Submitted, Under Review, Verified, Rejected, Resolved
    verified_by: Optional[str] = None
    verification_notes: Optional[str] = None
    timestamp: str

class IncidentVerifyRequest(BaseModel):
    incident_id: str
    status: str # Verified, Rejected
    verified_by: str
    verification_notes: str
    confirm_as_training_sample: bool = True

# Recommendations
class ActionRecommendation(BaseModel):
    action_id: str
    zone_id: str
    zone_name: str
    priority: str # LOW, ADVISORY, WARNING, EMERGENCY
    title: str
    description: str
    responsible_agency: str
    sop_code: str
    status: str # PENDING, IN_PROGRESS, COMPLETED

# Simulation
class SimulationStepRequest(BaseModel):
    phase: int = Field(..., ge=1, le=5)
    zone_id: str = "NER-024"

class SimulationResetRequest(BaseModel):
    zone_id: str = "NER-024"

# Admin Config
class AdminConfig(BaseModel):
    threshold_low: int = 25
    threshold_moderate: int = 50
    threshold_high: int = 75
    threshold_extreme: int = 100
    sms_alerts_enabled: bool = True
    push_alerts_enabled: bool = True
    siren_automation_enabled: bool = True
    auto_escalation_minutes: int = 15
    active_model_version: str = "v2.4.1-SIH2026"
    google_maps_api_key: Optional[str] = ""
