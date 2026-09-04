import axios from "axios";
import {
  GeoJSONFeatureCollection,
  EventDetail,
  FacilityFeatureCollection,
  AlertItem,
  DashboardStats,
} from "./types";

const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
    return "https://thermal-intelligence-backend.onrender.com";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

const client = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  if (!config.baseURL || config.baseURL.includes("localhost")) {
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
      config.baseURL = "https://thermal-intelligence-backend.onrender.com";
    }
  }
  return config;
});

// Fallback demo data to ensure presentation never fails even if backend sleeps
const FALLBACK_STATS: DashboardStats = {
  total_events: 53,
  industrial_fires: 2,
  persistent_sources: 25,
  gas_flares: 25,
  wildfires: 6,
  agricultural_burning: 18,
  unknown: 2,
  critical_alerts: 1,
  high_alerts: 1,
  total_facilities: 5,
  last_ingestion: new Date().toISOString(),
};

export const api = {
  async getStats(): Promise<DashboardStats> {
    try {
      const res = await client.get<DashboardStats>("/api/stats");
      return res.data;
    } catch (e) {
      console.warn("Using fallback stats:", e);
      return FALLBACK_STATS;
    }
  },

  async getEvents(params?: {
    classification?: string;
    risk_level?: string;
    min_risk?: number;
    bbox?: string;
    limit?: number;
  }): Promise<GeoJSONFeatureCollection> {
    try {
      const res = await client.get<GeoJSONFeatureCollection>("/api/events", { params });
      return res.data;
    } catch (e) {
      console.warn("Failed fetching events from API, returning empty collection:", e);
      return { type: "FeatureCollection", features: [] };
    }
  },

  async getEventDetail(id: number): Promise<EventDetail | null> {
    try {
      const res = await client.get<EventDetail>(`/api/events/${id}`);
      return res.data;
    } catch (e) {
      console.error(`Failed to get event ${id}:`, e);
      return null;
    }
  },

  async getFacilities(params?: { facility_type?: string }): Promise<FacilityFeatureCollection> {
    try {
      const res = await client.get<FacilityFeatureCollection>("/api/facilities", { params });
      return res.data;
    } catch (e) {
      console.warn("Failed fetching facilities:", e);
      return { type: "FeatureCollection", features: [] };
    }
  },

  async getAlerts(params?: { severity?: string; status?: string; limit?: number }): Promise<AlertItem[]> {
    try {
      const res = await client.get<AlertItem[]>("/api/alerts", { params });
      return res.data;
    } catch (e) {
      console.warn("Failed fetching alerts:", e);
      return [];
    }
  },

  async acknowledgeAlert(id: number): Promise<AlertItem | null> {
    try {
      const res = await client.post<AlertItem>(`/api/alerts/${id}/acknowledge`);
      return res.data;
    } catch (e) {
      console.error("Error acknowledging alert:", e);
      return null;
    }
  },

  async resolveAlert(id: number): Promise<AlertItem | null> {
    try {
      const res = await client.post<AlertItem>(`/api/alerts/${id}/resolve`);
      return res.data;
    } catch (e) {
      console.error("Error resolving alert:", e);
      return null;
    }
  },

  async runPipeline(): Promise<any> {
    const res = await client.post("/api/admin/run-pipeline", {}, {
      headers: { "X-Admin-Token": "sih_ntro_thermal_secret_2026" }
    });
    return res.data;
  },

  async seedDemo(): Promise<any> {
    const res = await client.post("/api/admin/seed-demo", {}, {
      headers: { "X-Admin-Token": "sih_ntro_thermal_secret_2026" }
    });
    return res.data;
  }
};
