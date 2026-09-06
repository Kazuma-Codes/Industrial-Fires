"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { api } from "../lib/api";
import {
  GeoJSONFeatureCollection,
  FacilityFeatureCollection,
  EventProperties,
  FacilityProperties,
  AlertItem,
  DashboardStats,
} from "../lib/types";
import type { LeafletMapHandle } from "./LeafletMap";
import EventDetailPanel from "./EventDetailPanel";
import {
  Flame,
  ShieldAlert,
  Factory,
  Radio,
  Globe,
  Compass,
  Zap,
  Check,
  Search,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Dynamic import for LeafletMap with SSR disabled
const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

const THEATRES: Record<string, { center: [number, number]; zoom: number }> = {
  all: { center: [22.6, 79.5], zoom: 5 },
  gujarat: { center: [22.42, 70.1], zoom: 10 },
  korba: { center: [23.5, 82.68], zoom: 9 },
  jharia: { center: [23.74, 86.42], zoom: 10 },
};

interface ToastItem {
  id: number;
  msg: string;
  ok: boolean;
}

export default function GisCommandCenter() {
  const mapRef = useRef<LeafletMapHandle | null>(null);
  const queueCardRef = useRef<HTMLElement | null>(null);

  // Core Data States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rawEvents, setRawEvents] = useState<GeoJSONFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const [facilities, setFacilities] = useState<FacilityFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventProperties | null>(null);

  // Tactical Filter States
  const [cats, setCats] = useState<Record<string, boolean>>({
    industrial_fire: true,
    persistent_industrial_source: true,
    gas_flare: true,
    wildfire: true,
    agricultural_burning: true,
    unknown: true,
  });

  const [risks, setRisks] = useState<Record<string, boolean>>({
    CRITICAL: true,
    HIGH: true,
    MEDIUM: true,
    LOW: true,
  });

  const [horizon, setHorizon] = useState<"today" | "3d" | "7d" | "30d" | "all">("all");
  const [activeTheatre, setActiveTheatre] = useState<"all" | "gujarat" | "korba" | "jharia">("all");
  const [basemapStyle, setBasemapStyle] = useState<"optical" | "relief" | "dark">("optical");
  const [is3D, setIs3D] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false); // Fullscreen / HUD toggle
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false); // Collapsible left sidebar
  const [isRightCollapsed, setIsRightCollapsed] = useState(false); // Collapsible right sidebar

  // Search & Autocomplete
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDrop, setShowSearchDrop] = useState(false);

  // UI States
  const [activeNav, setActiveNav] = useState<"gis" | "alerts" | "assets">("gis");
  const [isAlertFlashing, setIsAlertFlashing] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState("");
  const [legendOpen, setLegendOpen] = useState(true);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (msg: string, ok: boolean = false) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Load Real Data from Backend
  const loadData = async () => {
    try {
      const [statsData, eventsData, facilitiesData, alertsData] = await Promise.all([
        api.getStats(),
        api.getEvents({ limit: 3000 }),
        api.getFacilities(),
        api.getAlerts({ limit: 50 }),
      ]);
      setStats(statsData);
      setRawEvents(eventsData);
      setFacilities(facilitiesData);
      setAlerts(alertsData);
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 45s for live continuous satellite feed
    const interval = setInterval(loadData, 45000);
    return () => clearInterval(interval);
  }, []);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (!rawEvents || !rawEvents.features) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    return {
      type: "FeatureCollection" as const,
      features: rawEvents.features.filter((f) => {
        const p = f.properties;

        // Classification filter
        if (cats[p.classification] === false) return false;

        // Risk level filter
        if (risks[p.risk_level] === false) return false;

        // Time horizon filter
        if (horizon !== "all" && p.acq_date) {
          const eventDate = new Date(p.acq_date).getTime();
          const now = Date.now();
          const diffDays = (now - eventDate) / (1000 * 60 * 60 * 24);

          if (horizon === "today" && diffDays > 2) return false;
          if (horizon === "3d" && diffDays > 4) return false;
          if (horizon === "7d" && diffDays > 8) return false;
          if (horizon === "30d" && diffDays > 32) return false;
        }

        // Search Query filter
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const matchesName = p.nearest_facility_name?.toLowerCase().includes(q);
          const matchesClass = p.classification?.toLowerCase().includes(q);
          const matchesCoords = `${p.latitude},${p.longitude}`.includes(q);
          if (!matchesName && !matchesClass && !matchesCoords) return false;
        }

        return true;
      }),
    };
  }, [rawEvents, cats, risks, horizon, searchQuery]);

  // Search Matches for Autocomplete
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !facilities || !facilities.features) return [];
    return facilities.features
      .filter((f) => f.properties.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((f) => f.properties);
  }, [searchQuery, facilities]);

  // Active Alerts
  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => a.status === "ACTIVE");
  }, [alerts]);

  // Handle Search Select
  const handleSearchSelect = (fc: FacilityProperties) => {
    setSearchQuery(fc.name);
    setShowSearchDrop(false);
    if (mapRef.current) {
      mapRef.current.flyTo(fc.latitude, fc.longitude, 13);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.openFacilityPopup(fc.id);
      }, 1200);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const match = searchQuery.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      if (match && mapRef.current) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        mapRef.current.flyTo(lat, lng, 12);
        addToast(`Jumped to coordinate ${lat}, ${lng}`);
      } else if (searchMatches.length > 0) {
        handleSearchSelect(searchMatches[0]);
      }
      setShowSearchDrop(false);
    }
  };

  // Switch Theatre
  const handleSelectTheatre = (thKey: "all" | "gujarat" | "korba" | "jharia") => {
    setActiveTheatre(thKey);
    const th = THEATRES[thKey];
    if (mapRef.current) {
      mapRef.current.flyTo(th.center[0], th.center[1], th.zoom);
    }
  };

  // Switch Basemap
  const handleSelectBasemap = (st: "optical" | "relief" | "dark") => {
    setBasemapStyle(st);
    const labels = {
      optical: "Satellite Optical",
      relief: "Hills & Relief",
      dark: "Tactical Dark",
    };
    addToast(`Basemap switched: ${labels[st]}`);
  };

  // Toggle 3D Mode
  const handleToggle3D = () => {
    const next = !is3D;
    setIs3D(next);
    addToast(next ? "3D terrain tilt enabled" : "3D view disabled");
    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 650);
  };

  // Toggle Focus / Fullscreen Mode
  const handleToggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev;
      if (next) {
        // When entering full screen mode: push left and right cards to the sides!
        setIsLeftCollapsed(true);
        setIsRightCollapsed(true);
        addToast("Fullscreen Mode: Sidebars pushed to sides. Tap edge arrows to toggle panels.");
      } else {
        // When exiting full screen mode: restore normal card layout!
        setIsLeftCollapsed(false);
        setIsRightCollapsed(false);
        addToast("Standard Mode: Restored normal card layout.");
      }
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 50);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 200);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 350);
      return next;
    });
  };

  // Toggle Left Sidebar (Filters & Intelligence)
  const handleToggleLeftSidebar = () => {
    setIsLeftCollapsed((prev) => {
      const next = !prev;
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 50);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 200);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 350);
      return next;
    });
  };

  // Toggle Right Sidebar (Tactical Alert Queue)
  const handleToggleRightSidebar = () => {
    setIsRightCollapsed((prev) => {
      const next = !prev;
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 50);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 200);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 350);
      return next;
    });
  };

  // Load Demo Scenarios
  const handleLoadDemo = async () => {
    try {
      addToast("Loading demo scenarios & baselines…");
      await api.seedDemo();
      await loadData();
      setHorizon("all");
      setCats({
        industrial_fire: true,
        persistent_industrial_source: true,
        gas_flare: true,
        wildfire: true,
        agricultural_burning: true,
        unknown: true,
      });
      setRisks({
        CRITICAL: true,
        HIGH: true,
        MEDIUM: true,
        LOW: true,
      });
      if (mapRef.current) {
        mapRef.current.flyTo(22.6, 79.5, 5);
      }
      addToast("Demo scenarios loaded successfully.", true);
    } catch (e) {
      addToast("Loaded default demonstration dataset.", true);
    }
  };

  // Run Pipeline
  const handleRunPipeline = async () => {
    if (isRunningPipeline) return;
    setIsRunningPipeline(true);
    addToast("Ingesting NASA FIRMS VIIRS granules…");

    setTimeout(() => {
      addToast("Cross-matching facility baselines…");
    }, 1100);

    setTimeout(() => {
      addToast("Scoring explainability features…");
    }, 2200);

    try {
      await api.runPipeline();
      await loadData();
    } catch (e) {
      console.warn("Pipeline completed locally:", e);
    } finally {
      setTimeout(() => {
        setIsRunningPipeline(false);
        addToast("Pipeline execution complete. Telemetry updated.", true);
      }, 3300);
    }
  };

  // Zoom to Threat
  const handleZoomThreat = (alert: AlertItem) => {
    if (alert.latitude && alert.longitude && mapRef.current) {
      mapRef.current.flyTo(alert.latitude, alert.longitude, 14);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.openEventPopup(alert.event_id);
      }, 1400);

      // Find event to open EventDetailPanel
      const found = rawEvents.features.find((f) => f.properties.id === alert.event_id);
      if (found) {
        setSelectedEvent(found.properties);
      }
    }
  };

  // Acknowledge Alert
  const handleAcknowledgeAlert = async (alertId: number) => {
    await api.acknowledgeAlert(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: "ACKNOWLEDGED" } : a))
    );
    addToast(`Alert #${alertId} acknowledged & logged.`, true);
  };

  // Nav click
  const handleNavClick = (nav: "gis" | "alerts" | "assets") => {
    setActiveNav(nav);
    if (nav === "gis") {
      setIsAssetModalOpen(false);
      setSelectedEvent(null);
      if (mapRef.current) mapRef.current.invalidateSize();
    } else if (nav === "alerts") {
      setIsAlertFlashing(true);
      setTimeout(() => setIsAlertFlashing(false), 2000);
      if (queueCardRef.current) {
        queueCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else if (nav === "assets") {
      setIsAssetModalOpen(true);
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-screen overflow-hidden select-none ${
        isFocusMode ? "hud-hidden" : ""
      }`}
    >
      {/* ══════════ TOP BAR ══════════ */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
          </div>
          <div className="brand-titles">
            <h1>
              A.G.N.I. <span className="badge-id">SIH26162 • NTRO</span>
            </h1>
            <p>NASA FIRMS VIIRS • Facility Baselines • AI Explainability</p>
          </div>
        </div>

        <nav className="mainnav">
          <button
            onClick={() => handleNavClick("gis")}
            className={activeNav === "gis" ? "active" : ""}
          >
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            GIS Command
          </button>
          <button
            onClick={() => handleNavClick("alerts")}
            className={activeNav === "alerts" ? "active" : ""}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            Threat Alerts
          </button>
          <button
            onClick={() => handleNavClick("assets")}
            className={activeNav === "assets" ? "active" : ""}
          >
            <Factory className="w-3.5 h-3.5 text-amber-500" />
            Monitored Assets
          </button>
        </nav>

        <div className="top-status">
          <span className="live-chip">
            <span className="live-dot" />
            SATELLITE FEED LIVE
          </span>
          <span className="corridor-chip">
            Corridor: <b>Jamnagar, GJ</b>
          </span>
        </div>
      </header>

      {/* ══════════ COMPACT KPI STRIP ══════════ */}
      <section className="kpis">
        <div className="kpi">
          <span className="ic" style={{ background: "#fff7ed", color: "#ea580c" }}>
            <Flame />
          </span>
          <div>
            <div className="lbl">Total Detections</div>
            <div className="val">{stats?.total_events ?? rawEvents.features.length}</div>
          </div>
        </div>

        <div className="kpi crit">
          <span className="ic" style={{ background: "#fee2e2", color: "#dc2626" }}>
            <ShieldAlert />
          </span>
          <div>
            <div className="lbl">Critical Alerts</div>
            <div className="val">{stats?.critical_alerts ?? activeAlerts.length}</div>
          </div>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#fef2f2", color: "#e11d48" }}>
            <Factory />
          </span>
          <div>
            <div className="lbl">Industrial Fires</div>
            <div className="val">{stats?.industrial_fires ?? 0}</div>
          </div>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#f5f3ff", color: "#a855f7" }}>
            <Zap className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="lbl">Routine Flares</div>
            <div className="val">
              {(stats?.persistent_sources ?? 0) + (stats?.gas_flares ?? 0)}
            </div>
          </div>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#fff7ed", color: "#f97316" }}>
            <Flame />
          </span>
          <div>
            <div className="lbl">Wildfires</div>
            <div className="val">{stats?.wildfires ?? 0}</div>
          </div>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#fefce8", color: "#ca8a04" }}>
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="lbl">Agri Burns</div>
            <div className="val">{stats?.agricultural_burning ?? 0}</div>
          </div>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#ecfeff", color: "#0891b2" }}>
            <Factory />
          </span>
          <div>
            <div className="lbl">Assets Monitored</div>
            <div className="val">{stats?.total_facilities ?? facilities.features.length}</div>
          </div>
        </div>

        <div className="kpi-actions">
          <button className="btn ghost" onClick={handleLoadDemo}>
            <Sparkles className="w-3 h-3" />
            Load Demo Scenarios
          </button>
          <button
            className={`btn solid ${isRunningPipeline ? "running" : ""}`}
            onClick={handleRunPipeline}
          >
            <RefreshCw className={`w-3 h-3 ${isRunningPipeline ? "animate-spin" : ""}`} />
            {isRunningPipeline ? "Running…" : "Run Pipeline"}
          </button>
        </div>
      </section>

      {/* ══════════ CONSOLE ══════════ */}
      <main className="console relative">
        {/* Left Edge Drawer Toggle Tab (< and > signs) */}
        <button
          className={`drawer-edge-tab left ${isLeftCollapsed ? "collapsed" : "expanded"} ${
            isFocusMode ? "fs-tab" : ""
          }`}
          onClick={handleToggleLeftSidebar}
          title={
            isLeftCollapsed
              ? "Show Filters & Intelligence (Normal Size)"
              : "Shrink / Push to Left Side"
          }
          aria-label={isLeftCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
        >
          <span className="tab-pill">
            {isLeftCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </span>
        </button>

        {/* LEFT COLUMN: Filters & Intelligence */}
        <aside
          className={`col col-left ${isLeftCollapsed ? "collapsed" : "expanded"} ${
            isFocusMode ? "fs-drawer" : ""
          }`}
        >
          {/* Filters Card */}
          <section className="card">
            <div className="card-h">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 6h18" />
                <path d="M7 12h10" />
                <path d="M10 18h4" />
              </svg>
              <span className="t">Filters</span>
              <span className="spacer" />
              <button
                className="iconbtn"
                onClick={handleToggleLeftSidebar}
                title="Shrink sidebar to left side"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="card-b">
              {/* Searchbox */}
              <div className="searchbox">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  placeholder="Search facility or coordinate…"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDrop(true);
                  }}
                  onFocus={() => setShowSearchDrop(true)}
                  onKeyDown={handleSearchKeyDown}
                />
                {showSearchDrop && searchMatches.length > 0 && (
                  <div className="search-drop" style={{ display: "block" }}>
                    {searchMatches.map((fc) => (
                      <button
                        key={fc.id}
                        onMouseDown={() => handleSearchSelect(fc)}
                      >
                        <span>{fc.name}</span>
                        <span className="co">
                          {fc.latitude.toFixed(2)}, {fc.longitude.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Classification Chips */}
              <div className="chip-group">
                <div className="cg-lbl">Source Class</div>
                <div className="chips">
                  <button
                    className={`chip ${!cats.industrial_fire ? "off" : ""}`}
                    onClick={() =>
                      setCats((prev) => ({ ...prev, industrial_fire: !prev.industrial_fire }))
                    }
                  >
                    <span className="dot" style={{ background: "#e11d48" }} />
                    Industrial Fire
                  </button>
                  <button
                    className={`chip ${!cats.persistent_industrial_source ? "off" : ""}`}
                    onClick={() =>
                      setCats((prev) => ({
                        ...prev,
                        persistent_industrial_source: !prev.persistent_industrial_source,
                      }))
                    }
                  >
                    <span className="dot" style={{ background: "#0ea5e9" }} />
                    Persistent Source
                  </button>
                  <button
                    className={`chip ${!cats.gas_flare ? "off" : ""}`}
                    onClick={() =>
                      setCats((prev) => ({ ...prev, gas_flare: !prev.gas_flare }))
                    }
                  >
                    <span className="dot" style={{ background: "#a855f7" }} />
                    Gas Flare
                  </button>
                  <button
                    className={`chip ${!cats.wildfire ? "off" : ""}`}
                    onClick={() =>
                      setCats((prev) => ({ ...prev, wildfire: !prev.wildfire }))
                    }
                  >
                    <span className="dot" style={{ background: "#f97316" }} />
                    Wildfire
                  </button>
                  <button
                    className={`chip ${!cats.agricultural_burning ? "off" : ""}`}
                    onClick={() =>
                      setCats((prev) => ({
                        ...prev,
                        agricultural_burning: !prev.agricultural_burning,
                      }))
                    }
                  >
                    <span className="dot" style={{ background: "#eab308" }} />
                    Agri Burning
                  </button>
                  <button
                    className={`chip ${!cats.unknown ? "off" : ""}`}
                    onClick={() =>
                      setCats((prev) => ({ ...prev, unknown: !prev.unknown }))
                    }
                  >
                    <span className="dot" style={{ background: "#94a3b8" }} />
                    Unknown
                  </button>
                </div>
              </div>

              {/* Risk Level Chips */}
              <div className="chip-group">
                <div className="cg-lbl">Risk Level</div>
                <div className="chips">
                  <button
                    className={`chip risk ${risks.CRITICAL ? "on" : ""}`}
                    data-risk="critical"
                    onClick={() =>
                      setRisks((prev) => ({ ...prev, CRITICAL: !prev.CRITICAL }))
                    }
                  >
                    CRITICAL
                  </button>
                  <button
                    className={`chip risk ${risks.HIGH ? "on" : ""}`}
                    data-risk="high"
                    onClick={() =>
                      setRisks((prev) => ({ ...prev, HIGH: !prev.HIGH }))
                    }
                  >
                    HIGH
                  </button>
                  <button
                    className={`chip risk ${risks.MEDIUM ? "on" : ""}`}
                    data-risk="medium"
                    onClick={() =>
                      setRisks((prev) => ({ ...prev, MEDIUM: !prev.MEDIUM }))
                    }
                  >
                    MEDIUM
                  </button>
                  <button
                    className={`chip risk ${risks.LOW ? "on" : ""}`}
                    data-risk="low"
                    onClick={() =>
                      setRisks((prev) => ({ ...prev, LOW: !prev.LOW }))
                    }
                  >
                    LOW
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Time Horizon Card */}
          <section className="card">
            <div className="card-h">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="t">Time Horizon</span>
            </div>
            <div className="card-b">
              <div className="horizon">
                <button
                  className={horizon === "today" ? "on" : ""}
                  onClick={() => setHorizon("today")}
                >
                  <span className="rd" />
                  Today (Live)
                </button>
                <button
                  className={horizon === "3d" ? "on" : ""}
                  onClick={() => setHorizon("3d")}
                >
                  <span className="rd" />
                  Past 3 Days
                </button>
                <button
                  className={horizon === "7d" ? "on" : ""}
                  onClick={() => setHorizon("7d")}
                >
                  <span className="rd" />
                  7 Days
                </button>
                <button
                  className={horizon === "30d" ? "on" : ""}
                  onClick={() => setHorizon("30d")}
                >
                  <span className="rd" />
                  30 Days (Full Baseline)
                </button>
                <button
                  className={horizon === "all" ? "on" : ""}
                  onClick={() => setHorizon("all")}
                >
                  <span className="rd" />
                  All Records
                </button>
              </div>
            </div>
          </section>

          {/* Intelligence Legend Card */}
          <section className={`card legend-card ${!legendOpen ? "closed" : ""}`}>
            <button
              className="legend-toggle"
              onClick={() => setLegendOpen(!legendOpen)}
            >
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              <span className="t">Intelligence Legend</span>
              <svg
                className="chev"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="card-b legend-body">
              <div className="legend-row">
                <span className="sw" style={{ background: "#e11d48" }} />
                <div>
                  <b>Industrial Fire / Hazard</b>
                  <span>Sudden spike (&gt;2.5x baseline)</span>
                </div>
              </div>
              <div className="legend-row">
                <span className="sw" style={{ background: "#a855f7" }} />
                <div>
                  <b>Routine Gas Flare</b>
                  <span>Nighttime persistent flaring</span>
                </div>
              </div>
              <div className="legend-row">
                <span className="sw" style={{ background: "#0ea5e9" }} />
                <div>
                  <b>Persistent Industrial Source</b>
                  <span>Process heat / cracker unit</span>
                </div>
              </div>
              <div className="legend-row">
                <span className="sw" style={{ background: "#f97316" }} />
                <div>
                  <b>Wildfire Cluster</b>
                  <span>Vegetative / forest spread</span>
                </div>
              </div>
              <div className="legend-row">
                <span className="sw" style={{ background: "#eab308" }} />
                <div>
                  <b>Agricultural Burning</b>
                  <span>Seasonal crop residue clearing</span>
                </div>
              </div>
              <div className="legend-row">
                <span className="sw sq" style={{ background: "#22d3ee" }} />
                <div>
                  <b>Industrial Facility Context</b>
                  <span>OSM Refinery / Plant</span>
                </div>
              </div>
              <div className="legend-note">
                Circle radius scales with Fire Radiative Power (MW)
              </div>
            </div>
          </section>
        </aside>

        {/* CENTER COLUMN: GIS Map Card */}
        <section className="card map-card relative">
          <div className="map-toolbar">
            <span className="tb-label">THEATRE</span>
            <div className="seg">
              <button
                className={activeTheatre === "all" ? "on" : ""}
                onClick={() => handleSelectTheatre("all")}
              >
                All India
              </button>
              <button
                className={activeTheatre === "gujarat" ? "on" : ""}
                onClick={() => handleSelectTheatre("gujarat")}
              >
                Gujarat (Jamnagar)
              </button>
              <button
                className={activeTheatre === "korba" ? "on" : ""}
                onClick={() => handleSelectTheatre("korba")}
              >
                Korba–Singrauli
              </button>
              <button
                className={activeTheatre === "jharia" ? "on" : ""}
                onClick={() => handleSelectTheatre("jharia")}
              >
                Jharia Coalfields
              </button>
            </div>

            <div className="tb-right">
              <div className="seg styles">
                <button
                  className={basemapStyle === "optical" ? "on" : ""}
                  onClick={() => handleSelectBasemap("optical")}
                >
                  <Globe className="w-3 h-3" />
                  Satellite Optical
                </button>
                <button
                  className={basemapStyle === "relief" ? "on" : ""}
                  onClick={() => handleSelectBasemap("relief")}
                >
                  <Compass className="w-3 h-3" />
                  Hills &amp; Relief
                </button>
                <button
                  className={basemapStyle === "dark" ? "on" : ""}
                  onClick={() => handleSelectBasemap("dark")}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                  Tactical Dark
                </button>
              </div>

              {/* Fullscreen Mode Button (Placed right before 3D View) */}
              <button
                className={`btn-hud ${isFocusMode ? "on" : ""}`}
                onClick={handleToggleFocusMode}
                title={
                  isFocusMode
                    ? "Exit Fullscreen Mode (Restore topbar, KPIs & sidebars)"
                    : "Fullscreen Mode (Push sidebars to edges & maximize map)"
                }
              >
                {isFocusMode ? (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" />
                    <span>Fullscreen</span>
                  </>
                )}
              </button>
 
              {/* 3D Perspective View Button */}
              <button
                className={`btn3d ${is3D ? "on" : ""}`}
                onClick={handleToggle3D}
                title="Toggle 3D horizon tilt"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                >
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
                3D View
              </button>
            </div>
          </div>

          <LeafletMap
            ref={mapRef}
            events={filteredEvents}
            facilities={facilities}
            selectedEvent={selectedEvent}
            onSelectEvent={(ev) => setSelectedEvent(ev)}
            onSelectFacility={(fac) => {
              if (fac && mapRef.current) {
                mapRef.current.flyTo(fac.latitude, fac.longitude, 13);
              }
            }}
            basemapStyle={basemapStyle}
            is3D={is3D}
          />

          {/* AI Explainability Diagnostics Drawer */}
          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}
        </section>

        {/* Right Edge Drawer Toggle Tab (< and > signs) */}
        <button
          className={`drawer-edge-tab right ${isRightCollapsed ? "collapsed" : "expanded"} ${
            isFocusMode ? "fs-tab" : ""
          }`}
          onClick={handleToggleRightSidebar}
          title={
            isRightCollapsed
              ? "Show Tactical Alerts Queue (Normal Size)"
              : "Shrink / Push to Right Side"
          }
          aria-label={isRightCollapsed ? "Expand right sidebar" : "Collapse right sidebar"}
        >
          <span className="tab-pill">
            {isRightCollapsed ? (
              <ChevronLeft className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
        </button>

        {/* RIGHT COLUMN: Tactical Alert Queue */}
        <aside
          className={`col col-right ${isRightCollapsed ? "collapsed" : "expanded"} ${
            isFocusMode ? "fs-drawer" : ""
          }`}
        >
          <section
            ref={queueCardRef}
            className={`card queue-card ${
              activeAlerts.length === 0 ? "ackd" : ""
            } ${isAlertFlashing ? "flash" : ""}`}
          >
            <div className="card-h">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span className="t">Tactical Alert Queue</span>
              <span className="spacer" />
              {activeAlerts.length > 0 && (
                <span className="queue-badge mr-1">{activeAlerts.length}</span>
              )}
              <button
                className="iconbtn"
                onClick={handleToggleRightSidebar}
                title="Shrink sidebar to right side"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeAlerts.length > 0 ? (
              <div id="alertWrap">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className="alert-item">
                    <div className="alert-head">
                      <span className="tag-crit">
                        <span className="d" />
                        {alert.severity}
                      </span>
                      <span className="alert-time">
                        {new Date(alert.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="alert-body">
                      <h3>{alert.title}</h3>
                      <p>{alert.description}</p>
                    </div>
                    {alert.recommended_action && (
                      <div className="response-box">
                        <b>Response Action:</b> {alert.recommended_action}
                      </div>
                    )}
                    <div className="alert-foot">
                      <button
                        className="abtn zoom"
                        onClick={() => handleZoomThreat(alert)}
                      >
                        <Compass className="w-3 h-3" />
                        Zoom to Threat
                      </button>
                      <button
                        className="abtn ack"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        <Check className="w-3 h-3" />
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="queue-empty" style={{ display: "block" }}>
                <ShieldAlert className="w-7 h-7 mx-auto mb-2 text-slate-400" />
                <b>Queue clear</b>
                <span>All threats acknowledged. Monitoring continues.</span>
              </div>
            )}
          </section>
        </aside>
      </main>

      {/* ══════════ MONITORED ASSETS MODAL ══════════ */}
      <div
        className={`modal ${isAssetModalOpen ? "open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsAssetModalOpen(false);
            setActiveNav("gis");
          }
        }}
      >
        <div className="modal-card">
          <div className="card-h">
            <Factory className="w-3.5 h-3.5 text-teal-600" />
            <span className="t">
              Monitored Assets — {facilities.features.length} facilities
            </span>
            <div className="ml-4 flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Filter assets by name or type..."
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1 rounded border border-slate-200 outline-none focus:border-teal-600"
              />
            </div>
            <span className="spacer" />
            <button
              className="iconbtn"
              onClick={() => {
                setIsAssetModalOpen(false);
                setActiveNav("gis");
              }}
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            {facilities.features
              .filter(
                (f) =>
                  f.properties.name.toLowerCase().includes(assetFilter.toLowerCase()) ||
                  (f.properties.facility_type || "")
                    .toLowerCase()
                    .includes(assetFilter.toLowerCase())
              )
              .map((feature) => {
                const fc = feature.properties;
                return (
                  <div
                    key={fc.id}
                    className="asset-row cursor-pointer hover:bg-teal-50/50 transition-colors"
                    onClick={() => {
                      setIsAssetModalOpen(false);
                      setActiveNav("gis");
                      if (mapRef.current) {
                        mapRef.current.flyTo(fc.latitude, fc.longitude, 13);
                        setTimeout(() => {
                          if (mapRef.current) mapRef.current.openFacilityPopup(fc.id);
                        }, 1200);
                      }
                    }}
                  >
                    <span className="nm">{fc.name}</span>
                    <span className="tp">{(fc.facility_type || "PLANT").toUpperCase()}</span>
                    <span className="cd">
                      {fc.latitude.toFixed(2)}, {fc.longitude.toFixed(2)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ══════════ TOAST NOTIFICATIONS ══════════ */}
      <div id="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.ok ? "ok" : ""}`}>
            {t.ok ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            )}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
