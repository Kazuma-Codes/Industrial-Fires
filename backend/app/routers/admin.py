import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.schemas import PipelineStatus
from app.services.firms_ingest import ingest_firms
from app.services.osm_ingest import ingest_osm_facilities
from app.services.spatial_enrichment import enrich_spatial_for_events
from app.services.persistence import compute_persistence_scores
from app.services.baseline import compute_facility_baselines
from app.services.classifier import classify_all_events
from app.services.risk import evaluate_all_risks
from app.services.alerts import generate_alerts

logger = logging.getLogger("thermal_intelligence.admin")
router = APIRouter(prefix="/api/admin", tags=["admin"])


def verify_admin_auth(
    authorization: Optional[str] = Header(None),
    x_admin_token: Optional[str] = Header(None)
):
    """Authenticate admin API calls using Bearer token or X-Admin-Token header"""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
    elif x_admin_token:
        token = x_admin_token.strip()

    if not token or token != settings.ADMIN_API_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Valid Admin API Token required"
        )
    return True


@router.post("/ingest-firms", response_model=PipelineStatus, dependencies=[Depends(verify_admin_auth)])
def trigger_firms_ingest(bbox: Optional[str] = None, days: int = 3, db: Session = Depends(get_db)):
    """Trigger NASA FIRMS data ingestion"""
    count = ingest_firms(db, bbox=bbox, days=days)
    return PipelineStatus(
        success=True,
        message=f"Ingested {count} raw FIRMS VIIRS detections",
        counts={"inserted_events": count}
    )


@router.post("/ingest-osm", response_model=PipelineStatus, dependencies=[Depends(verify_admin_auth)])
def trigger_osm_ingest(bbox: Optional[str] = None, db: Session = Depends(get_db)):
    """Trigger OpenStreetMap industrial facility ingestion"""
    count = ingest_osm_facilities(db, bbox=bbox)
    return PipelineStatus(
        success=True,
        message=f"Ingested {count} industrial facilities",
        counts={"facilities": count}
    )


@router.post("/run-pipeline", response_model=PipelineStatus, dependencies=[Depends(verify_admin_auth)])
def trigger_full_pipeline(db: Session = Depends(get_db)):
    """Execute complete intelligence pipeline: Spatial Join -> Persistence -> Baseline -> Classify -> Risk -> Alerts"""
    try:
        spatial_count = enrich_spatial_for_events(db)
        pers_count = compute_persistence_scores(db)
        base_count = compute_facility_baselines(db)
        class_count = classify_all_events(db)
        risk_count = evaluate_all_risks(db)
        alert_count = generate_alerts(db)

        return PipelineStatus(
            success=True,
            message="Intelligence pipeline executed successfully",
            counts={
                "spatially_enriched": spatial_count,
                "persistence_calculated": pers_count,
                "facility_baselines_updated": base_count,
                "events_classified": class_count,
                "risk_scores_evaluated": risk_count,
                "alerts_generated": alert_count
            }
        )
    except Exception as e:
        logger.exception("Pipeline execution failed")
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")
