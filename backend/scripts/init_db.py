import sys
import logging
from pathlib import Path
from sqlalchemy import text

# Add backend directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import engine, Base
from app.models import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("init_db")


def init_database():
    schema_path = Path(__file__).resolve().parent.parent.parent / "sql" / "schema.sql"
    logger.info(f"Checking schema file at {schema_path}")

    # Check if we can run schema.sql directly (Postgres)
    if "postgresql" in str(engine.url) and schema_path.exists():
        logger.info("Executing sql/schema.sql on PostgreSQL database...")
        sql_content = schema_path.read_text(encoding="utf-8")
        # Split statements by semicolon where appropriate
        with engine.connect() as conn:
            try:
                conn.execute(text(sql_content))
                conn.commit()
                logger.info("Schema successfully created from schema.sql!")
                return
            except Exception as e:
                logger.warning(f"Error applying raw schema.sql ({e}). Falling back to ORM table creation.")

    # Fallback to ORM metadata creation (works on both Postgres and SQLite)
    logger.info("Creating tables using SQLAlchemy ORM metadata...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables successfully initialized via ORM.")


if __name__ == "__main__":
    init_database()
