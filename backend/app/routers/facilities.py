from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Facility, FacilityBaseline, EventIntel, Alert
from app.schemas import (
    GeoJSONFeatureCollection, GeoJSONFeature, GeoJSONGeometry,
    FacilitySummary, FacilityDetail, FacilityBaselineSchema
)

router = APIRouter(prefix="/api/facilities", tags=["facilities"])


@router.get("", response_model=GeoJSONFeatureCollection)
def get_facilities(
    facility_type: Optional[str] = Query(None, description="Filter by facility type"),
    min_criticality: Optional[int] = Query(None, ge=1, le=5, description="Minimum criticality (1-5)"),
    bbox: Optional[str] = Query(None, description="Bounding box W,S,E,N"),
    db: Session = Depends(get_db)
):
    """
    Get industrial facilities formatted as a GeoJSON FeatureCollection for GIS overlay.
    """
    query = db.query(Facility)

    if facility_type:
        types = [t.strip() for t in facility_type.split(",") if t.strip()]
        query = query.filter(Facility.facility_type.in_(types))

    if min_criticality:
        query = query.filter(Facility.criticality >= min_criticality)

    if bbox:
        try:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) == 4:
                w, s, e, n = parts
                query = query.filter(
                    Facility.longitude >= w,
                    Facility.longitude <= e,
                    Facility.latitude >= s,
                    Facility.latitude <= n
                )
        except Exception:
            pass

    facilities = query.all()
    features: List[GeoJSONFeature] = []

    for f in facilities:
        base = f.baseline
        props = {
            "id": f.id,
            "osm_id": f.osm_id,
            "name": f.name,
            "facility_type": f.facility_type,
            "criticality": f.criticality,
            "operator": f.operator,
            "latitude": f.latitude,
            "longitude": f.longitude,
            "mean_frp": base.mean_frp if base else 0.0,
            "p90_frp": base.p90_frp if base else 0.0,
            "max_frp": base.max_frp if base else 0.0,
            "detection_count": base.detection_count if base else 0,
            "active_days_30d": base.active_days_30d if base else 0
        }

        feature = GeoJSONFeature(
            type="Feature",
            geometry=GeoJSONGeometry(
                type="Point",
                coordinates=[f.longitude, f.latitude]
            ),
            properties=props
        )
        features.append(feature)

    return GeoJSONFeatureCollection(type="FeatureCollection", features=features)


@router.get("/{facility_id}", response_model=FacilityDetail)
def get_facility_detail(facility_id: int, db: Session = Depends(get_db)):
    """
    Retrieve comprehensive facility metadata, baseline metrics, and current alert posture.
    """
    f = db.query(Facility).filter(Facility.id == facility_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Facility not found")

    recent_events_cnt = db.query(EventIntel).filter(EventIntel.nearest_facility_id == f.id).count()
    active_alerts_cnt = db.query(Alert).filter(Alert.facility_id == f.id, Alert.status == "ACTIVE").count()

    base_schema = None
    if f.baseline:
        base_schema = FacilityBaselineSchema(
            mean_frp=f.baseline.mean_frp,
            p90_frp=f.baseline.p90_frp,
            max_frp=f.baseline.max_frp,
            detection_count=f.baseline.detection_count,
            active_days_30d=f.baseline.active_days_30d,
            last_updated=f.baseline.last_updated
        )

    return FacilityDetail(
        id=f.id,
        osm_id=f.osm_id,
        name=f.name,
        facility_type=f.facility_type,
        criticality=f.criticality,
        operator=f.operator,
        latitude=f.latitude,
        longitude=f.longitude,
        baseline=base_schema,
        metadata_json=f.metadata_json or {},
        created_at=f.created_at,
        updated_at=f.updated_at,
        recent_events_count=recent_events_cnt,
        active_alerts_count=active_alerts_cnt
    )
