-- AI-Based Thermal Intelligence Platform - PostGIS Database Schema
-- Problem Statement ID: SIH26162 (NTRO)

-- Enable PostGIS extension (required for geospatial queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Industrial & Land Context Facilities
CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    osm_id VARCHAR(64) UNIQUE,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(64) NOT NULL, -- refinery, power_plant, factory, petroleum_well, industrial_area
    criticality INTEGER NOT NULL DEFAULT 1 CHECK (criticality BETWEEN 1 AND 5),
    operator VARCHAR(255),
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facilities_geom ON facilities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_facilities_type ON facilities(facility_type);
CREATE INDEX IF NOT EXISTS idx_facilities_criticality ON facilities(criticality);

-- 2. Raw FIRMS VIIRS Thermal Events
CREATE TABLE IF NOT EXISTS thermal_events (
    id SERIAL PRIMARY KEY,
    source VARCHAR(32) NOT NULL DEFAULT 'FIRMS_VIIRS',
    satellite VARCHAR(32) NOT NULL, -- SNPP, NOAA-20, NOAA-21
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    bright_ti4 DOUBLE PRECISION,     -- Brightness temperature I-4 (Kelvin)
    bright_ti5 DOUBLE PRECISION,     -- Brightness temperature I-5 (Kelvin)
    frp DOUBLE PRECISION NOT NULL,   -- Fire Radiative Power (MW)
    confidence VARCHAR(16),          -- low, nominal, high or 0-100%
    acq_date DATE NOT NULL,
    acq_time VARCHAR(8) NOT NULL,    -- HHMM in UTC
    daynight VARCHAR(2) NOT NULL,    -- 'D' or 'N'
    version VARCHAR(16) DEFAULT '2.0NRT',
    grid_id VARCHAR(32) NOT NULL,    -- Spatial cell snapped ~110-375m (e.g. "22.452,70.123")
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_thermal_event UNIQUE (source, satellite, acq_date, acq_time, latitude, longitude)
);

CREATE INDEX IF NOT EXISTS idx_thermal_events_geom ON thermal_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_thermal_events_acq_date ON thermal_events(acq_date DESC);
CREATE INDEX IF NOT EXISTS idx_thermal_events_grid_id ON thermal_events(grid_id);
CREATE INDEX IF NOT EXISTS idx_thermal_events_daynight ON thermal_events(daynight);

-- Trigger to automatically set geom Point from lat/lon on thermal_events
CREATE OR REPLACE FUNCTION set_thermal_event_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.geom IS NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_thermal_event_geom ON thermal_events;
CREATE TRIGGER trg_thermal_event_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON thermal_events
    FOR EACH ROW
    EXECUTE FUNCTION set_thermal_event_geom();

-- 3. Enriched Intelligence Layer (Classification, Persistence, Anomaly, Explainability)
CREATE TABLE IF NOT EXISTS event_intel (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL UNIQUE REFERENCES thermal_events(id) ON DELETE CASCADE,
    nearest_facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    distance_to_facility_m DOUBLE PRECISION,
    inside_facility BOOLEAN DEFAULT FALSE,
    persistence_30d DOUBLE PRECISION DEFAULT 0.0, -- active days / 30
    detections_7d INTEGER DEFAULT 0,
    detections_30d INTEGER DEFAULT 0,
    frp_anomaly_ratio DOUBLE PRECISION DEFAULT 1.0, -- current_frp / baseline_frp
    classification VARCHAR(64) NOT NULL DEFAULT 'unknown',
    -- persistent_industrial_source, industrial_fire, gas_flare, wildfire, agricultural_burning, unknown
    classification_confidence DOUBLE PRECISION DEFAULT 0.5,
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    risk_level VARCHAR(16) NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    classified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_intel_facility ON event_intel(nearest_facility_id);
CREATE INDEX IF NOT EXISTS idx_event_intel_classification ON event_intel(classification);
CREATE INDEX IF NOT EXISTS idx_event_intel_risk_level ON event_intel(risk_level);
CREATE INDEX IF NOT EXISTS idx_event_intel_risk_score ON event_intel(risk_score DESC);

-- 4. Facility Baselines (Rolling 30-day FRP Statistics)
CREATE TABLE IF NOT EXISTS facility_baselines (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
    mean_frp DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    p90_frp DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    max_frp DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    detection_count INTEGER NOT NULL DEFAULT 0,
    active_days_30d INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_baselines_facility ON facility_baselines(facility_id);

-- 5. Operational Intelligence Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    alert_type VARCHAR(64) NOT NULL, -- industrial_thermal_spike, uncharacteristic_flare, sudden_facility_anomaly, wildfire_encroachment
    severity VARCHAR(16) NOT NULL,    -- LOW, MEDIUM, HIGH, CRITICAL
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    recommended_action TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ACKNOWLEDGED, RESOLVED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_facility ON alerts(facility_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
