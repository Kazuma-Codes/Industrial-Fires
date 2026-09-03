import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import check_db_connection, Base, engine
from app.routers import events, facilities, alerts, stats, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("thermal_intelligence.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Thermal Intelligence Platform...")
    db_ok = check_db_connection()
    if db_ok:
        logger.info("Database connection successfully established.")
        try:
            # Ensure tables exist (safe for both sqlite and postgres)
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables initialized.")
        except Exception as err:
            logger.warning(f"Metadata create_all notice (PostGIS tables may exist): {err}")
    else:
        logger.warning("Database connection could not be verified on startup. Check DATABASE_URL configuration.")
    yield
    logger.info("Shutting down Thermal Intelligence Platform.")


app = FastAPI(
    title="AI-Based Thermal Intelligence Platform",
    description="Next-generation tactical thermal anomaly classification, FRP baseline intelligence, and explainable GIS alerts for SIH 2026 (NTRO)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(events.router)
app.include_router(facilities.router)
app.include_router(alerts.router)
app.include_router(stats.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {
        "service": "Thermal Intelligence Platform API",
        "status": "operational",
        "docs_url": "/docs",
        "demo_region": "Jamnagar, Gujarat",
        "problem_statement": "SIH26162 (NTRO)"
    }


@app.get("/health")
def health_check():
    db_connected = check_db_connection()
    return {
        "status": "healthy" if db_connected else "degraded",
        "database": "connected" if db_connected else "disconnected",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
