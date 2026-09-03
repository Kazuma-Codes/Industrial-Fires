from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import Alert, Facility, ThermalEvent
from app.schemas import AlertResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertResponse])
def get_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: LOW, MEDIUM, HIGH, CRITICAL"),
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, ACKNOWLEDGED, RESOLVED"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    List tactical intelligence alerts ordered by creation time.
    """
    query = db.query(Alert)

    if severity:
        sev_list = [s.strip().upper() for s in severity.split(",") if s.strip()]
        query = query.filter(Alert.severity.in_(sev_list))

    if status:
        stat_list = [st.strip().upper() for st in status.split(",") if st.strip()]
        query = query.filter(Alert.status.in_(stat_list))

    alerts = query.order_by(desc(Alert.created_at)).limit(limit).all()

    results: List[AlertResponse] = []
    for a in alerts:
        fac = a.facility
        ev = a.event
        results.append(
            AlertResponse(
                id=a.id,
                event_id=a.event_id,
                facility_id=a.facility_id,
                facility_name=fac.name if fac else None,
                alert_type=a.alert_type,
                severity=a.severity,
                title=a.title,
                description=a.description,
                recommended_action=a.recommended_action,
                status=a.status,
                created_at=a.created_at,
                acknowledged_at=a.acknowledged_at,
                resolved_at=a.resolved_at,
                latitude=ev.latitude if ev else None,
                longitude=ev.longitude if ev else None
            )
        )

    return results


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Acknowledge an active tactical alert.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)

    fac = alert.facility
    ev = alert.event
    return AlertResponse(
        id=alert.id,
        event_id=alert.event_id,
        facility_id=alert.facility_id,
        facility_name=fac.name if fac else None,
        alert_type=alert.alert_type,
        severity=alert.severity,
        title=alert.title,
        description=alert.description,
        recommended_action=alert.recommended_action,
        status=alert.status,
        created_at=alert.created_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
        latitude=ev.latitude if ev else None,
        longitude=ev.longitude if ev else None
    )


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Resolve an active or acknowledged alert.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "RESOLVED"
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)

    fac = alert.facility
    ev = alert.event
    return AlertResponse(
        id=alert.id,
        event_id=alert.event_id,
        facility_id=alert.facility_id,
        facility_name=fac.name if fac else None,
        alert_type=alert.alert_type,
        severity=alert.severity,
        title=alert.title,
        description=alert.description,
        recommended_action=alert.recommended_action,
        status=alert.status,
        created_at=alert.created_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
        latitude=ev.latitude if ev else None,
        longitude=ev.longitude if ev else None
    )
