from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import ThermalEvent, EventIntel, Facility
from app.schemas import GeoJSONFeatureCollection, GeoJSONFeature, GeoJSONGeometry, EventDetail, EventIntelSummary

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=GeoJSONFeatureCollection)
def get_events(
    start_date: Optional[date] = Query(None, description="Filter from acquisition date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Filter to acquisition date (YYYY-MM-DD)"),
    bbox: Optional[str] = Query(None, description="Bounding box W,S,E,N (e.g. 69.5,22.0,70.8,23.0)"),
    classification: Optional[str] = Query(None, description="Filter by classification type (comma-separated or single)"),
    min_risk: Optional[int] = Query(None, ge=0, le=100, description="Minimum risk score (0-100)"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level: LOW, MEDIUM, HIGH, CRITICAL"),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieve thermal anomaly events as standard GeoJSON FeatureCollection.
    Optimized for direct integration with MapLibre GL JS / Leaflet.
    """
    query = db.query(ThermalEvent).join(EventIntel, EventIntel.event_id == ThermalEvent.id, isouter=True)

    if start_date:
        query = query.filter(ThermalEvent.acq_date >= start_date)
    if end_date:
        query = query.filter(ThermalEvent.acq_date <= end_date)

    if bbox:
        try:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) == 4:
                w, s, e, n = parts
                query = query.filter(
                    ThermalEvent.longitude >= w,
                    ThermalEvent.longitude <= e,
                    ThermalEvent.latitude >= s,
                    ThermalEvent.latitude <= n
                )
        except Exception:
            pass

    if classification:
        classes = [c.strip() for c in classification.split(",") if c.strip()]
        if classes:
            query = query.filter(EventIntel.classification.in_(classes))

    if min_risk is not None:
        query = query.filter(EventIntel.risk_score >= min_risk)

    if risk_level:
        levels = [l.strip().upper() for l in risk_level.split(",") if l.strip()]
        if levels:
            query = query.filter(EventIntel.risk_level.in_(levels))

    events = query.order_by(desc(ThermalEvent.acq_date), desc(ThermalEvent.acq_time)).offset(offset).limit(limit).all()

    features: List[GeoJSONFeature] = []
    # Pre-fetch facilities map for fast name lookups
    fac_map = {f.id: f.name for f in db.query(Facility.id, Facility.name).all()}

    for ev in events:
        intel = ev.intel
        fac_name = fac_map.get(intel.nearest_facility_id) if intel and intel.nearest_facility_id else None

        props = {
            "id": ev.id,
            "source": ev.source,
            "satellite": ev.satellite,
            "latitude": ev.latitude,
            "longitude": ev.longitude,
            "bright_ti4": ev.bright_ti4,
            "frp": ev.frp,
            "confidence": ev.confidence,
            "acq_date": ev.acq_date.isoformat(),
            "acq_time": ev.acq_time,
            "daynight": ev.daynight,
            "grid_id": ev.grid_id,
            "classification": intel.classification if intel else "unknown",
            "classification_confidence": intel.classification_confidence if intel else 0.5,
            "risk_score": intel.risk_score if intel else 0,
            "risk_level": intel.risk_level if intel else "LOW",
            "persistence_30d": intel.persistence_30d if intel else 0.0,
            "frp_anomaly_ratio": intel.frp_anomaly_ratio if intel else 1.0,
            "distance_to_facility_m": intel.distance_to_facility_m if intel else None,
            "inside_facility": intel.inside_facility if intel else False,
            "nearest_facility_id": intel.nearest_facility_id if intel else None,
            "nearest_facility_name": fac_name
        }

        feature = GeoJSONFeature(
            type="Feature",
            geometry=GeoJSONGeometry(
                type="Point",
                coordinates=[ev.longitude, ev.latitude]
            ),
            properties=props
        )
        features.append(feature)

    return GeoJSONFeatureCollection(type="FeatureCollection", features=features)


@router.get("/{event_id}", response_model=EventDetail)
def get_event_detail(event_id: int, db: Session = Depends(get_db)):
    """
    Retrieve exhaustive intelligence detail for a single thermal anomaly,
    including the explainability evidence tree and satellite validation links.
    """
    ev = db.query(ThermalEvent).filter(ThermalEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Thermal anomaly event not found")

    intel = ev.intel
    intel_summary = None

    if intel:
        fac = db.query(Facility).filter(Facility.id == intel.nearest_facility_id).first() if intel.nearest_facility_id else None
        intel_summary = EventIntelSummary(
            nearest_facility_id=intel.nearest_facility_id,
            nearest_facility_name=fac.name if fac else None,
            distance_to_facility_m=intel.distance_to_facility_m,
            inside_facility=intel.inside_facility,
            persistence_30d=intel.persistence_30d,
            detections_7d=intel.detections_7d,
            detections_30d=intel.detections_30d,
            frp_anomaly_ratio=intel.frp_anomaly_ratio,
            classification=intel.classification,
            classification_confidence=intel.classification_confidence,
            risk_score=intel.risk_score,
            risk_level=intel.risk_level,
            evidence=intel.evidence or {}
        )

    return EventDetail(
        id=ev.id,
        source=ev.source,
        satellite=ev.satellite,
        latitude=ev.latitude,
        longitude=ev.longitude,
        bright_ti4=ev.bright_ti4,
        bright_ti5=ev.bright_ti5,
        frp=ev.frp,
        confidence=ev.confidence,
        acq_date=ev.acq_date,
        acq_time=ev.acq_time,
        daynight=ev.daynight,
        version=ev.version,
        grid_id=ev.grid_id,
        created_at=ev.created_at,
        classification=intel.classification if intel else "unknown",
        classification_confidence=intel.classification_confidence if intel else 0.5,
        risk_score=intel.risk_score if intel else 0,
        risk_level=intel.risk_level if intel else "LOW",
        distance_to_facility_m=intel.distance_to_facility_m if intel else None,
        nearest_facility_name=fac.name if (intel and fac) else None,
        inside_facility=intel.inside_facility if intel else False,
        frp_anomaly_ratio=intel.frp_anomaly_ratio if intel else 1.0,
        persistence_30d=intel.persistence_30d if intel else 0.0,
        intel=intel_summary
    )
