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


def parse_and_insert_firms_data(csv_text: str, db: Session, satellite_default: str = "SNPP") -> int:
    """Parse FIRMS CSV into pandas dataframe and upsert into database"""
    df = pd.read_csv(io.StringIO(csv_text))
    required_cols = {"latitude", "longitude", "frp"}
    if not required_cols.issubset(set(df.columns)):
        logger.error(f"Missing required columns in FIRMS CSV. Found: {list(df.columns)}")
        return 0

    inserted_count = 0
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

            # Check for existing duplicate
            existing = db.query(ThermalEvent).filter(
                ThermalEvent.source == "FIRMS_VIIRS",
                ThermalEvent.satellite == sat,
                ThermalEvent.acq_date == acq_date,
                ThermalEvent.acq_time == acq_time,
                ThermalEvent.latitude == lat,
                ThermalEvent.longitude == lon
            ).first()

            if existing:
                continue

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

            db.add(event)
            inserted_count += 1
        except Exception as err:
            logger.debug(f"Error parsing row: {err}")
            continue

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Commit error inserting FIRMS records: {e}")
        return 0

    logger.info(f"Successfully inserted {inserted_count} new thermal events.")
    return inserted_count


def ingest_firms(db: Session, bbox: Optional[str] = None, days: int = 3) -> int:
    """Ingest FIRMS data via API or fallback local dataset"""
    bbox_str = bbox or settings.DEMO_BBOX
    csv_text = fetch_firms_csv_api(settings.FIRMS_MAP_KEY, bbox_str, days)
    if not csv_text:
        csv_text = load_fallback_csv()

    if not csv_text:
        logger.warning("No FIRMS data available from API or fallback directory.")
        return 0

    return parse_and_insert_firms_data(csv_text, db)
