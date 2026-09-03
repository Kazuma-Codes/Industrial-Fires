import logging
from typing import Optional, List, Dict, Any
import requests
from sqlalchemy.orm import Session
from app.config import settings
from app.models import Facility, HAS_GEOALCHEMY

logger = logging.getLogger("thermal_intelligence.osm_ingest")

CRITICALITY_MAP = {
    "refinery": 5,
    "power_plant": 4,
    "factory": 3,
    "petroleum_well": 3,
    "industrial_area": 2,
    "port": 2,
    "other": 1
}

# Pre-seeded core facilities for Jamnagar / Gujarat industrial corridor
DEFAULT_JAMNAGAR_FACILITIES = [
    {
        "osm_id": "way/reliance_jamnagar_refinery",
        "name": "Reliance Jamnagar Refinery Complex",
        "facility_type": "refinery",
        "criticality": 5,
        "operator": "Reliance Industries Limited",
        "latitude": 22.3601,
        "longitude": 69.8524,
        "metadata": {
            "capacity": "1.24 million bpd",
            "sector": "Hydrocarbon & Petrochemicals",
            "hazards": ["Hydrogen sulfide", "Flares", "High temperature crack units"]
        }
    },
    {
        "osm_id": "way/nayara_vadinar_refinery",
        "name": "Nayara Energy Vadinar Refinery",
        "facility_type": "refinery",
        "criticality": 5,
        "operator": "Nayara Energy",
        "latitude": 22.4278,
        "longitude": 69.7121,
        "metadata": {
            "capacity": "400,000 bpd",
            "sector": "Petroleum Refining",
            "hazards": ["Flare stacks", "Crude distillation units"]
        }
    },
    {
        "osm_id": "way/gsfc_sikka_plant",
        "name": "GSFC Sikka Chemical & Fertilizer Plant",
        "facility_type": "factory",
        "criticality": 4,
        "operator": "Gujarat State Fertilizers & Chemicals",
        "latitude": 22.4412,
        "longitude": 69.8398,
        "metadata": {
            "sector": "Chemical & Phosphatic Fertilizers",
            "hazards": ["Ammonia storage", "Sulfuric acid plants"]
        }
    },
    {
        "osm_id": "node/essar_salaya_power",
        "name": "Salaya Thermal Power Plant",
        "facility_type": "power_plant",
        "criticality": 4,
        "operator": "Essar Power Gujarat",
        "latitude": 22.3256,
        "longitude": 69.5892,
        "metadata": {
            "capacity": "1200 MW",
            "sector": "Thermal Power Generation"
        }
    },
    {
        "osm_id": "way/gidc_jamnagar_phase3",
        "name": "Jamnagar GIDC Phase III Industrial Estate",
        "facility_type": "industrial_area",
        "criticality": 2,
        "operator": "Gujarat Industrial Development Corporation",
        "latitude": 22.4721,
        "longitude": 70.0612,
        "metadata": {
            "sector": "Brass parts & precision engineering"
        }
    }
]


def build_overpass_query(bbox_parts: tuple) -> str:
    """Build Overpass QL query from (west, south, east, north)"""
    w, s, e, n = bbox_parts
    # Overpass expects (south, west, north, east)
    bbox_str = f"{s},{w},{n},{e}"
    query = f"""
    [out:json][timeout:25];
    (
      node["industrial"="refinery"]({bbox_str});
      way["industrial"="refinery"]({bbox_str});
      node["power"="plant"]({bbox_str});
      way["power"="plant"]({bbox_str});
      node["man_made"="petroleum_well"]({bbox_str});
      way["man_made"="petroleum_well"]({bbox_str});
      node["man_made"="works"]({bbox_str});
      way["man_made"="works"]({bbox_str});
      way["landuse"="industrial"]({bbox_str});
    );
    out center tags;
    """
    return query


def query_overpass_api(query: str) -> Optional[List[Dict[str, Any]]]:
    """Execute query against Overpass API interpreter"""
    url = "https://overpass-api.de/api/interpreter"
    try:
        resp = requests.post(url, data={"data": query}, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("elements", [])
        logger.warning(f"Overpass API returned status {resp.status_code}")
        return None
    except Exception as e:
        logger.warning(f"Failed to query Overpass API: {e}")
        return None


def map_osm_element_to_facility(el: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract coordinates, name, type, and criticality from OSM JSON element"""
    tags = el.get("tags", {})
    # Get centroid coordinates
    if el.get("type") == "node":
        lat = el.get("lat")
        lon = el.get("lon")
    else:
        center = el.get("center", {})
        lat = center.get("lat")
        lon = center.get("lon")

    if lat is None or lon is None:
        return None

    # Determine facility type
    facility_type = "other"
    if tags.get("industrial") == "refinery" or "refinery" in tags.get("name", "").lower():
        facility_type = "refinery"
    elif tags.get("power") == "plant":
        facility_type = "power_plant"
    elif tags.get("man_made") == "petroleum_well":
        facility_type = "petroleum_well"
    elif tags.get("man_made") == "works":
        facility_type = "factory"
    elif tags.get("landuse") == "industrial":
        facility_type = "industrial_area"

    criticality = CRITICALITY_MAP.get(facility_type, 1)
    name = tags.get("name") or tags.get("operator") or f"Industrial Site ({facility_type.replace('_', ' ').title()})"
    osm_id = f"{el.get('type')}/{el.get('id')}"

    return {
        "osm_id": osm_id,
        "name": name,
        "facility_type": facility_type,
        "criticality": criticality,
        "operator": tags.get("operator"),
        "latitude": float(lat),
        "longitude": float(lon),
        "metadata": {
            "osm_tags": tags,
            "source": "OpenStreetMap_Overpass"
        }
    }


def insert_facilities(facilities_data: List[Dict[str, Any]], db: Session) -> int:
    """Upsert facilities list into database"""
    inserted = 0
    for item in facilities_data:
        existing = db.query(Facility).filter(Facility.osm_id == item["osm_id"]).first()
        if existing:
            continue

        fac = Facility(
            osm_id=item["osm_id"],
            name=item["name"],
            facility_type=item["facility_type"],
            criticality=item["criticality"],
            operator=item.get("operator"),
            latitude=item["latitude"],
            longitude=item["longitude"],
            metadata_json=item.get("metadata", {})
        )

        if HAS_GEOALCHEMY:
            try:
                fac.geom = f"SRID=4326;POINT({item['longitude']} {item['latitude']})"
            except Exception:
                pass

        db.add(fac)
        inserted += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error committing facilities: {e}")
        return 0

    return inserted


def ingest_osm_facilities(db: Session, bbox: Optional[str] = None) -> int:
    """Ingest industrial facilities via Overpass API or built-in corridor catalog"""
    bbox_tuple = settings.demo_bbox_tuple
    if bbox:
        parts = [float(p.strip()) for p in bbox.split(",")]
        if len(parts) == 4:
            bbox_tuple = (parts[0], parts[1], parts[2], parts[3])

    query = build_overpass_query(bbox_tuple)
    elements = query_overpass_api(query)

    facilities_to_insert = []
    if elements:
        for el in elements:
            fac = map_osm_element_to_facility(el)
            if fac:
                facilities_to_insert.append(fac)

    # Always ensure baseline core facilities are included
    facilities_to_insert.extend(DEFAULT_JAMNAGAR_FACILITIES)

    count = insert_facilities(facilities_to_insert, db)
    logger.info(f"Ingested {count} industrial facilities.")
    return count
