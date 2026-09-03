import os
import logging
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger("thermal_intelligence.database")

Base = declarative_base()

def create_configured_engine():
    raw_url = settings.DATABASE_URL or ""
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)

    # If postgresql is configured, test if it actually connects
    if raw_url.startswith("postgresql"):
        try:
            test_engine = create_engine(
                raw_url,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 3}
            )
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Connected to configured PostgreSQL database.")
            return test_engine
        except Exception as e:
            logger.warning(
                f"PostgreSQL connection to {raw_url} failed ({e}). "
                "Falling back to local SQLite database (sqlite:///./thermal.db)."
            )
            sqlite_path = Path(__file__).resolve().parent.parent / "thermal.db"
            return create_engine(
                f"sqlite:///{sqlite_path}",
                connect_args={"check_same_thread": False},
                echo=False
            )

    # If sqlite or other url
    connect_args = {}
    if "sqlite" in raw_url:
        connect_args["check_same_thread"] = False

    return create_engine(
        raw_url,
        pool_pre_ping=True,
        connect_args=connect_args
    )

engine = create_configured_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.warning(f"Database connection check failed: {e}")
        return False
