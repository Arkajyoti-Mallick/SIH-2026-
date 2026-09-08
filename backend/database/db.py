"""
In-Memory / SQLite-ready Datastore for LandSlideX
Contains rich baseline and simulation state for NER disaster operations.
"""

from datetime import datetime, timezone
import json
import os
from typing import Dict, List, Any

def get_iso_now():
    return datetime.now(timezone.utc).isoformat()

# Seed Users with RBAC
USERS_DB = [
    {
        "id": "USR-001",
        "name": "Col. Rajesh Verma",
        "email": "admin@landslidex.gov.in",
        "password_hash": "demo123",
        "role": "Super Admin",
        "agency": "National Disaster Management Authority (NDMA)",
        "district": "National Command HQ",
        "token": "token-admin-geo-x"
    },
    {
        "id": "USR-002",
        "name": "Dr. Pema Wangchuk, IAS",
        "email": "dc.gangtok@sikkim.gov.in",
        "password_hash": "demo123",
        "role": "District Administrator",
        "agency": "East Sikkim District Collectorate",
        "district": "Gangtok / Pakyong",
        "token": "token-dc-sikkim"
    },
    {
        "id": "USR-003",
        "name": "Major Arvind Joshi",
        "email": "dmo.ner@ndma.gov.in",
        "password_hash": "demo123",
        "role": "Disaster Management Officer",
        "agency": "Sikkim State Disaster Management Authority (SSDMA)",
        "district": "North-East Operations",
        "token": "token-dmo-ner"
    },
    {
        "id": "USR-004",
        "name": "Sub-Inspector Tsering Bhutia",
        "email": "field.officer@bro.gov.in",
        "password_hash": "demo123",
        "role": "Field Officer",
        "agency": "Border Roads Organisation (Project Swastik)",
        "district": "NH-10 Corridor Burtuk Sector",
        "token": "token-field-bro"
    },
    {
        "id": "USR-005",
        "name": "Ananya Sharma",
        "email": "control.room@ddma.gov.in",
        "password_hash": "demo123",
        "role": "Operator",
        "agency": "Gangtok District Emergency Operation Centre (DEOC)",
        "district": "Gangtok Command Desk",
        "token": "token-op-ner"
    },
    {
        "id": "USR-006",
        "name": "Tashi Lepcha",
        "email": "citizen.reporter@gmail.com",
        "password_hash": "demo123",
        "role": "Citizen",
        "agency": "Community First Responder",
        "district": "Burtuk Ward 4",
        "token": "token-citizen-lepcha"
    }
]

# Baseline Zones
ZONES_DB = {
    "NER-024": {
        "zone_id": "NER-024",
        "name": "Gangtok North Corridor (Burtuk-Penlong)",
        "state": "Sikkim",
        "district": "East Sikkim",
        "highway": "NH-10 Spur / Dikchu Road",
        "risk_score": 32.0,
        "risk_level": "MODERATE",
        "confidence": 91.0,
        "slope_deg": 38.5,
        "elevation_m": 1650.0,
        "rainfall_24h_mm": 34.5,
        "soil_moisture_vwc": 51.0,
        "pore_pressure_kpa": 12.0,
        "trend": "STABLE",
        "population_exposed": 12400,
        "sensors_online": 8,
        "sensors_total": 8,
        "recommended_action": "Routine slope surveillance, monitor Burtuk drainage runoff.",
        "coordinates": [27.3389, 88.6065]
    },
    "NER-025": {
        "zone_id": "NER-025",
        "name": "Rangpo Teesta Valley Gorge",
        "state": "Sikkim",
        "district": "Pakyong",
        "highway": "NH-10 National Lifeline",
        "risk_score": 68.0,
        "risk_level": "HIGH",
        "confidence": 88.0,
        "slope_deg": 44.0,
        "elevation_m": 350.0,
        "rainfall_24h_mm": 72.4,
        "soil_moisture_vwc": 67.3,
        "pore_pressure_kpa": 22.8,
        "trend": "INCREASING",
        "population_exposed": 8900,
        "sensors_online": 6,
        "sensors_total": 7,
        "recommended_action": "Deploy field verification team, restrict heavy vehicles on NH-10.",
        "coordinates": [27.1767, 88.5342]
    },
    "NER-026": {
        "zone_id": "NER-026",
        "name": "Darjeeling Paglajhora Hill Cart Corridor",
        "state": "West Bengal (NER Belt)",
        "district": "Darjeeling",
        "highway": "NH-55 / Rohini Road",
        "risk_score": 34.0,
        "risk_level": "MODERATE",
        "confidence": 89.0,
        "slope_deg": 36.2,
        "elevation_m": 1420.0,
        "rainfall_24h_mm": 38.0,
        "soil_moisture_vwc": 48.6,
        "pore_pressure_kpa": 11.4,
        "trend": "STABLE",
        "population_exposed": 15600,
        "sensors_online": 5,
        "sensors_total": 6,
        "recommended_action": "Maintain routine hourly sensor polling.",
        "coordinates": [27.0410, 88.2663]
    },
    "NER-027": {
        "zone_id": "NER-027",
        "name": "Shillong Peak Escarpment",
        "state": "Meghalaya",
        "district": "East Khasi Hills",
        "highway": "Shillong Bypass",
        "risk_score": 18.0,
        "risk_level": "LOW",
        "confidence": 94.0,
        "slope_deg": 28.0,
        "elevation_m": 1965.0,
        "rainfall_24h_mm": 18.5,
        "soil_moisture_vwc": 32.1,
        "pore_pressure_kpa": 6.8,
        "trend": "STABLE",
        "population_exposed": 31200,
        "sensors_online": 8,
        "sensors_total": 8,
        "recommended_action": "Continue normal surveillance schedule.",
        "coordinates": [25.5788, 88.8933]
    },
    "NER-028": {
        "zone_id": "NER-028",
        "name": "Kohima Pagala Pahar Sinking Zone",
        "state": "Nagaland",
        "district": "Kohima",
        "highway": "NH-29 Dimapur-Kohima Corridor",
        "risk_score": 79.0,
        "risk_level": "EXTREME",
        "confidence": 93.0,
        "slope_deg": 41.5,
        "elevation_m": 1444.0,
        "rainfall_24h_mm": 88.4,
        "soil_moisture_vwc": 76.2,
        "pore_pressure_kpa": 28.6,
        "trend": "INCREASING",
        "population_exposed": 18500,
        "sensors_online": 7,
        "sensors_total": 8,
        "recommended_action": "Immediate emergency inspection, initiate NH-29 traffic diversion via Tsiesema.",
        "coordinates": [25.6751, 94.1086]
    },
    "NER-029": {
        "zone_id": "NER-029",
        "name": "Aizawl Chite Valley Slope Basin",
        "state": "Mizoram",
        "district": "Aizawl",
        "highway": "Aizawl-Lunglei Highway",
        "risk_score": 52.0,
        "risk_level": "HIGH",
        "confidence": 87.0,
        "slope_deg": 39.0,
        "elevation_m": 1132.0,
        "rainfall_24h_mm": 58.7,
        "soil_moisture_vwc": 61.4,
        "pore_pressure_kpa": 18.9,
        "trend": "INCREASING",
        "population_exposed": 22300,
        "sensors_online": 5,
        "sensors_total": 6,
        "recommended_action": "Verify slope retaining walls and inspect drainage outfalls.",
        "coordinates": [23.7271, 92.7176]
    }
}

# 48 IoT Sensors across NER
SENSORS_DB = []
_sensor_locations = [
    ("NER-024", "Burtuk Upper Ridge Inclinometer", 27.3450, 88.6080),
    ("NER-024", "Penlong Culvert Piezometer", 27.3510, 88.6150),
    ("NER-024", "Burtuk Basti Moisture Node A", 27.3410, 88.6020),
    ("NER-024", "Burtuk Basti Moisture Node B", 27.3390, 88.6050),
    ("NER-024", "NH-10 Spur Optical Extensometer", 27.3480, 88.6110),
    ("NER-024", "Lower Burtuk Stream Rain Gauge", 27.3360, 88.5980),
    ("NER-024", "Dikchu Approach Tilt Sensor", 27.3550, 88.6220),
    ("NER-024", "Burtuk Helipad Seismic Acoustic Node", 27.3430, 88.6040),

    ("NER-025", "Rangpo 29th Mile Tipping Bucket", 27.1740, 88.5280),
    ("NER-025", "Teesta Basin Pore Pressure Probe", 27.1810, 88.5390),
    ("NER-025", "Rangpo Checkpost Triaxial Inclinometer", 27.1710, 88.5240),
    ("NER-025", "Mining Ground VWC Depth Array", 27.1850, 88.5440),
    ("NER-025", "NH-10 Retaining Wall Displacement Sensor", 27.1770, 88.5320),
    ("NER-025", "Rangpo Bazar Micro-weather Station", 27.1790, 88.5360),
    ("NER-025", "Likuvir Escarpment Tilt Node", 27.1890, 88.5480),

    ("NER-028", "Pagala Pahar NH-29 Inclinometer 1", 25.6680, 94.0980),
    ("NER-028", "Pagala Pahar NH-29 Inclinometer 2", 25.6720, 94.1050),
    ("NER-028", "Peducha Bridge Piezometer Array", 25.6810, 94.1180),
    ("NER-028", "Chumukedima High-volume Rain Gauge", 25.6630, 94.0910),
    ("NER-028", "Sinking Zone Displacement Cable Node", 25.6760, 94.1120),
    ("NER-028", "Tsiesema Bypass Slope Stability Node", 25.6890, 94.1250),
    ("NER-028", "Sechu Zubza Pore Pressure Piezometer", 25.6790, 94.1150),
    ("NER-028", "Old Chumukedima Optical Tilt Unit", 25.6650, 94.0950),

    ("NER-026", "Paglajhora Slump Gauge", 27.0380, 88.2580),
    ("NER-026", "Hill Cart Road Tilt Sensor A", 27.0430, 88.2690),
    ("NER-026", "Toy Train Track Laser Extensometer", 27.0400, 88.2640),
    ("NER-026", "Kurseong South Moisture Array", 27.0340, 88.2510),
    ("NER-026", "Mahanadi Drainage Flow Meter", 27.0460, 88.2720),
    ("NER-026", "Tindharia Upper Ridge Accelerometer", 27.0310, 88.2480),

    ("NER-027", "Shillong Peak AWS Rain Gauge", 25.5720, 88.8850),
    ("NER-027", "Upper Shillong Infiltration Probe", 25.5810, 88.8980),
    ("NER-027", "Laitkor Ridge Borehole Tiltmeter", 25.5860, 88.9050),
    ("NER-027", "Elephanta Falls Stream Level Radar", 25.5680, 88.8780),
    ("NER-027", "Happy Valley Deep Soil Probe", 25.5750, 88.8910),
    ("NER-027", "Shillong Bypass Ground Anchor Load Cell", 25.5920, 88.9120),
    ("NER-027", "Mawkdok Dympep Escarpment Node", 25.5620, 88.8710),
    ("NER-027", "Cherrapunji Ridge Telemetry Array", 25.5650, 88.8740),

    ("NER-029", "Chite River Escarpment Piezometer", 23.7220, 92.7110),
    ("NER-029", "Aizawl High School Slope Sensor", 23.7290, 92.7210),
    ("NER-029", "Melthum Quarry Inclinometer", 23.7190, 92.7080),
    ("NER-029", "Sihhmui Road Retaining Wall Tilt Node", 23.7340, 92.7280),
    ("NER-029", "Durtlang Hills Acoustic Displacement Unit", 23.7380, 92.7350),
    ("NER-029", "Bawngkawn Junction Soil Moisture Probe", 23.7250, 92.7160)
]

for idx, (z_id, loc_name, lat, lng) in enumerate(_sensor_locations, 1):
    s_id = f"S-{idx:03d}"
    is_online = (idx not in [7, 14, 22, 29, 42]) # 43 online, 5 maintenance
    health = "Healthy" if is_online else ("Warning" if idx == 7 else "Offline")
    status = "ONLINE" if is_online else ("WARNING" if idx == 7 else "OFFLINE")

    # Baseline sensor readings
    soil_m = 52.0 + (idx % 15)
    rain_val = 35.0 + (idx % 25)
    temp_val = 22.5 + (idx % 5)
    batt = 94.0 - (idx % 20)

    SENSORS_DB.append({
        "sensor_id": s_id,
        "zone_id": z_id,
        "location_name": loc_name,
        "latitude": lat,
        "longitude": lng,
        "soil_moisture_vwc": round(soil_m, 1),
        "rainfall_24h_mm": round(rain_val, 1),
        "temperature_c": round(temp_val, 1),
        "battery_pct": round(batt, 0),
        "signal_strength": "Strong" if is_online else ("Medium" if idx == 7 else "None"),
        "health": health,
        "status": status,
        "tilt_deg": round(0.12 + (idx * 0.03), 2),
        "pore_pressure_kpa": round(12.5 + (idx * 0.4), 1),
        "last_updated": "12 sec ago"
    })

# Active Alerts
ALERTS_DB = [
    {
        "alert_id": "ALERT-NER028-01",
        "zone_id": "NER-028",
        "zone_name": "Kohima Pagala Pahar Sinking Zone",
        "risk_level": "EXTREME",
        "risk_score": 79.0,
        "confidence": 93.0,
        "cause": "Continuous torrential precipitation (88.4mm), critical pore pressure (28.6 kPa), and active tilt movement along NH-29.",
        "timestamp": "8 minutes ago",
        "status": "ACTIVE",
        "acknowledged_by": None,
        "acknowledged_at": None,
        "nearby_roads": "NH-29 (Dimapur-Kohima Road)",
        "nearby_villages": "Peducha Old Village, Old Chumukedima",
        "recommended_action": "Immediate emergency inspection, initiate NH-29 traffic diversion via Tsiesema, notify DDMA Kohima.",
        "delivery_status": {
            "sms": "DELIVERED",
            "push": "DELIVERED",
            "email": "DELIVERED",
            "ivr": "SIMULATED",
            "siren": "TRIGGERED"
        }
    },
    {
        "alert_id": "ALERT-NER025-02",
        "zone_id": "NER-025",
        "zone_name": "Rangpo Teesta Valley Gorge",
        "risk_level": "HIGH",
        "risk_score": 68.0,
        "confidence": 88.0,
        "cause": "Rapid riverbank toe erosion and soil saturation crossing 67% VWC threshold.",
        "timestamp": "24 minutes ago",
        "status": "ACKNOWLEDGED",
        "acknowledged_by": "Major Arvind Joshi (DMO)",
        "acknowledged_at": "18 minutes ago",
        "nearby_roads": "NH-10 Corridor",
        "nearby_villages": "Rangpo Bazar Riverside, Mining Ground",
        "recommended_action": "Deploy field verification team, restrict heavy vehicles on NH-10, alert BRO.",
        "delivery_status": {
            "sms": "DELIVERED",
            "push": "DELIVERED",
            "email": "DELIVERED",
            "ivr": "DELIVERED",
            "siren": "STANDBY"
        }
    }
]

# Incident Reports (Citizen & Field Officer)
INCIDENTS_DB = [
    {
        "incident_id": "INC-2026-001",
        "zone_id": "NER-024",
        "location_name": "Burtuk Senior Secondary School Slope",
        "latitude": 27.3465,
        "longitude": 88.6085,
        "incident_type": "Ground Crack",
        "severity": "MODERATE",
        "description": "Observed longitudinal tension crack 4.5 meters in length along the upper playground retaining wall after last night's rainfall.",
        "reported_by": "Tashi Lepcha (Citizen)",
        "reporter_role": "Citizen",
        "photo_url": "/demo/crack_burtuk.jpg",
        "video_url": None,
        "status": "Verified",
        "verified_by": "Sub-Inspector Tsering Bhutia (BRO)",
        "verification_notes": "Crack verified on site. Width is 35mm. Water seepage evident. Sandbag drainage diverted.",
        "timestamp": "Today, 08:30 AM"
    },
    {
        "incident_id": "INC-2026-002",
        "zone_id": "NER-028",
        "location_name": "Pagala Pahar Mile 14 Bend",
        "latitude": 25.6720,
        "longitude": 94.1050,
        "incident_type": "Slope Movement",
        "severity": "CRITICAL",
        "description": "Massive mud slump sliding onto NH-29 downhill carriageway. Multiple boulders dislodged.",
        "reported_by": "Sub-Inspector Tsering Bhutia (BRO)",
        "reporter_role": "Field Officer",
        "photo_url": "/demo/pagala_pahar_slump.jpg",
        "video_url": None,
        "status": "Verified",
        "verified_by": "Major Arvind Joshi (DMO)",
        "verification_notes": "Emergency bulldozer deployed. Carriageway restricted to one-way escort convoy.",
        "timestamp": "Today, 10:15 AM"
    },
    {
        "incident_id": "INC-2026-003",
        "zone_id": "NER-025",
        "location_name": "Rangpo Checkpost Escarpment",
        "latitude": 27.1780,
        "longitude": 88.5320,
        "incident_type": "Rockfall",
        "severity": "HIGH",
        "description": "Intermittent rockfall falling into road drainage gutter. Wire mesh netting sagging under load.",
        "reported_by": "Local Taxi Drivers Union",
        "reporter_role": "Citizen",
        "photo_url": "/demo/rockfall_rangpo.jpg",
        "video_url": None,
        "status": "Under Review",
        "verified_by": None,
        "verification_notes": None,
        "timestamp": "Today, 11:45 AM"
    }
]

# Action Recommendations (SOP Matrix)
ACTIONS_DB = [
    {
        "action_id": "ACT-001",
        "zone_id": "NER-028",
        "zone_name": "Kohima Pagala Pahar Sinking Zone",
        "priority": "EMERGENCY",
        "title": "NH-29 Emergency Traffic Diversion via Tsiesema",
        "description": "Enforce immediate heavy vehicle prohibition on Pagala Pahar sector. Re-route emergency light vehicles via Tsiesema rural bypass.",
        "responsible_agency": "Nagaland Traffic Police & BRO",
        "sop_code": "SOP-DIS-NER-L3",
        "status": "IN_PROGRESS"
    },
    {
        "action_id": "ACT-002",
        "zone_id": "NER-025",
        "zone_name": "Rangpo Teesta Valley Gorge",
        "priority": "WARNING",
        "title": "BRO Toe Scour Inspection & Wire-Crate Gabion Reinforcement",
        "description": "Inspect Teesta riverside toe retaining walls at 29th Mile. Position emergency excavator on standby at Rangpo depot.",
        "responsible_agency": "Border Roads Organisation (Project Swastik)",
        "sop_code": "SOP-ENG-BRO-44",
        "status": "PENDING"
    },
    {
        "action_id": "ACT-003",
        "zone_id": "NER-024",
        "zone_name": "Gangtok North Corridor",
        "priority": "ADVISORY",
        "title": "Clear Burtuk Basti Drainage Outfalls & Culverts",
        "description": "Deploy municipal road gangs to remove debris and silt blockages in natural drainage chutes above Burtuk school.",
        "responsible_agency": "Gangtok Municipal Corporation & PWD",
        "sop_code": "SOP-CIV-GMC-12",
        "status": "COMPLETED"
    }
]

# Admin System Config
ADMIN_CONFIG = {
    "threshold_low": 25,
    "threshold_moderate": 50,
    "threshold_high": 75,
    "threshold_extreme": 100,
    "sms_alerts_enabled": True,
    "push_alerts_enabled": True,
    "siren_automation_enabled": True,
    "auto_escalation_minutes": 15,
    "active_model_version": "v2.4.1-SIH2026",
    "google_maps_api_key": os.getenv("GOOGLE_MAPS_API_KEY", "")
}

# Audit Logs
AUDIT_LOGS = [
    {"id": "LOG-101", "timestamp": "Today, 11:55 AM", "actor": "System Alert Engine", "action": "Triggered Multi-Channel Early Warning for Zone NER-028 (Score 79)", "status": "SUCCESS"},
    {"id": "LOG-102", "timestamp": "Today, 11:32 AM", "actor": "Major Arvind Joshi", "action": "Acknowledged ALERT-NER025-02 for Rangpo Gorge", "status": "SUCCESS"},
    {"id": "LOG-103", "timestamp": "Today, 10:40 AM", "actor": "Col. Rajesh Verma", "action": "Updated risk threshold calibration for Western Sikkim Zone NER-025", "status": "SUCCESS"},
    {"id": "LOG-104", "timestamp": "Today, 09:15 AM", "actor": "Sub-Inspector Tsering Bhutia", "action": "Verified Citizen Incident INC-2026-001 at Burtuk Basti", "status": "SUCCESS"}
]
