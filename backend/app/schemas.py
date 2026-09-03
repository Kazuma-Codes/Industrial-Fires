from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EvidenceDetails(BaseModel):
    summary: List[str] = Field(default_factory=list)
    spatial: Dict[str, Any] = Field(default_factory=dict)
    thermal: Dict[str, Any] = Field(default_factory=dict)
    temporal: Dict[str, Any] = Field(default_factory=dict)
    external_links: Dict[str, str] = Field(default_factory=dict)
    probabilities: Dict[str, float] = Field(default_factory=dict)


class EventIntelSummary(BaseModel):
    nearest_facility_id: Optional[int] = None
    nearest_facility_name: Optional[str] = None
    distance_to_facility_m: Optional[float] = None
    inside_facility: bool = False
    persistence_30d: float = 0.0
    detections_7d: int = 0
    detections_30d: int = 0
    frp_anomaly_ratio: float = 1.0
    classification: str = "unknown"
    classification_confidence: float = 0.5
    risk_score: int = 0
    risk_level: str = "LOW"
    evidence: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class EventSummary(BaseModel):
    id: int
    source: str
    satellite: str
    latitude: float
    longitude: float
    bright_ti4: Optional[float] = None
    frp: float
    confidence: Optional[str] = None
    acq_date: date
    acq_time: str
    daynight: str
    grid_id: str
    intel: Optional[EventIntelSummary] = None

    model_config = ConfigDict(from_attributes=True)


class EventDetail(EventSummary):
    bright_ti5: Optional[float] = None
    version: str
    created_at: Optional[datetime] = None
    classification: str = "unknown"
    classification_confidence: float = 0.5
    risk_score: int = 0
    risk_level: str = "LOW"
    distance_to_facility_m: Optional[float] = None
    nearest_facility_name: Optional[str] = None
    inside_facility: bool = False
    frp_anomaly_ratio: float = 1.0
    persistence_30d: float = 0.0
    intel: Optional[EventIntelSummary] = None


class GeoJSONGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float] # [longitude, latitude]


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: Dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]


class FacilityBaselineSchema(BaseModel):
    mean_frp: float
    p90_frp: float
    max_frp: float
    detection_count: int
    active_days_30d: int
    last_updated: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FacilitySummary(BaseModel):
    id: int
    osm_id: Optional[str] = None
    name: str
    facility_type: str
    criticality: int
    operator: Optional[str] = None
    latitude: float
    longitude: float
    baseline: Optional[FacilityBaselineSchema] = None

    model_config = ConfigDict(from_attributes=True)


class FacilityDetail(FacilitySummary):
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, alias="metadata_json")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    recent_events_count: int = 0
    active_alerts_count: int = 0

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AlertResponse(BaseModel):
    id: int
    event_id: int
    facility_id: Optional[int] = None
    facility_name: Optional[str] = None
    alert_type: str
    severity: str
    title: str
    description: str
    recommended_action: Optional[str] = None
    status: str
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class DashboardStats(BaseModel):
    total_events: int
    industrial_fires: int
    persistent_sources: int
    gas_flares: int
    wildfires: int
    agricultural_burning: int
    unknown: int
    critical_alerts: int
    high_alerts: int
    total_facilities: int
    last_ingestion: Optional[str] = None


class PipelineStatus(BaseModel):
    success: bool
    message: str
    counts: Dict[str, int] = Field(default_factory=dict)
