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
    """Match thermal events with nearest industrial facilities and populate event_intel"""
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
            # Within 150m is treated as inside or on the boundary of the facility
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

    logger.info(f"Enriched spatial relations for {enriched_count} events.")
    return enriched_count
