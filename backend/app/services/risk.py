import logging
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from app.models import ThermalEvent, EventIntel, Facility

logger = logging.getLogger("thermal_intelligence.risk")


def parse_confidence_score(conf: Optional[str]) -> float:
    """Normalize confidence string/number to 0-10 score"""
    if not conf:
        return 5.0
    c_str = str(conf).strip().lower()
    if c_str in ["h", "high"]:
        return 10.0
    elif c_str in ["n", "nominal", "med", "medium"]:
        return 7.0
    elif c_str in ["l", "low"]:
        return 4.0
    try:
        val = float(c_str)
        return min(10.0, max(0.0, val / 10.0))
    except ValueError:
        return 5.0


def compute_risk_score(
    event: ThermalEvent,
    intel: EventIntel,
    facility: Optional[Facility]
) -> Tuple[int, str]:
    """Calculate multi-factor tactical risk score (0-100) and severity level"""
    # 1. Thermal intensity (0 - 25 pts)
    frp = event.frp or 0.0
    thermal_score = min(25.0, frp / 2.0)

    # 2. FRP Anomaly Ratio (0 - 25 pts)
    anomaly_score = 0.0
    ratio = intel.frp_anomaly_ratio or 1.0
    if ratio >= 4.0:
        anomaly_score = 25.0
    elif ratio >= 2.5:
        anomaly_score = 20.0
    elif ratio >= 1.5:
        anomaly_score = 10.0

    # 3. Facility Proximity & Criticality (0 - 25 pts)
    facility_score = 0.0
    dist = intel.distance_to_facility_m
    crit = facility.criticality if facility else 1
    if dist is not None and dist < 1000.0:
        proximity_pts = max(0.0, 15.0 * (1.0 - (dist / 1000.0)))
        criticality_pts = min(10.0, crit * 2.0)
        facility_score = proximity_pts + criticality_pts

    # 4. Newness / Inverse Persistence (0 - 15 pts)
    pers = intel.persistence_30d or 0.0
    newness_score = max(0.0, 15.0 * (1.0 - pers))

    # 5. Detection Confidence (0 - 10 pts)
    conf_score = parse_confidence_score(event.confidence)

    # Sum total score (0 - 100)
    total = int(round(thermal_score + anomaly_score + facility_score + newness_score + conf_score))
    total = max(0, min(100, total))

    if total >= 75:
        level = "CRITICAL"
    elif total >= 55:
        level = "HIGH"
    elif total >= 35:
        level = "MEDIUM"
    else:
        level = "LOW"

    return total, level


def evaluate_all_risks(db: Session) -> int:
    """Evaluate risk scores for all events and update event_intel"""
    all_intel = db.query(EventIntel).all()
    count = 0

    for intel in all_intel:
        ev = db.query(ThermalEvent).filter(ThermalEvent.id == intel.event_id).first()
        if not ev:
            continue

        fac = None
        if intel.nearest_facility_id:
            fac = db.query(Facility).filter(Facility.id == intel.nearest_facility_id).first()

        score, level = compute_risk_score(ev, intel, fac)
        intel.risk_score = score
        intel.risk_level = level
        count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving risk scores: {e}")
        return 0

    logger.info(f"Evaluated risk scores for {count} events.")
    return count
