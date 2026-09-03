import sys
import csv
import logging
from pathlib import Path

# Add backend directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, engine
from app.models import Facility, HAS_GEOALCHEMY

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("import_india_assets")


def import_assets(csv_path: Path = None) -> int:
    if csv_path is None:
        csv_path = Path(__file__).resolve().parent.parent / "data" / "facilities" / "india_critical_assets.csv"

    if not csv_path.exists():
        logger.error(f"Asset file not found at: {csv_path}")
        return 0

    logger.info(f"Loading critical infrastructure assets from {csv_path}")
    db = SessionLocal()
    is_postgres = "postgresql" in str(engine.url)

    imported_count = 0
    updated_count = 0

    try:
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                osm_id = row.get("osm_id", "").strip()
                name = row.get("name", "").strip()
                facility_type = row.get("facility_type", "factory").strip()
                criticality = int(row.get("criticality", 3))
                operator = row.get("operator", "").strip()
                lat = float(row.get("latitude", 0.0))
                lon = float(row.get("longitude", 0.0))

                metadata = {
                    "capacity": row.get("capacity", "").strip(),
                    "sector": row.get("sector", "").strip(),
                    "hazards": [h.strip() for h in row.get("hazards", "").split(",") if h.strip()]
                }

                # Find existing by osm_id or name
                existing = db.query(Facility).filter(
                    (Facility.osm_id == osm_id) | (Facility.name == name)
                ).first()

                if existing:
                    existing.osm_id = osm_id
                    existing.facility_type = facility_type
                    existing.criticality = criticality
                    existing.operator = operator
                    existing.latitude = lat
                    existing.longitude = lon
                    existing.metadata_json = metadata
                    if HAS_GEOALCHEMY and is_postgres:
                        try:
                            existing.geom = f"SRID=4326;POINT({lon} {lat})"
                        except Exception:
                            pass
                    updated_count += 1
                else:
                    new_fac = Facility(
                        osm_id=osm_id,
                        name=name,
                        facility_type=facility_type,
                        criticality=criticality,
                        operator=operator,
                        latitude=lat,
                        longitude=lon,
                        metadata_json=metadata
                    )
                    if HAS_GEOALCHEMY and is_postgres:
                        try:
                            new_fac.geom = f"SRID=4326;POINT({lon} {lat})"
                        except Exception:
                            pass
                    db.add(new_fac)
                    imported_count += 1

        db.commit()
        logger.info(f"Asset import complete! Added {imported_count} new assets, updated {updated_count} existing.")
        return imported_count + updated_count

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to import assets: {e}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    import_assets()
