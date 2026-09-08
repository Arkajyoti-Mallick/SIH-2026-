"""
Notification Simulation Service for LandSlideX
Simulates multi-channel early warning dispatch: SMS, Push, Email, IVR Voice Broadcast, and Physical Siren Activation.
"""

from datetime import datetime, timezone
from typing import Dict, Any

def dispatch_early_warning_notifications(alert_item: Dict[str, Any]) -> Dict[str, Any]:
    now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
    zone_name = alert_item.get("zone_name", "Monitored Zone")
    level = alert_item.get("risk_level", "HIGH")
    score = alert_item.get("risk_score", 75)

    # Multi-channel simulation receipts
    delivery = {
        "sms": {
            "status": "DELIVERED",
            "recipients_count": 4850,
            "target_gateway": "NIC / C-DOT CAP Gateway (NER Cell)",
            "message_preview": f"[LANDSLIDEX ALERT] {level} Risk ({score}/100) detected in {zone_name}. Stay alert. Follow DDMA advisories.",
            "dispatched_at": now_str
        },
        "push": {
            "status": "DELIVERED",
            "devices_reached": 6240,
            "channel": "FCM / Apple APNs Government Emergency Broadcast",
            "dispatched_at": now_str
        },
        "email": {
            "status": "DELIVERED",
            "officials_contacted": 34,
            "target": "District Magistrate, SP, BRO Chief Engineer, SSDMA Nodal Officer",
            "dispatched_at": now_str
        },
        "ivr": {
            "status": "SIMULATED",
            "calls_initiated": 120,
            "language": "Hindi, Nepali, English, Nagamese",
            "dispatched_at": now_str
        },
        "siren": {
            "status": "TRIGGERED" if level == "EXTREME" else "STANDBY",
            "tower_id": f"SIREN-TOWER-{alert_item.get('zone_id', 'NER024')}",
            "decibel_rating": "130 dB High Acoustic Range (3.5 km radius)",
            "dispatched_at": now_str if level == "EXTREME" else None
        }
    }

    return delivery
