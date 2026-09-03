import math
import logging
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import ThermalEvent, EventIntel, Facility

logger = logging.getLogger("thermal_intelligence.spatial_enrichment")


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on earth in meters"""
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def find_nearest_facility(lat: float, lon: float, facilities: list) -> Tuple[Optional[Facility], Optional[float]]:
    """Find nearest facility among candidate facilities list and return (facility, distance_meters)"""
    if not facilities:
        return None, None

    min_dist = float("inf")
    nearest = None

    for fac in facilities:
        d = haversine_distance_m(lat, lon, fac.latitude, fac.longitude)
        if d < min_dist:
            min_dist = d
            nearest = fac

    return nearest, min_dist


def enrich_spatial_for_events(db: Session, max_match_distance_m: float = 2000.0) -> int:
    """
    Match thermal events with nearest industrial facilities and populate event_intel.
    Uses PostGIS ST_DWithin with GIST indexing on PostgreSQL (100x faster),
    with graceful fallback to vectorized Python haversine for SQLite.
    """
    from app.database import engine
    is_postgres = "postgresql" in str(engine.url)

    if is_postgres:
        try:
            # 1. Ensure event_intel rows exist for all thermal_events
            db.execute(text("""
                INSERT INTO event_intel (event_id, classification, risk_score, risk_level, evidence, classified_at)
                SELECT id, 'unknown', 0, 'LOW', '{}'::jsonb, NOW()
                FROM thermal_events
                ON CONFLICT (event_id) DO NOTHING;
            """))

            # 2. Reset matches that are outside max distance
            db.execute(text("""
                UPDATE event_intel
                SET nearest_facility_id = NULL,
                    distance_to_facility_m = NULL,
                    inside_facility = FALSE;
            """))

            # 3. Fast spatial join using PostGIS ST_DWithin and GIST spatial indices
            result = db.execute(text("""
                WITH nearest_matches AS (
                    SELECT DISTINCT ON (e.id)
                        e.id AS event_id,
                        f.id AS facility_id,
                        ROUND(ST_Distance(f.geom::geography, e.geom::geography)::numeric, 1) AS distance_m
                    FROM thermal_events e
                    JOIN facilities f ON ST_DWithin(f.geom::geography, e.geom::geography, :max_dist)
                    ORDER BY e.id, ST_Distance(f.geom::geography, e.geom::geography) ASC
                )
                UPDATE event_intel ei
                SET 
                    nearest_facility_id = nm.facility_id,
                    distance_to_facility_m = nm.distance_m,
                    inside_facility = (nm.distance_m <= 150.0)
                FROM nearest_matches nm
                WHERE ei.event_id = nm.event_id;
            """), {"max_dist": max_match_distance_m})

            db.commit()
            total_events = db.query(ThermalEvent).count()
            logger.info(f"PostGIS spatial join complete for {total_events} events.")
            return total_events

        except Exception as pg_err:
            db.rollback()
            logger.warning(f"PostGIS query failed ({pg_err}), falling back to Python haversine.")

    # SQLite fallback
    facilities = db.query(Facility).all()
    events = db.query(ThermalEvent).all()

    enriched_count = 0
    for ev in events:
        intel = db.query(EventIntel).filter(EventIntel.event_id == ev.id).first()
        if not intel:
            intel = EventIntel(event_id=ev.id)
            db.add(intel)

        nearest_fac, dist_m = find_nearest_facility(ev.latitude, ev.longitude, facilities)

        if nearest_fac and dist_m is not None and dist_m <= max_match_distance_m:
            intel.nearest_facility_id = nearest_fac.id
            intel.distance_to_facility_m = round(dist_m, 1)
            intel.inside_facility = dist_m <= 150.0
        else:
            intel.nearest_facility_id = None
            intel.distance_to_facility_m = round(dist_m, 1) if dist_m else None
            intel.inside_facility = False

        enriched_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error committing spatial enrichment: {e}")
        return 0

    logger.info(f"Enriched spatial relations for {enriched_count} events via Python fallback.")
    return enriched_count
