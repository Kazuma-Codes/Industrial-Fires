from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import ThermalEvent, EventIntel, Alert, Facility
from app.schemas import DashboardStats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get top-level KPI metrics for the command center dashboard HUD.
    """
    total_events = db.query(ThermalEvent).count()
    total_facilities = db.query(Facility).count()

    # Classification breakdown
    class_counts = (
        db.query(EventIntel.classification, func.count(EventIntel.id))
        .group_by(EventIntel.classification)
        .all()
    )
    class_map = {row[0]: row[1] for row in class_counts}

    critical_alerts = db.query(Alert).filter(Alert.severity == "CRITICAL", Alert.status == "ACTIVE").count()
    high_alerts = db.query(Alert).filter(Alert.severity == "HIGH", Alert.status == "ACTIVE").count()

    last_event = db.query(ThermalEvent).order_by(ThermalEvent.created_at.desc()).first()
    last_ingestion = last_event.created_at.isoformat() if last_event and last_event.created_at else datetime.now(timezone.utc).isoformat()

    return DashboardStats(
        total_events=total_events,
        industrial_fires=class_map.get("industrial_fire", 0),
        persistent_sources=class_map.get("persistent_industrial_source", 0),
        gas_flares=class_map.get("gas_flare", 0),
        wildfires=class_map.get("wildfire", 0),
        agricultural_burning=class_map.get("agricultural_burning", 0),
        unknown=class_map.get("unknown", 0),
        critical_alerts=critical_alerts,
        high_alerts=high_alerts,
        total_facilities=total_facilities,
        last_ingestion=last_ingestion
    )
