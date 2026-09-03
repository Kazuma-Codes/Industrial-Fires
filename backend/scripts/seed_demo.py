import sys
import random
from datetime import date, timedelta
from pathlib import Path
import logging

# Add backend directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, engine, Base
from app.models import Facility, ThermalEvent, EventIntel, FacilityBaseline, Alert, HAS_GEOALCHEMY
from app.services.osm_ingest import ingest_osm_facilities
from app.services.spatial_enrichment import enrich_spatial_for_events
from app.services.persistence import compute_persistence_scores
from app.services.baseline import compute_facility_baselines
from app.services.classifier import classify_all_events
from app.services.risk import evaluate_all_risks
from app.services.alerts import generate_alerts

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_demo")


def seed_demo_scenarios():
    db = SessionLocal()
    try:
        # 1. Clean existing records to allow repeatable demo resets
        logger.info("Clearing existing thermal data for fresh demo seed...")
        db.query(Alert).delete()
        db.query(EventIntel).delete()
        db.query(FacilityBaseline).delete()
        db.query(ThermalEvent).delete()
        db.commit()

        # 2. Ensure facilities are ingested
        fac_count = db.query(Facility).count()
        if fac_count == 0:
            logger.info("Ingesting base industrial facilities for Jamnagar corridor...")
            ingest_osm_facilities(db)

        # Retrieve Reliance and Nayara facilities
        reliance = db.query(Facility).filter(Facility.name.like("%Reliance%")).first()
        nayara = db.query(Facility).filter(Facility.name.like("%Nayara%")).first()

        today = date.today()

        # -------------------------------------------------------------
        # SCENARIO 1: Persistent Gas Flare (Jamnagar Refinery Flare 1)
        # 25 detections in the last 30 days, stable FRP 7.5 - 11.2 MW, Nighttime
        # -------------------------------------------------------------
        logger.info("Seeding Scenario 1: Routine Persistent Gas Flare...")
        flare_lat = 22.3618
        flare_lon = 69.8540
        grid_flare = f"{round(flare_lat, 3):.3f},{round(flare_lon, 3):.3f}"

        for i in range(25):
            d = today - timedelta(days=28 - i)
            ev = ThermalEvent(
                source="FIRMS_VIIRS",
                satellite="SNPP",
                latitude=round(flare_lat + random.uniform(-0.0004, 0.0004), 4),
                longitude=round(flare_lon + random.uniform(-0.0004, 0.0004), 4),
                bright_ti4=round(random.uniform(335.0, 348.0), 1),
                bright_ti5=round(random.uniform(292.0, 298.0), 1),
                frp=round(random.uniform(8.0, 11.5), 1),
                confidence="high",
                acq_date=d,
                acq_time="2130",
                daynight="N",
                version="2.0NRT",
                grid_id=grid_flare
            )
            db.add(ev)

        # -------------------------------------------------------------
        # SCENARIO 2: Critical Industrial Fire / Flare Spike Anomaly
        # 140m from Nayara Refinery boundary, sudden 34.8 MW spike, only today!
        # -------------------------------------------------------------
        logger.info("Seeding Scenario 2: Industrial Fire & Hazard Anomaly...")
        fire_lat = 22.4285
        fire_lon = 69.7135
        grid_fire = f"{round(fire_lat, 3):.3f},{round(fire_lon, 3):.3f}"

        # 10 prior days of normal baseline operations at Nayara
        for b_idx in range(10):
            d_hist = today - timedelta(days=22 - (b_idx * 2))
            db.add(ThermalEvent(
                source="FIRMS_VIIRS",
                satellite="SNPP",
                latitude=22.4278 + random.uniform(-0.0003, 0.0003),
                longitude=69.7121 + random.uniform(-0.0003, 0.0003),
                bright_ti4=round(random.uniform(328.0, 336.0), 1),
                bright_ti5=round(random.uniform(293.0, 297.0), 1),
                frp=round(random.uniform(6.8, 8.4), 1),
                confidence="nominal",
                acq_date=d_hist,
                acq_time="1130",
                daynight="D",
                version="2.0NRT",
                grid_id=f"{round(22.4278, 3):.3f},{round(69.7121, 3):.3f}"
            ))

        # Yesterday small signature near flare unit
        db.add(ThermalEvent(
            source="FIRMS_VIIRS",
            satellite="NOAA-20",
            latitude=fire_lat,
            longitude=fire_lon,
            bright_ti4=322.0,
            bright_ti5=295.0,
            frp=7.2,
            confidence="nominal",
            acq_date=today - timedelta(days=1),
            acq_time="0845",
            daynight="D",
            version="2.0NRT",
            grid_id=grid_fire
        ))

        # Today sudden critical industrial fire / process excursion
        db.add(ThermalEvent(
            source="FIRMS_VIIRS",
            satellite="SNPP",
            latitude=fire_lat,
            longitude=fire_lon,
            bright_ti4=367.4,
            bright_ti5=308.2,
            frp=36.4, # Massive 4.8x spike above 7.6 MW baseline
            confidence="high",
            acq_date=today,
            acq_time="1410",
            daynight="D",
            version="2.0NRT",
            grid_id=grid_fire
        ))

        # -------------------------------------------------------------
        # SCENARIO 3: Expanding Wildfire Cluster (Gir Forest Fringe)
        # Group of 6 thermal anomalies moving over past 3 days in forest area
        # -------------------------------------------------------------
        logger.info("Seeding Scenario 3: Wildfire Cluster in Reserve Outskirts...")
        wildfire_base_lat = 21.2800
        wildfire_base_lon = 70.8200

        for day_offset in range(3):
            d = today - timedelta(days=2 - day_offset)
            for j in range(2):
                w_lat = wildfire_base_lat + (day_offset * 0.012) + (j * 0.005)
                w_lon = wildfire_base_lon + (day_offset * 0.015) + (j * 0.006)
                grid_w = f"{round(w_lat, 3):.3f},{round(w_lon, 3):.3f}"

                db.add(ThermalEvent(
                    source="FIRMS_VIIRS",
                    satellite="SNPP",
                    latitude=round(w_lat, 4),
                    longitude=round(w_lon, 4),
                    bright_ti4=round(random.uniform(330.0, 345.0), 1),
                    bright_ti5=round(random.uniform(295.0, 301.0), 1),
                    frp=round(random.uniform(16.0, 24.0), 1),
                    confidence="high",
                    acq_date=d,
                    acq_time="0730",
                    daynight="D",
                    version="2.0NRT",
                    grid_id=grid_w
                ))

        # -------------------------------------------------------------
        # SCENARIO 4: Agricultural Burning (Rural Saurashtra Cropland)
        # 18 scattered low-FRP points, low persistence, typical post-harvest
        # -------------------------------------------------------------
        logger.info("Seeding Scenario 4: Dispersed Agricultural Crop Residue Burning...")
        crop_center_lat = 22.1800
        crop_center_lon = 70.4200

        for k in range(18):
            c_lat = crop_center_lat + random.uniform(-0.15, 0.15)
            c_lon = crop_center_lon + random.uniform(-0.15, 0.15)
            grid_c = f"{round(c_lat, 3):.3f},{round(c_lon, 3):.3f}"
            d = today - timedelta(days=random.randint(0, 4))

            db.add(ThermalEvent(
                source="FIRMS_VIIRS",
                satellite="NOAA-21",
                latitude=round(c_lat, 4),
                longitude=round(c_lon, 4),
                bright_ti4=round(random.uniform(312.0, 325.0), 1),
                bright_ti5=round(random.uniform(294.0, 298.0), 1),
                frp=round(random.uniform(3.5, 9.5), 1),
                confidence="nominal",
                acq_date=d,
                acq_time="0915",
                daynight="D",
                version="2.0NRT",
                grid_id=grid_c
            ))

        db.commit()
        logger.info("All raw scenario thermal events seeded successfully.")

        # 3. Run full intelligence enrichment pipeline
        logger.info("Running spatial enrichment...")
        enrich_spatial_for_events(db)

        logger.info("Calculating temporal persistence...")
        compute_persistence_scores(db)

        logger.info("Calculating facility FRP baselines...")
        compute_facility_baselines(db)

        logger.info("Classifying thermal anomalies with explainability...")
        classify_all_events(db)

        logger.info("Computing tactical risk scores...")
        evaluate_all_risks(db)

        logger.info("Generating operational defense & safety alerts...")
        generate_alerts(db)

        logger.info("Demo scenarios seeded and intelligence pipeline finished successfully!")

    except Exception as e:
        db.rollback()
        logger.exception(f"Error seeding demo scenarios: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_scenarios()
