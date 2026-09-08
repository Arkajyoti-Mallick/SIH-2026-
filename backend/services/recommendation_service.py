"""
Recommendation Service for LandSlideX
Evaluates SOP protocols based on Risk Score, Vulnerability, and Infrastructure exposure.
"""

from typing import Dict, Any, List

def generate_sop_recommendations(zone: Dict[str, Any], risk_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    level = risk_data.get("risk_level", "MODERATE")
    zone_id = zone.get("zone_id", "NER-024")
    zone_name = zone.get("name", "Zone")
    highway = zone.get("highway", "Transit Highway")

    actions = []

    if level == "EXTREME":
        actions.append({
            "action_id": f"ACT-EMERG-{zone_id}",
            "zone_id": zone_id,
            "zone_name": zone_name,
            "priority": "EMERGENCY",
            "title": f"Activate Immediate Emergency Corridor Restriction on {highway}",
            "description": f"Halt non-essential freight traffic. Establish traffic holding zones. Deploy emergency spotters equipped with wireless sat-radios.",
            "responsible_agency": "District Administration, Traffic Police & BRO",
            "sop_code": "SOP-NER-L3-TRAFFIC",
            "status": "PENDING"
        })
        actions.append({
            "action_id": f"ACT-SHELTER-{zone_id}",
            "zone_id": zone_id,
            "zone_name": zone_name,
            "priority": "EMERGENCY",
            "title": "Open Designated Hillside Relief Shelters & Alert Medical Teams",
            "description": "Prepare primary community halls and school shelters with emergency rations, generators, and first responder teams.",
            "responsible_agency": "SDMA Relief Commissioner & Health Dept",
            "sop_code": "SOP-NER-L3-EVAC",
            "status": "PENDING"
        })
    elif level == "HIGH":
        actions.append({
            "action_id": f"ACT-FIELD-{zone_id}",
            "zone_id": zone_id,
            "zone_name": zone_name,
            "priority": "WARNING",
            "title": f"Deploy Technical Field Inspection Team to {zone_name}",
            "description": f"Inspect tension cracks, drainage culvert blockages, and retaining wall displacement along critical stretches.",
            "responsible_agency": "State PWD / BRO Project Engineers",
            "sop_code": "SOP-NER-L2-INSPECT",
            "status": "PENDING"
        })
        actions.append({
            "action_id": f"ACT-EQUIP-{zone_id}",
            "zone_id": zone_id,
            "zone_name": zone_name,
            "priority": "WARNING",
            "title": "Pre-position Earthmoving Machinery at Strategic Road Junctures",
            "description": "Place wheel loaders, bulldozers, and recovery cranes at forward staging depots within 15 minutes response time.",
            "responsible_agency": "Border Roads Organisation (Swastik/Sewak)",
            "sop_code": "SOP-NER-L2-HEAVYEQ",
            "status": "PENDING"
        })
    elif level == "MODERATE":
        actions.append({
            "action_id": f"ACT-POLL-{zone_id}",
            "zone_id": zone_id,
            "zone_name": zone_name,
            "priority": "ADVISORY",
            "title": "Increase IoT Sensor Polling Frequency to 2 Minutes",
            "description": "Switch borehole piezometers, rain gauges, and optical extensometers from hourly polling to 2-minute real-time telemetry streaming.",
            "responsible_agency": "DEOC Monitoring Desk",
            "sop_code": "SOP-NER-L1-POLL",
            "status": "IN_PROGRESS"
        })
    else: # LOW
        actions.append({
            "action_id": f"ACT-ROUTINE-{zone_id}",
            "zone_id": zone_id,
            "zone_name": zone_name,
            "priority": "LOW",
            "title": "Continue Routine Daily Surveillance and Drain Maintenance",
            "description": "Maintain normal baseline monitoring. Clean natural hill weep holes and runoff ditches.",
            "responsible_agency": "Municipal Highway Maintenance",
            "sop_code": "SOP-NER-L0-ROUTINE",
            "status": "COMPLETED"
        })

    return actions
