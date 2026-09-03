import os
import logging
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import ThermalEvent, EventIntel, Facility

logger = logging.getLogger("thermal_intelligence.classifier")


def build_copernicus_url(lat: float, lon: float, acq_date_str: str) -> str:
    """Generate direct Copernicus Data Space Browser URL centered on the anomaly"""
    return f"https://browser.dataspace.copernicus.eu/?zoom=14&lat={lat}&lng={lon}"


def build_nasa_worldview_url(lat: float, lon: float, acq_date_str: str) -> str:
    """Generate direct NASA Worldview URL with VIIRS fires active layer"""
    w = lon - 0.5
    s = lat - 0.5
    e = lon + 0.5
    n = lat + 0.5
    return f"https://worldview.earthdata.nasa.gov/?v={w},{s},{e},{n}&l=VIIRS_SNPP_Thermal_Anomalies_375m_All,MODIS_Aqua_Thermal_Anomalies_All,MODIS_Terra_Thermal_Anomalies_All,Reference_Labels_15m,Reference_Features_15m,Coastlines_15m,VIIRS_SNPP_CorrectedReflectance_TrueColor&t={acq_date_str}-m-00"


def classify_rule_based(
    event: ThermalEvent,
    intel: EventIntel,
    facility: Optional[Facility]
) -> Tuple[str, float, List[str], Dict[str, float]]:
    """
    Expert rule-based classifier yielding (classification, confidence, reason_points, probabilities)
    """
    reasons = []
    dist = intel.distance_to_facility_m
    fac_name = facility.name if facility else "None"
    fac_type = facility.facility_type if facility else "none"
    pers = intel.persistence_30d or 0.0
    ratio = intel.frp_anomaly_ratio or 1.0
    frp = event.frp or 0.0
    month = event.acq_date.month

    # Default probabilities
    probs = {
        "industrial_fire": 0.05,
        "persistent_industrial_source": 0.05,
        "gas_flare": 0.05,
        "wildfire": 0.05,
        "agricultural_burning": 0.05,
        "unknown": 0.75
    }

    # 1. Industrial Fire / Anomaly
    if dist is not None and dist < 800 and (ratio >= 1.8 or frp >= 25.0) and pers < 0.40:
        reasons.append(f"Located {dist:.0f}m from {fac_name} ({fac_type})")
        reasons.append(f"FRP of {frp:.1f} MW is {ratio:.1f}x higher than facility 30-day baseline")
        if pers < 0.25:
            reasons.append(f"Sudden thermal event with low prior persistence ({pers:.2f})")
        if event.bright_ti4 and event.bright_ti4 > 330:
            reasons.append(f"Intense brightness temperature ({event.bright_ti4:.1f} K)")

        conf = min(0.95, 0.75 + min(0.18, (ratio - 1.5) * 0.08))
        probs = {"industrial_fire": 0.88, "persistent_industrial_source": 0.05, "gas_flare": 0.04, "wildfire": 0.02, "agricultural_burning": 0.01, "unknown": 0.0}
        return "industrial_fire", conf, reasons, probs

    # 2. Routine Gas Flare
    if dist is not None and dist < 400 and pers >= 0.60 and event.daynight == "N" and ratio < 2.0:
        reasons.append(f"Consistent nighttime thermal signature located {dist:.0f}m from {fac_name}")
        reasons.append(f"High 30-day recurrence ({pers*100:.0f}% active days, {intel.detections_30d} detections)")
        reasons.append(f"Stable flaring FRP ({frp:.1f} MW within {ratio:.1f}x of baseline)")
        probs = {"gas_flare": 0.86, "persistent_industrial_source": 0.09, "industrial_fire": 0.02, "wildfire": 0.01, "agricultural_burning": 0.01, "unknown": 0.01}
        return "gas_flare", 0.86, reasons, probs

    # 3. Persistent Industrial Source (Smelters, kilns, crackers, routine process heat)
    if dist is not None and dist < 600 and pers >= 0.45 and ratio < 2.0:
        reasons.append(f"Persistent thermal emission {dist:.0f}m from {fac_name}")
        reasons.append(f"Operational detection on {intel.detections_30d} occasions in last 30 days (persistence={pers:.2f})")
        reasons.append(f"Thermal intensity is nominal for industrial operations ({ratio:.1f}x baseline)")
        probs = {"persistent_industrial_source": 0.85, "gas_flare": 0.08, "industrial_fire": 0.03, "wildfire": 0.02, "agricultural_burning": 0.01, "unknown": 0.01}
        return "persistent_industrial_source", 0.85, reasons, probs

    # 4. Wildfire (Forest / Vegetation cluster outside industrial perimeter)
    if (dist is None or dist > 1200) and (frp >= 15.0 or (intel.detections_7d and intel.detections_7d >= 2)):
        reasons.append("Location is situated in remote/vegetative terrain (>1.2km from industrial units)")
        reasons.append(f"Active cluster detected ({intel.detections_7d} fire points in last 7 days)")
        reasons.append(f"Thermal radiative power ({frp:.1f} MW) reflects moving flame front")
        probs = {"wildfire": 0.80, "agricultural_burning": 0.12, "unknown": 0.05, "industrial_fire": 0.01, "persistent_industrial_source": 0.01, "gas_flare": 0.01}
        return "wildfire", 0.80, reasons, probs

    # 5. Agricultural Burning (Crop residue / harvest clearing)
    if (dist is None or dist > 600) and pers < 0.25 and frp <= 20.0:
        if month in [9, 10, 11, 12, 1, 2, 3, 4, 5]:
            reasons.append("Rural/cropland zone isolated from major industrial infrastructure")
            reasons.append(f"Low intensity thermal output ({frp:.1f} MW) typical of biomass burn")
            reasons.append(f"Conforms with regional post-harvest residue clearing window (month {month})")
            probs = {"agricultural_burning": 0.78, "wildfire": 0.12, "unknown": 0.06, "industrial_fire": 0.02, "persistent_industrial_source": 0.01, "gas_flare": 0.01}
            return "agricultural_burning", 0.78, reasons, probs

    # 6. Fallback / Unknown
    reasons.append("Isolated thermal anomaly with non-definitive spatial or temporal context")
    reasons.append(f"FRP: {frp:.1f} MW, Distance to facility: {f'{dist:.0f}m' if dist else 'N/A'}")
    return "unknown", 0.35, reasons, probs


def classify_all_events(db: Session) -> int:
    """Classify all events in the database using the explainable intelligence engine"""
    all_intel = db.query(EventIntel).all()
    classified_count = 0

    for intel in all_intel:
        ev = db.query(ThermalEvent).filter(ThermalEvent.id == intel.event_id).first()
        if not ev:
            continue

        fac = None
        if intel.nearest_facility_id:
            fac = db.query(Facility).filter(Facility.id == intel.nearest_facility_id).first()

        classification, confidence, reasons, probs = classify_rule_based(ev, intel, fac)

        acq_str = ev.acq_date.strftime("%Y-%m-%d")

        evidence_payload = {
            "summary": reasons,
            "spatial": {
                "distance_to_facility_m": intel.distance_to_facility_m,
                "facility_name": fac.name if fac else None,
                "facility_type": fac.facility_type if fac else None,
                "facility_criticality": fac.criticality if fac else None,
                "inside_facility": intel.inside_facility
            },
            "thermal": {
                "frp_mw": ev.frp,
                "bright_ti4_k": ev.bright_ti4,
                "confidence_score": ev.confidence,
                "frp_anomaly_ratio": intel.frp_anomaly_ratio
            },
            "temporal": {
                "persistence_30d": intel.persistence_30d,
                "detections_30d": intel.detections_30d,
                "detections_7d": intel.detections_7d,
                "day_or_night": ev.daynight
            },
            "probabilities": probs,
            "external_links": {
                "copernicus_browser": build_copernicus_url(ev.latitude, ev.longitude, acq_str),
                "nasa_worldview": build_nasa_worldview_url(ev.latitude, ev.longitude, acq_str),
                "google_satellite": f"https://www.google.com/maps/@{ev.latitude},{ev.longitude},17z/data=!3m1!1e3",
                "google_maps": f"https://www.google.com/maps?q={ev.latitude},{ev.longitude}"
            }
        }

        intel.classification = classification
        intel.classification_confidence = round(confidence, 2)
        intel.evidence = evidence_payload
        classified_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving classifications: {e}")
        return 0

    logger.info(f"Classified {classified_count} thermal events.")
    return classified_count
