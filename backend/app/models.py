from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    ForeignKey, UniqueConstraint, Text, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
from app.database import Base

# Use JSONB if on Postgres, fallback to standard JSON
JsonType = JSONB().with_variant(JSON, "sqlite")

try:
    from geoalchemy2 import Geometry
    HAS_GEOALCHEMY = True
except ImportError:
    HAS_GEOALCHEMY = False

from app.database import engine
is_postgres = "postgresql" in str(engine.url)
facility_geom_type = Geometry(geometry_type="GEOMETRY", srid=4326) if (HAS_GEOALCHEMY and is_postgres) else Text
event_geom_type = Geometry(geometry_type="POINT", srid=4326) if (HAS_GEOALCHEMY and is_postgres) else Text


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(String(64), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=False, index=True)
    facility_type = Column(String(64), nullable=False, index=True)  # refinery, power_plant, factory, petroleum_well, industrial_area
    criticality = Column(Integer, default=1, nullable=False, index=True) # 1 to 5
    operator = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geom = Column(facility_geom_type, nullable=True)
    
    metadata_json = Column("metadata", JsonType, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    baseline = relationship("FacilityBaseline", back_populates="facility", uselist=False, cascade="all, delete-orphan")
    intel_records = relationship("EventIntel", back_populates="nearest_facility")
    alerts = relationship("Alert", back_populates="facility")


class ThermalEvent(Base):
    __tablename__ = "thermal_events"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(32), default="FIRMS_VIIRS", nullable=False)
    satellite = Column(String(32), nullable=False) # SNPP, NOAA-20, NOAA-21
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    bright_ti4 = Column(Float, nullable=True) # Kelvin
    bright_ti5 = Column(Float, nullable=True) # Kelvin
    frp = Column(Float, nullable=False)       # Fire Radiative Power in MW
    confidence = Column(String(16), nullable=True)
    acq_date = Column(Date, nullable=False, index=True)
    acq_time = Column(String(8), nullable=False) # HHMM
    daynight = Column(String(2), nullable=False, index=True) # 'D' or 'N'
    version = Column(String(16), default="2.0NRT")
    grid_id = Column(String(32), nullable=False, index=True) # e.g. "22.452,70.123"
    geom = Column(event_geom_type, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("source", "satellite", "acq_date", "acq_time", "latitude", "longitude", name="uq_thermal_event"),
    )

    # Relationships
    intel = relationship("EventIntel", back_populates="event", uselist=False, cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="event", cascade="all, delete-orphan")


class EventIntel(Base):
    __tablename__ = "event_intel"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("thermal_events.id", ondelete="CASCADE"), unique=True, nullable=False)
    nearest_facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="SET NULL"), nullable=True, index=True)
    distance_to_facility_m = Column(Float, nullable=True)
    inside_facility = Column(Boolean, default=False)
    persistence_30d = Column(Float, default=0.0) # Active days / 30
    detections_7d = Column(Integer, default=0)
    detections_30d = Column(Integer, default=0)
    frp_anomaly_ratio = Column(Float, default=1.0) # current_frp / baseline_frp
    classification = Column(String(64), nullable=False, default="unknown", index=True)
    classification_confidence = Column(Float, default=0.5)
    risk_score = Column(Integer, default=0, nullable=False, index=True) # 0 to 100
    risk_level = Column(String(16), default="LOW", nullable=False, index=True) # LOW, MEDIUM, HIGH, CRITICAL
    evidence = Column(JsonType, default=dict)
    classified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    event = relationship("ThermalEvent", back_populates="intel")
    nearest_facility = relationship("Facility", back_populates="intel_records")


class FacilityBaseline(Base):
    __tablename__ = "facility_baselines"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), unique=True, nullable=False)
    mean_frp = Column(Float, default=0.0, nullable=False)
    p90_frp = Column(Float, default=0.0, nullable=False)
    max_frp = Column(Float, default=0.0, nullable=False)
    detection_count = Column(Integer, default=0, nullable=False)
    active_days_30d = Column(Integer, default=0, nullable=False)
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    facility = relationship("Facility", back_populates="baseline")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="SET NULL"), nullable=True, index=True)
    alert_type = Column(String(64), nullable=False) # industrial_thermal_spike, uncharacteristic_flare, sudden_facility_anomaly, wildfire_encroachment
    severity = Column(String(16), nullable=False, index=True) # LOW, MEDIUM, HIGH, CRITICAL
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=True)
    status = Column(String(32), default="ACTIVE", nullable=False, index=True) # ACTIVE, ACKNOWLEDGED, RESOLVED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    event = relationship("ThermalEvent", back_populates="alerts")
    facility = relationship("Facility", back_populates="alerts")
