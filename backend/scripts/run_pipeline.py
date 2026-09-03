import sys
import logging
from pathlib import Path

# Add backend directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import Facility
from app.services.firms_ingest import ingest_firms
from app.services.osm_ingest import ingest_osm_facilities
from app.services.spatial_enrichment import enrich_spatial_for_events
from app.services.persistence import compute_persistence_scores
from app.services.baseline import compute_facility_baselines
from app.services.classifier import classify_all_events
from app.services.risk import evaluate_all_risks
from app.services.alerts import generate_alerts

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_pipeline")


def run_full_pipeline():
    logger.info("=== Starting Thermal Intelligence Processing Pipeline ===")
    db = SessionLocal()
    try:
        # Step 1: Ensure facilities exist
        fac_count = db.query(Facility).count()
        if fac_count == 0:
            logger.info("Step 1: Facilities table empty. Ingesting industrial facilities...")
            ingest_osm_facilities(db)
        else:
            logger.info(f"Step 1: Verified {fac_count} industrial facilities in database.")

        # Step 2: Ingest FIRMS active fires
        logger.info("Step 2: Ingesting NASA FIRMS VIIRS active fire data...")
        firms_count = ingest_firms(db, days=3)
        logger.info(f"Step 2: Ingested {firms_count} new thermal events.")

        # Step 3: Spatial matching with industrial facilities
        logger.info("Step 3: Performing spatial join with industrial assets...")
        spat_count = enrich_spatial_for_events(db)
        logger.info(f"Step 3: Enriched spatial context for {spat_count} events.")

        # Step 4: Temporal persistence scoring
        logger.info("Step 4: Computing grid persistence metrics...")
        pers_count = compute_persistence_scores(db)
        logger.info(f"Step 4: Persistence calculated for {pers_count} records.")

        # Step 5: Facility FRP baselines and anomaly ratios
        logger.info("Step 5: Updating facility FRP 30-day baselines...")
        base_count = compute_facility_baselines(db)
        logger.info(f"Step 5: Baselines updated for {base_count} facilities.")

        # Step 6: 2-layer explainable classification
        logger.info("Step 6: Executing thermal intelligence classification engine...")
        class_count = classify_all_events(db)
        logger.info(f"Step 6: Classified {class_count} thermal events.")

        # Step 7: Risk score calculation
        logger.info("Step 7: Evaluating tactical risk scores...")
        risk_count = evaluate_all_risks(db)
        logger.info(f"Step 7: Computed risk scores for {risk_count} records.")

        # Step 8: Operational alert generation
        logger.info("Step 8: Generating tactical operational alerts...")
        alert_count = generate_alerts(db)
        logger.info(f"Step 8: Generated {alert_count} alerts.")

        logger.info("=== Pipeline Completed Successfully! ===")
    except Exception as e:
        logger.exception(f"Pipeline error: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_full_pipeline()
