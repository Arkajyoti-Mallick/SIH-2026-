"""
Alert Management Service for LandSlideX
Handles alert generation, delivery tracking, escalation, and human acknowledgement.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.database.db import ALERTS_DB, AUDIT_LOGS, ADMIN_CONFIG
from backend.services.notification_service import dispatch_early_warning_notifications

def create_alert_for_zone(zone: Dict[str, Any], risk_data: Dict[str, Any]) -> Dict[str, Any]:
    now_str = "Just now"
    alert_id = f"ALERT-{zone['zone_id']}-{len(ALERTS_DB)+1:02d}"

    # Check if active alert already exists for this zone
    for a in ALERTS_DB:
        if a["zone_id"] == zone["zone_id"] and a["status"] == "ACTIVE":
            # Update existing alert
            a["risk_score"] = risk_data["risk_score"]
            a["risk_level"] = risk_data["risk_level"]
            a["confidence"] = risk_data["confidence"]
            a["cause"] = risk_data["ai_explanation"]
            a["recommended_action"] = risk_data["recommended_action"]
            a["timestamp"] = now_str
            return a

    # Deliver notifications
    delivery = dispatch_early_warning_notifications({
        "zone_id": zone["zone_id"],
        "zone_name": zone["name"],
        "risk_level": risk_data["risk_level"],
        "risk_score": risk_data["risk_score"]
    })

    alert = {
        "alert_id": alert_id,
        "zone_id": zone["zone_id"],
        "zone_name": zone["name"],
        "risk_level": risk_data["risk_level"],
        "risk_score": risk_data["risk_score"],
        "confidence": risk_data["confidence"],
        "cause": risk_data["ai_explanation"],
        "timestamp": now_str,
        "status": "ACTIVE",
        "acknowledged_by": None,
        "acknowledged_at": None,
        "nearby_roads": zone.get("highway", "Transit Highway"),
        "nearby_villages": f"{zone['district']} Settlements",
        "recommended_action": risk_data["recommended_action"],
        "delivery_status": {
            "sms": delivery["sms"]["status"],
            "push": delivery["push"]["status"],
            "email": delivery["email"]["status"],
            "ivr": delivery["ivr"]["status"],
            "siren": delivery["siren"]["status"]
        }
    }

    ALERTS_DB.insert(0, alert)

    # Log to audit trail
    AUDIT_LOGS.insert(0, {
        "id": f"LOG-{len(AUDIT_LOGS)+101}",
        "timestamp": datetime.now(timezone.utc).strftime("%H:%M UTC"),
        "actor": "LandSlideX AI Alert Engine",
        "action": f"Generated {risk_data['risk_level']} Early Warning {alert_id} for {zone['name']} (Score: {risk_data['risk_score']})",
        "status": "SUCCESS"
    })

    return alert

def acknowledge_alert(alert_id: str, acknowledged_by: str, notes: str = "") -> Optional[Dict[str, Any]]:
    for a in ALERTS_DB:
        if a["alert_id"] == alert_id:
            a["status"] = "ACKNOWLEDGED"
            a["acknowledged_by"] = acknowledged_by
            a["acknowledged_at"] = "Just now"

            AUDIT_LOGS.insert(0, {
                "id": f"LOG-{len(AUDIT_LOGS)+101}",
                "timestamp": datetime.now(timezone.utc).strftime("%H:%M UTC"),
                "actor": acknowledged_by,
                "action": f"Acknowledged {alert_id}. Notes: {notes or 'Official field review initiated.'}",
                "status": "SUCCESS"
            })
            return a
    return None
