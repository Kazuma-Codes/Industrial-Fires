from datetime import datetime, timezone
import logging
import numpy as np
from sqlalchemy.orm import Session
from app.models import Facility, FacilityBaseline, ThermalEvent, EventIntel

logger = logging.getLogger("thermal_intelligence.baseline")


def compute_facility_baselines(db: Session) -> int:
    """Calculate rolling 30-day FRP baselines for all facilities and update event anomaly ratios"""
    facilities = db.query(Facility).all()
    updated_baselines = 0

    for fac in facilities:
        # Fetch events matched with this facility
        events_query = (
            db.query(ThermalEvent)
            .join(EventIntel, EventIntel.event_id == ThermalEvent.id)
            .filter(EventIntel.nearest_facility_id == fac.id)
            .all()
        )

        if not events_query:
            # Provide default baseline if facility has no events yet
            frp_values = [8.0]
            dates = set()
        else:
            frp_values = [e.frp for e in events_query if e.frp is not None]
            dates = {e.acq_date for e in events_query}

        if not frp_values:
            frp_values = [8.0]

        mean_frp = float(np.mean(frp_values))
        p90_frp = float(np.percentile(frp_values, 90))
        max_frp = float(np.max(frp_values))
        detection_count = len(frp_values)
        active_days = len(dates)

        baseline = db.query(FacilityBaseline).filter(FacilityBaseline.facility_id == fac.id).first()
        if not baseline:
            baseline = FacilityBaseline(facility_id=fac.id)
            db.add(baseline)

        baseline.mean_frp = round(mean_frp, 2)
        baseline.p90_frp = round(p90_frp, 2)
        baseline.max_frp = round(max_frp, 2)
        baseline.detection_count = detection_count
        baseline.active_days_30d = active_days
        baseline.last_updated = datetime.now(timezone.utc)
        updated_baselines += 1

    db.commit()

    # Now update frp_anomaly_ratio on all event_intel records
    all_intel = db.query(EventIntel).all()
    for intel in all_intel:
        ev = db.query(ThermalEvent).filter(ThermalEvent.id == intel.event_id).first()
        if not ev:
            continue

        if intel.nearest_facility_id:
            fac_baseline = db.query(FacilityBaseline).filter(FacilityBaseline.facility_id == intel.nearest_facility_id).first()
            base_frp = fac_baseline.mean_frp if fac_baseline and fac_baseline.mean_frp > 0 else 8.0
            ratio = round(ev.frp / base_frp, 2)
        else:
            # Regional baseline without facility is assumed ~10 MW
            ratio = round(ev.frp / 10.0, 2)

        intel.frp_anomaly_ratio = ratio

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving baseline calculations: {e}")
        return 0

    logger.info(f"Updated baselines for {updated_baselines} facilities.")
    return updated_baselines
