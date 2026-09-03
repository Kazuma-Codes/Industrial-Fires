from datetime import date, timedelta
import logging
from typing import Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import ThermalEvent, EventIntel

logger = logging.getLogger("thermal_intelligence.persistence")


def compute_persistence_scores(db: Session, reference_date: date = None) -> int:
    """Compute 7-day and 30-day persistence metrics per grid cell and update event_intel"""
    if reference_date is None:
        # Get maximum date present in thermal_events
        max_date = db.query(func.max(ThermalEvent.acq_date)).scalar()
        reference_date = max_date if max_date else date.today()

    date_7d_ago = reference_date - timedelta(days=7)
    date_30d_ago = reference_date - timedelta(days=30)

    # 1. Compute 30-day active days and counts grouped by grid_id
    query_30d = db.query(
        ThermalEvent.grid_id,
        func.count(func.distinct(ThermalEvent.acq_date)).label("active_days"),
        func.count(ThermalEvent.id).label("total_detections")
    ).filter(
        ThermalEvent.acq_date >= date_30d_ago,
        ThermalEvent.acq_date <= reference_date
    ).group_by(ThermalEvent.grid_id).all()

    grid_stats_30d: Dict[str, Tuple[int, int]] = {
        row.grid_id: (row.active_days, row.total_detections) for row in query_30d
    }

    # 2. Compute 7-day counts grouped by grid_id
    query_7d = db.query(
        ThermalEvent.grid_id,
        func.count(ThermalEvent.id).label("detections_7d")
    ).filter(
        ThermalEvent.acq_date >= date_7d_ago,
        ThermalEvent.acq_date <= reference_date
    ).group_by(ThermalEvent.grid_id).all()

    grid_stats_7d: Dict[str, int] = {
        row.grid_id: row.detections_7d for row in query_7d
    }

    # 3. Update event_intel records
    events = db.query(ThermalEvent).all()
    updated_count = 0

    for ev in events:
        intel = db.query(EventIntel).filter(EventIntel.event_id == ev.id).first()
        if not intel:
            intel = EventIntel(event_id=ev.id)
            db.add(intel)

        active_days, count_30d = grid_stats_30d.get(ev.grid_id, (1, 1))
        count_7d = grid_stats_7d.get(ev.grid_id, 1)

        # Persistence ratio: active days out of 30 days window
        persistence_ratio = min(1.0, round(active_days / 30.0, 3))

        intel.persistence_30d = persistence_ratio
        intel.detections_30d = count_30d
        intel.detections_7d = count_7d
        updated_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving persistence scores: {e}")
        return 0

    logger.info(f"Updated persistence scores for {updated_count} events.")
    return updated_count
