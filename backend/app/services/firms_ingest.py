import io
import os
import logging
from datetime import datetime, date
from pathlib import Path
from typing import Optional, List, Dict, Any
import requests
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.models import ThermalEvent, HAS_GEOALCHEMY

logger = logging.getLogger("thermal_intelligence.firms_ingest")


def compute_grid_id(latitude: float, longitude: float) -> str:
    """Snap lat/lon to ~330m grid cell (0.003 degrees)"""
    return f"{round(latitude, 3):.3f},{round(longitude, 3):.3f}"


def fetch_firms_csv_api(map_key: str, bbox: str, days: int = 3, satellite: str = "VIIRS_SNPP_NRT") -> Optional[str]:
    """Fetch raw CSV from NASA FIRMS Area API"""
    if not map_key:
        logger.info("No NASA FIRMS MAP_KEY provided, falling back to local dataset")
        return None

    bbox_clean = (bbox or "").strip()
    if bbox_clean.upper() in ("IND", "INDIA"):
        url = f"https://firms.modaps.eosdis.nasa.gov/api/country/csv/{map_key}/{satellite}/IND/{days}"
    else:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{satellite}/{bbox_clean}/{days}"
    logger.info(f"Querying NASA FIRMS API: {url.replace(map_key, '***')}")
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200 and "latitude" in resp.text:
            return resp.text
        logger.warning(f"FIRMS API responded with status {resp.status_code}: {resp.text[:200]}")
        return None
    except Exception as e:
        logger.warning(f"FIRMS API request failed: {e}")
        return None


def load_fallback_csv() -> Optional[str]:
    """Load local fallback CSV file from data/firms/ directory"""
    data_dir = Path(__file__).resolve().parent.parent.parent / "data" / "firms"
    csv_files = list(data_dir.glob("*.csv")) if data_dir.exists() else []
    if csv_files:
        logger.info(f"Loading fallback FIRMS data from {csv_files[0]}")
        return csv_files[0].read_text(encoding="utf-8")
    return None


TARGET_CORRIDORS = {
    "jamnagar_gujarat": {
        "name": "Jamnagar-Gujarat Hydrocarbon Corridor",
        "bbox": "69.5,22.0,70.8,23.0",
        "description": "Reliance Jamnagar, Nayara Vadinar, Sikka, Salaya, Mundra"
    },
    "korba_singrauli": {
        "name": "Korba-Singrauli Power & Coal Belt",
        "bbox": "82.0,21.8,83.5,24.5",
        "description": "NTPC Singrauli/Vindhyachal/Korba/Sipat, Gevra/Kusmunda coal mines"
    },
    "jharia_dhanbad": {
        "name": "Jharia-Dhanbad Coal Fire Belt",
        "bbox": "86.0,23.5,87.0,24.0",
        "description": "BCCL Jharia underground smoldering coalfields, Bokaro Steel"
    },
    "assam_oilfields": {
        "name": "Digboi-Assam Petrochemical Corridor",
        "bbox": "95.0,27.0,96.2,27.8",
        "description": "IOCL Digboi, Duliajan OIL fields, Numaligarh"
    }
}


def parse_and_insert_firms_data(csv_text: str, db: Session, satellite_default: str = "SNPP") -> int:
    """Parse FIRMS CSV into pandas dataframe and upsert into database with fast in-memory deduplication"""
    df = pd.read_csv(io.StringIO(csv_text))
    required_cols = {"latitude", "longitude", "frp"}
    if not required_cols.issubset(set(df.columns)):
        logger.error(f"Missing required columns in FIRMS CSV. Found: {list(df.columns)}")
        return 0

    # Determine date range from CSV for fast pre-fetching of existing signatures
    existing_signatures = set()
    try:
        if "acq_date" in df.columns:
            min_d_str = str(df["acq_date"].min()).strip()
            max_d_str = str(df["acq_date"].max()).strip()
            min_d = datetime.strptime(min_d_str, "%Y-%m-%d").date() if isinstance(min_d_str, str) else date.today()
            max_d = datetime.strptime(max_d_str, "%Y-%m-%d").date() if isinstance(max_d_str, str) else date.today()

            existing_rows = db.query(
                ThermalEvent.source,
                ThermalEvent.satellite,
                ThermalEvent.acq_date,
                ThermalEvent.acq_time,
                ThermalEvent.latitude,
                ThermalEvent.longitude
            ).filter(
                ThermalEvent.acq_date >= min_d,
                ThermalEvent.acq_date <= max_d
            ).all()

            for r in existing_rows:
                existing_signatures.add((r[0], r[1], r[2], r[3], round(r[4], 4), round(r[5], 4)))
    except Exception as e:
        logger.debug(f"Pre-fetch signatures warning: {e}")

    inserted_count = 0
    batch_events = []

    for _, row in df.iterrows():
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            frp = float(row["frp"])
            bright_ti4 = float(row["bright_ti4"]) if "bright_ti4" in row and pd.notna(row["bright_ti4"]) else None
            bright_ti5 = float(row["bright_ti5"]) if "bright_ti5" in row and pd.notna(row["bright_ti5"]) else None
            confidence = str(row["confidence"]) if "confidence" in row and pd.notna(row["confidence"]) else "nominal"
            sat = str(row.get("satellite", satellite_default))
            daynight = str(row.get("daynight", "D")).strip().upper()
            version = str(row.get("version", "2.0NRT"))

            # Parse date and time
            raw_date = row.get("acq_date", None)
            if pd.notna(raw_date):
                if isinstance(raw_date, str):
                    acq_date = datetime.strptime(raw_date.strip(), "%Y-%m-%d").date()
                else:
                    acq_date = pd.to_datetime(raw_date).date()
            else:
                acq_date = date.today()

            raw_time = str(row.get("acq_time", "0000")).strip()
            acq_time = raw_time.zfill(4)[:4]
            grid_id = compute_grid_id(lat, lon)

            # Fast O(1) duplicate check
            sig = ("FIRMS_VIIRS", sat, acq_date, acq_time, round(lat, 4), round(lon, 4))
            if sig in existing_signatures:
                continue
            existing_signatures.add(sig)

            event = ThermalEvent(
                source="FIRMS_VIIRS",
                satellite=sat,
                latitude=lat,
                longitude=lon,
                bright_ti4=bright_ti4,
                bright_ti5=bright_ti5,
                frp=frp,
                confidence=confidence,
                acq_date=acq_date,
                acq_time=acq_time,
                daynight=daynight,
                version=version,
                grid_id=grid_id
            )

            # If GeoAlchemy2 & PostGIS is present, populate PostGIS geometry
            if HAS_GEOALCHEMY:
                try:
                    event.geom = f"SRID=4326;POINT({lon} {lat})"
                except Exception:
                    pass

            batch_events.append(event)
            inserted_count += 1

            if len(batch_events) >= 500:
                db.add_all(batch_events)
                db.commit()
                batch_events.clear()

        except Exception as err:
            logger.debug(f"Error parsing row: {err}")
            continue

    if batch_events:
        try:
            db.add_all(batch_events)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Commit error inserting FIRMS batch: {e}")
            return 0

    logger.info(f"Successfully inserted {inserted_count} new thermal events.")
    return inserted_count


def prune_old_events(db: Session, retention_days: int = 90) -> int:
    """Delete events older than retention_days to keep Neon storage under 0.5 GB"""
    from datetime import timedelta
    cutoff_date = date.today() - timedelta(days=retention_days)
    try:
        deleted = db.query(ThermalEvent).filter(ThermalEvent.acq_date < cutoff_date).delete()
        db.commit()
        logger.info(f"Pruned {deleted} events older than {cutoff_date} ({retention_days} days retention).")
        return deleted
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to prune old events: {e}")
        return 0


def ingest_firms(db: Session, bbox: Optional[str] = None, days: int = 3, satellite: str = "VIIRS_SNPP_NRT") -> int:
    """Ingest FIRMS data via API or fallback local dataset"""
    bbox_str = bbox or settings.DEMO_BBOX
    csv_text = fetch_firms_csv_api(settings.FIRMS_MAP_KEY, bbox_str, days, satellite=satellite)
    if not csv_text:
        csv_text = load_fallback_csv()

    if not csv_text:
        logger.warning("No FIRMS data available from API or fallback directory.")
        return 0

    return parse_and_insert_firms_data(csv_text, db, satellite_default="SNPP")


def ingest_all_corridors(db: Session, days: int = 3, satellites: Optional[List[str]] = None) -> Dict[str, int]:
    """Ingest multiple target corridors sequentially with rate-limit delays to respect NASA limits"""
    import time
    results = {}
    sats = satellites or ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]

    for cid, info in TARGET_CORRIDORS.items():
        total_corridor = 0
        for sat in sats:
            cnt = ingest_firms(db, bbox=info["bbox"], days=days, satellite=sat)
            total_corridor += cnt
            time.sleep(2)  # Polite NASA API delay
        results[cid] = total_corridor
        logger.info(f"Corridor '{info['name']}': ingested {total_corridor} detections across satellites.")

    return results
