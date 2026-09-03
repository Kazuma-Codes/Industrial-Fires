export type ClassificationType =
  | "industrial_fire"
  | "persistent_industrial_source"
  | "gas_flare"
  | "wildfire"
  | "agricultural_burning"
  | "unknown";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface EvidenceSpatial {
  distance_to_facility_m?: number | null;
  facility_name?: string | null;
  facility_type?: string | null;
  facility_criticality?: number | null;
  inside_facility?: boolean;
}

export interface EvidenceThermal {
  frp_mw?: number;
  bright_ti4_k?: number | null;
  confidence_score?: string | null;
  frp_anomaly_ratio?: number;
}

export interface EvidenceTemporal {
  persistence_30d?: number;
  detections_30d?: number;
  detections_7d?: number;
  day_or_night?: string;
}

export interface EvidenceData {
  summary?: string[];
  spatial?: EvidenceSpatial;
  thermal?: EvidenceThermal;
  temporal?: EvidenceTemporal;
  probabilities?: Record<string, number>;
  external_links?: {
    copernicus_browser?: string;
    nasa_worldview?: string;
    google_maps?: string;
  };
}

export interface EventProperties {
  id: number;
  source: string;
  satellite: string;
  latitude: number;
  longitude: number;
  bright_ti4?: number | null;
  bright_ti5?: number | null;
  frp: number;
  confidence?: string | null;
  acq_date: string;
  acq_time: string;
  daynight: string;
  grid_id: string;
  classification: ClassificationType;
  classification_confidence: number;
  risk_score: number;
  risk_level: RiskLevel;
  persistence_30d: number;
  frp_anomaly_ratio: number;
  distance_to_facility_m?: number | null;
  inside_facility?: boolean;
  nearest_facility_id?: number | null;
  nearest_facility_name?: string | null;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: EventProperties;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface EventDetail extends EventProperties {
  version?: string;
  created_at?: string;
  intel?: {
    classification?: string;
    risk_level?: RiskLevel;
    risk_score?: number;
    nearest_facility_name?: string | null;
    distance_to_facility_m?: number | null;
    inside_facility?: boolean;
    evidence?: EvidenceData;
  };
}

export interface FacilityProperties {
  id: number;
  osm_id?: string | null;
  name: string;
  facility_type: string;
  criticality: number;
  operator?: string | null;
  latitude: number;
  longitude: number;
  mean_frp?: number;
  p90_frp?: number;
  max_frp?: number;
  detection_count?: number;
  active_days_30d?: number;
}

export interface FacilityGeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: FacilityProperties;
}

export interface FacilityFeatureCollection {
  type: "FeatureCollection";
  features: FacilityGeoJSONFeature[];
}

export interface AlertItem {
  id: number;
  event_id: number;
  facility_id?: number | null;
  facility_name?: string | null;
  alert_type: string;
  severity: RiskLevel;
  title: string;
  description: string;
  recommended_action?: string | null;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DashboardStats {
  total_events: number;
  industrial_fires: number;
  persistent_sources: number;
  gas_flares: number;
  wildfires: number;
  agricultural_burning: number;
  unknown: number;
  critical_alerts: number;
  high_alerts: number;
  total_facilities: number;
  last_ingestion?: string | null;
}

export interface FilterState {
  classifications: ClassificationType[];
  riskLevels: RiskLevel[];
  minConfidence: number;
  dateRange: "all" | "today" | "3days" | "7days" | "30days";
  searchQuery: string;
}
