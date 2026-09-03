from datetime import datetime, timezone
import logging
from sqlalchemy.orm import Session
from app.models import ThermalEvent, EventIntel, Facility, Alert

logger = logging.getLogger("thermal_intelligence.alerts")


def generate_alerts(db: Session) -> int:
    """Scan classified events and generate tactical operational alerts"""
    all_intel = (
        db.query(EventIntel)
        .filter(EventIntel.risk_level.in_(["HIGH", "CRITICAL"]))
        .all()
    )

    created_alerts = 0

    for intel in all_intel:
        ev = db.query(ThermalEvent).filter(ThermalEvent.id == intel.event_id).first()
        if not ev:
            continue

        fac = None
        if intel.nearest_facility_id:
            fac = db.query(Facility).filter(Facility.id == intel.nearest_facility_id).first()

        # Check if an alert already exists for this event
        existing = db.query(Alert).filter(Alert.event_id == ev.id).first()
        if existing:
            continue

        alert_type = "industrial_thermal_spike"
        severity = intel.risk_level
        title = ""
        description = ""
        action = ""

        fac_name = fac.name if fac else "Unidentified Facility Area"
        fac_type = fac.facility_type.replace("_", " ").title() if fac else "Critical Zone"

        if intel.classification == "industrial_fire":
            alert_type = "industrial_fire_hazard"
            title = f"CRITICAL: Uncontained Thermal Anomaly at {fac_name}"
            description = (
                f"Severe thermal signature ({ev.frp:.1f} MW) detected {intel.distance_to_facility_m:.0f}m from {fac_name}. "
                f"FRP is {intel.frp_anomaly_ratio:.1f}x higher than baseline. Immediate industrial fire hazard."
            )
            action = "Dispatch onsite emergency industrial fire response team, initiate flare header inspection, and notify district disaster management authority."

        elif intel.classification == "wildfire" and intel.risk_level in ["HIGH", "CRITICAL"]:
            alert_type = "wildfire_encroachment"
            title = f"ALERT: High Intensity Wildfire Cluster Detected"
            description = (
                f"Expanding vegetation fire detected with total radiant output of {ev.frp:.1f} MW. "
                f"Active cluster detected across satellite overpasses."
            )
            action = "Alert regional forest department and deploy aerial drone reconnaissance for perimeter containment."

        elif intel.frp_anomaly_ratio and intel.frp_anomaly_ratio >= 3.0:
            alert_type = "facility_process_anomaly"
            title = f"HIGH: Abnormal Heat Excursion at {fac_name}"
            description = (
                f"Thermal sensor VIIRS detected {ev.frp:.1f} MW output ({intel.frp_anomaly_ratio:.1f}x normal operating threshold). "
                f"Potential runaway reaction or primary burner malfunction."
            )
            action = "Verify SCADA telemetry with plant operations control center and inspect cooling towers / relief valves."

        else:
            alert_type = "unusual_thermal_signature"
            title = f"WARNING: Elevated Heat Signature near {fac_name}"
            description = f"Detected {ev.frp:.1f} MW thermal radiation at coordinates ({ev.latitude:.4f}N, {ev.longitude:.4f}E)."
            action = "Conduct visual verification via satellite high-resolution optical imagery or localized patrol."

        alert = Alert(
            event_id=ev.id,
            facility_id=fac.id if fac else None,
            alert_type=alert_type,
            severity=severity,
            title=title,
            description=description,
            recommended_action=action,
            status="ACTIVE",
            created_at=datetime.now(timezone.utc)
        )
        db.add(alert)
        created_alerts += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating alerts: {e}")
        return 0

    logger.info(f"Generated {created_alerts} new tactical alerts.")
    return created_alerts
