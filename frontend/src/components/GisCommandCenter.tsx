"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { LeafletMapHandle, FacilityItem, DetectionItem } from "./LeafletMap";

// Dynamic import with SSR disabled to prevent Leaflet window reference errors
const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

/* ---------- Seeded RNG (Mulberry32) ---------- */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);
function jr(n: number) {
  return (rng() - 0.5) * n;
}

/* ---------- 60 Monitored Facilities ---------- */
const NAMED_FACILITIES: [string, number, number, string][] = [
  ["Reliance Jamnagar Refinery Complex (DTA & SEZ)", 22.47, 70.11, "Refinery"],
  ["Nayara Energy Vadinar Refinery", 22.329, 69.672, "Refinery"],
  ["IOCL Panipat Refinery & Petrochemical Complex", 29.752, 76.77, "Refinery"],
  ["IOCL Barauni Refinery", 25.492, 86.22, "Refinery"],
  ["IOCL Haldia Refinery", 22.033, 88.06, "Refinery"],
  ["IOCL Paradip Refinery", 20.26, 86.61, "Refinery"],
  ["HPCL Visakhapatnam Refinery", 17.683, 83.27, "Refinery"],
  ["MRPL Mangalore Refinery", 12.92, 74.8, "Refinery"],
  ["BPCL Kochi Refinery (Ambalamugal)", 9.987, 76.71, "Refinery"],
  ["IOCL Guwahati Refinery", 26.18, 91.75, "Refinery"],
  ["IOCL Bongaigaon Refinery", 26.55, 90.56, "Refinery"],
  ["IOCL Digboi Refinery", 27.39, 95.63, "Refinery"],
  ["IOCL Mathura Refinery", 27.48, 77.68, "Refinery"],
  ["BPCL Mumbai Refinery (Mahul)", 19.04, 72.88, "Refinery"],
  ["HPCL Mumbai Refinery", 18.96, 72.84, "Refinery"],
  ["CPCL Chennai Refinery", 13.17, 80.3, "Refinery"],
  ["IOCL Gujarat Refinery (Koyali)", 22.27, 73.95, "Refinery"],
  ["HPCL Bhatinda Refinery", 30.2, 74.95, "Refinery"],
  ["IOCL Bina Refinery", 24.05, 78.95, "Refinery"],
  ["Numaligarh Refinery", 26.72, 93.68, "Refinery"],
  ["ONGC Hazira Gas Processing", 21.11, 72.61, "Plant"],
  ["NTPC Korba Super Thermal", 22.35, 82.75, "Power"],
  ["Vindhyachal STPS (Singrauli)", 24.11, 82.9, "Power"],
  ["BCCL Jharia Coalfields", 23.67, 86.42, "Mine"],
];

const INITIAL_FACILITIES: FacilityItem[] = NAMED_FACILITIES.map((n, i) => ({
  name: n[0],
  lat: n[1],
  lng: n[2],
  type: n[3],
  named: true,
  id: i + 1,
}));

const HUBS: [number, number][] = [
  [22.4, 70.2],
  [23.6, 86.4],
  [22.3, 82.8],
  [26.2, 91.8],
  [19.0, 72.9],
  [28.6, 77.2],
  [30.7, 76.8],
  [21.2, 72.7],
  [17.7, 83.3],
  [13.1, 80.3],
  [22.9, 73.9],
  [25.5, 85.1],
];

const FACILITY_TYPES = [
  "Gas Terminal",
  "Power Station",
  "Steel Plant",
  "Chemical Works",
  "Cement Works",
  "Petrochem Unit",
];

let ai = 0;
while (INITIAL_FACILITIES.length < 60) {
  const hb = HUBS[ai % HUBS.length];
  const tp = FACILITY_TYPES[ai % FACILITY_TYPES.length];
  INITIAL_FACILITIES.push({
    name: `${tp} — Asset G-${25 + ai}`,
    lat: hb[0] + jr(1.6),
    lng: hb[1] + jr(1.8),
    type: tp,
    named: false,
    id: INITIAL_FACILITIES.length + 1,
  });
  ai++;
}

/* ---------- 61 Initial Detections ---------- */
const AGES: ("today" | "3d" | "7d" | "30d")[] = ["today", "3d", "7d", "30d"];
const INITIAL_DETECTIONS: DetectionItem[] = [
  {
    cat: "industrial",
    risk: "critical",
    frp: 36.4,
    age: "today",
    lat: 22.3315,
    lng: 69.6745,
    note: "Uncontained thermal anomaly — 3.6x baseline",
  },
];

const FL_R: ("critical" | "high" | "medium" | "low")[] = [
  "high",
  "medium",
  "medium",
  "medium",
  "medium",
  "medium",
  "low",
  "low",
  "low",
  "low",
  "high",
  "medium",
];
for (let fI = 0; fI < 12; fI++) {
  const bN = NAMED_FACILITIES[fI % NAMED_FACILITIES.length];
  INITIAL_DETECTIONS.push({
    cat: "flare",
    risk: FL_R[fI],
    frp: 8 + rng() * 20,
    age: AGES[fI % 4],
    lat: bN[1] + jr(0.08),
    lng: bN[2] + jr(0.08),
    note: "Nighttime persistent flaring",
  });
}

const PE_R: ("critical" | "high" | "medium" | "low")[] = [
  "medium",
  "medium",
  "medium",
  "medium",
  "medium",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
];
for (let pI = 0; pI < 13; pI++) {
  const bP = NAMED_FACILITIES[(pI + 11) % NAMED_FACILITIES.length];
  INITIAL_DETECTIONS.push({
    cat: "persistent",
    risk: PE_R[pI],
    frp: 4 + rng() * 8,
    age: AGES[(pI + 1) % 4],
    lat: bP[1] + jr(0.05),
    lng: bP[2] + jr(0.05),
    note: "Process heat / cracker unit",
  });
}

const WF_C: [number, number][] = [
  [30.1, 79.1],
  [31.2, 77.2],
  [25.9, 94.5],
  [23.7, 92.7],
  [22.5, 80.5],
  [20.5, 84.5],
];
const WF_R: ("critical" | "high" | "medium" | "low")[] = [
  "high",
  "high",
  "medium",
  "medium",
  "medium",
  "medium",
];
for (let wI = 0; wI < 6; wI++) {
  INITIAL_DETECTIONS.push({
    cat: "wildfire",
    risk: WF_R[wI],
    frp: 6 + rng() * 34,
    age: AGES[wI % 4],
    lat: WF_C[wI][0] + jr(0.4),
    lng: WF_C[wI][1] + jr(0.4),
    note: "Vegetative / forest spread",
  });
}

const AG_R: ("critical" | "high" | "medium" | "low")[] = [
  "medium",
  "medium",
  "medium",
  "medium",
  "medium",
  "medium",
  "medium",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
];
for (let gI = 0; gI < 15; gI++) {
  INITIAL_DETECTIONS.push({
    cat: "agri",
    risk: AG_R[gI],
    frp: 2 + rng() * 6,
    age: AGES[gI % 4],
    lat: 29.2 + rng() * 2.2,
    lng: 74.6 + rng() * 4.8,
    note: "Seasonal crop residue clearing",
  });
}

const UN_R: ("critical" | "high" | "medium" | "low")[] = [
  "medium",
  "medium",
  "medium",
  "medium",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
  "low",
];
for (let uI = 0; uI < 14; uI++) {
  INITIAL_DETECTIONS.push({
    cat: "unknown",
    risk: UN_R[uI],
    frp: 1 + rng() * 5,
    age: AGES[(uI + 2) % 4],
    lat: 12 + rng() * 18,
    lng: 72 + rng() * 20,
    note: "Unclassified thermal signature",
  });
}

const HSET: Record<string, ("today" | "3d" | "7d" | "30d")[]> = {
  today: ["today"],
  "3d": ["today", "3d"],
  "7d": ["today", "3d", "7d"],
  "30d": ["today", "3d", "7d", "30d"],
  all: ["today", "3d", "7d", "30d"],
};

const THEATRES: Record<string, { center: [number, number]; zoom: number }> = {
  all: { center: [22.6, 79.5], zoom: 5 },
  gujarat: { center: [22.42, 70.1], zoom: 9 },
  korba: { center: [23.2, 82.8], zoom: 8 },
  jharia: { center: [23.67, 86.42], zoom: 9 },
};

interface ToastItem {
  id: number;
  msg: string;
  ok: boolean;
}

export default function GisCommandCenter() {
  const mapRef = useRef<LeafletMapHandle | null>(null);
  const queueCardRef = useRef<HTMLElement | null>(null);

  // Filter States
  const [cats, setCats] = useState<Record<string, boolean>>({
    industrial: true,
    persistent: true,
    flare: true,
    wildfire: true,
    agri: true,
    unknown: true,
  });

  const [risks, setRisks] = useState<Record<string, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true,
  });

  const [horizon, setHorizon] = useState<"today" | "3d" | "7d" | "30d" | "all">("all");
  const [activeTheatre, setActiveTheatre] = useState<"all" | "gujarat" | "korba" | "jharia">("all");
  const [basemapStyle, setBasemapStyle] = useState<"optical" | "relief" | "dark">("optical");
  const [is3D, setIs3D] = useState(false);

  // Search & Autocomplete
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDrop, setShowSearchDrop] = useState(false);

  // Alert Queue
  const [isAlertAcked, setIsAlertAcked] = useState(false);
  const [isAlertFlashing, setIsAlertFlashing] = useState(false);

  // Navigation & Modals
  const [activeNav, setActiveNav] = useState<"gis" | "alerts" | "assets">("gis");
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState("");

  // Legend Collapse
  const [legendOpen, setLegendOpen] = useState(true);

  // Pipeline Execution State
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (msg: string, ok: boolean = false) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Filtered Detections
  const filteredDetections = useMemo(() => {
    const allowedAges = HSET[horizon];
    return INITIAL_DETECTIONS.filter(
      (d) => cats[d.cat] && risks[d.risk] && allowedAges.includes(d.age)
    );
  }, [cats, risks, horizon]);

  // KPI Calculations
  const stats = useMemo(() => {
    return {
      total: INITIAL_DETECTIONS.length,
      critical: INITIAL_DETECTIONS.filter((d) => d.risk === "critical").length,
      industrial: INITIAL_DETECTIONS.filter((d) => d.cat === "industrial").length,
      routine: INITIAL_DETECTIONS.filter((d) => d.cat === "flare" || d.cat === "persistent").length,
      wildfire: INITIAL_DETECTIONS.filter((d) => d.cat === "wildfire").length,
      agri: INITIAL_DETECTIONS.filter((d) => d.cat === "agri").length,
      assets: INITIAL_FACILITIES.length,
    };
  }, []);

  // Search matches
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return INITIAL_FACILITIES.filter(
      (f) => f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [searchQuery]);

  // Handle Search Input & Fly To
  const flyToFacility = (fc: FacilityItem) => {
    if (mapRef.current) {
      mapRef.current.flyTo(fc.lat, fc.lng, 12);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.openFacilityPopup(fc.id);
      }, 1200);
    }
  };

  const handleSearchSelect = (fc: FacilityItem) => {
    setSearchQuery(fc.name);
    setShowSearchDrop(false);
    flyToFacility(fc);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const match = searchQuery.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      if (match && mapRef.current) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        mapRef.current.flyTo(lat, lng, 10);
        addToast(`Jumped to coordinate ${lat}, ${lng}`);
      } else if (searchMatches.length > 0) {
        handleSearchSelect(searchMatches[0]);
      }
      setShowSearchDrop(false);
    }
  };

  // Toggle Categories & Risks
  const toggleCat = (catKey: string) => {
    setCats((prev) => ({ ...prev, [catKey]: !prev[catKey] }));
  };

  const toggleRisk = (riskKey: string) => {
    setRisks((prev) => ({ ...prev, [riskKey]: !prev[riskKey] }));
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
    addToast(next ? "3D terrain tilt enabled (demo)" : "3D view disabled");
    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 650);
  };

  // Load Demo Scenarios
  const handleLoadDemo = () => {
    setHorizon("all");
    setCats({
      industrial: true,
      persistent: true,
      flare: true,
      wildfire: true,
      agri: true,
      unknown: true,
    });
    setRisks({
      critical: true,
      high: true,
      medium: true,
      low: true,
    });
    if (mapRef.current) {
      mapRef.current.flyTo(22.6, 79.5, 5);
    }
    addToast(`Demo scenarios loaded — ${INITIAL_DETECTIONS.length} detections / ${INITIAL_FACILITIES.length} assets.`, true);
  };

  // Run Pipeline Simulation
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

    setTimeout(() => {
      setIsRunningPipeline(false);
      addToast(`Pipeline complete — ${INITIAL_DETECTIONS.length} detections, 1 critical.`, true);
    }, 3300);
  };

  // Zoom to Threat
  const handleZoomThreat = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(22.329, 69.672, 12);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.openCriticalPopup();
      }, 1400);
    }
  };

  // Acknowledge Alert
  const handleAcknowledgeAlert = () => {
    setIsAlertAcked(true);
    addToast("Critical alert acknowledged & logged.", true);
  };

  // Navigation click
  const handleNavClick = (nav: "gis" | "alerts" | "assets") => {
    setActiveNav(nav);
    if (nav === "gis") {
      setIsAssetModalOpen(false);
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
    <div className="flex-1 flex flex-col h-screen overflow-hidden select-none">
      {/* ══════════ TOP BAR ══════════ */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">
            <svg
              width="20"
              height="20"
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
              THERMAL INTELLIGENCE <span className="badge-id">SIH26162 • NTRD</span>
            </h1>
            <p>NASA FIRMS VIIRS • Facility Baselines • AI Explainability</p>
          </div>
        </div>

        <nav className="mainnav">
          <button
            onClick={() => handleNavClick("gis")}
            className={activeNav === "gis" ? "active" : ""}
          >
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
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            GIS Command
          </button>
          <button
            onClick={() => handleNavClick("alerts")}
            className={activeNav === "alerts" ? "active" : ""}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            Threat Alerts
          </button>
          <button
            onClick={() => handleNavClick("assets")}
            className={activeNav === "assets" ? "active" : ""}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
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

      {/* ══════════ KPI STRIP ══════════ */}
      <section className="kpis">
        <div className="kpi">
          <span className="ic" style={{ background: "#fff7ed", color: "#ea580c" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
          </span>
          <span>
            <span className="lbl">Total Detections:</span>
            <br />
            <span className="val">{stats.total}</span>
          </span>
        </div>

        <div className="kpi crit">
          <span className="ic" style={{ background: "#fee2e2", color: "#dc2626" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <span>
            <span className="lbl">Critical Alerts:</span>
            <br />
            <span className="val">{stats.critical}</span>
          </span>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#fef2f2", color: "#e11d48" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M17 18h1" />
              <path d="M12 18h1" />
              <path d="M7 18h1" />
            </svg>
          </span>
          <span>
            <span className="lbl">Industrial Fires:</span>
            <br />
            <span className="val">{stats.industrial}</span>
          </span>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#f5f3ff", color: "#a855f7" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
          </span>
          <span>
            <span className="lbl">Routine Flares &amp; Sources:</span>
            <br />
            <span className="val">{stats.routine}</span>
          </span>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#fff7ed", color: "#f97316" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z" />
              <path d="M12 22v-3" />
            </svg>
          </span>
          <span>
            <span className="lbl">Wildfires:</span>
            <br />
            <span className="val">{stats.wildfire}</span>
          </span>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#fefce8", color: "#ca8a04" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </span>
          <span>
            <span className="lbl">Agri Burns:</span>
            <br />
            <span className="val">{stats.agri}</span>
          </span>
        </div>

        <div className="kpi">
          <span className="ic" style={{ background: "#ecfeff", color: "#0891b2" }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
              <path d="M10 6h4" />
              <path d="M10 10h4" />
              <path d="M10 14h4" />
            </svg>
          </span>
          <span>
            <span className="lbl">Assets Monitored:</span>
            <br />
            <span className="val">{stats.assets}</span>
          </span>
        </div>

        <div className="kpi-actions">
          <button className="btn ghost" onClick={handleLoadDemo}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
            Load Demo Scenarios
          </button>
          <button
            className={`btn solid ${isRunningPipeline ? "running" : ""}`}
            onClick={handleRunPipeline}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            {isRunningPipeline ? "Running…" : "Run Pipeline"}
          </button>
        </div>
      </section>

      {/* ══════════ CONSOLE GRID ══════════ */}
      <main className="console">
        {/* LEFT COLUMN: Filters & Intelligence */}
        <aside className="col">
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
            </div>
            <div className="card-b">
              {/* Searchbox */}
              <div className="searchbox">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
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
                          {fc.lat.toFixed(2)}, {fc.lng.toFixed(2)}
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
                    className={`chip ${!cats.industrial ? "off" : ""}`}
                    onClick={() => toggleCat("industrial")}
                  >
                    <span className="dot" style={{ background: "#e11d48" }} />
                    Industrial Fire
                  </button>
                  <button
                    className={`chip ${!cats.persistent ? "off" : ""}`}
                    onClick={() => toggleCat("persistent")}
                  >
                    <span className="dot" style={{ background: "#0ea5e9" }} />
                    Persistent Source
                  </button>
                  <button
                    className={`chip ${!cats.flare ? "off" : ""}`}
                    onClick={() => toggleCat("flare")}
                  >
                    <span className="dot" style={{ background: "#a855f7" }} />
                    Gas Flare
                  </button>
                  <button
                    className={`chip ${!cats.wildfire ? "off" : ""}`}
                    onClick={() => toggleCat("wildfire")}
                  >
                    <span className="dot" style={{ background: "#f97316" }} />
                    Wildfire
                  </button>
                  <button
                    className={`chip ${!cats.agri ? "off" : ""}`}
                    onClick={() => toggleCat("agri")}
                  >
                    <span className="dot" style={{ background: "#eab308" }} />
                    Agri Burning
                  </button>
                  <button
                    className={`chip ${!cats.unknown ? "off" : ""}`}
                    onClick={() => toggleCat("unknown")}
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
                    className={`chip risk ${risks.critical ? "on" : ""}`}
                    data-risk="critical"
                    onClick={() => toggleRisk("critical")}
                  >
                    CRITICAL
                  </button>
                  <button
                    className={`chip risk ${risks.high ? "on" : ""}`}
                    data-risk="high"
                    onClick={() => toggleRisk("high")}
                  >
                    HIGH
                  </button>
                  <button
                    className={`chip risk ${risks.medium ? "on" : ""}`}
                    data-risk="medium"
                    onClick={() => toggleRisk("medium")}
                  >
                    MEDIUM
                  </button>
                  <button
                    className={`chip risk ${risks.low ? "on" : ""}`}
                    data-risk="low"
                    onClick={() => toggleRisk("low")}
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--teal)" }}
              >
                <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
                <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
              </svg>
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
        <section className="card map-card">
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
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 10a7.31 7.31 0 0 0 10 10Z" />
                    <path d="m9 15 3-3" />
                    <path d="M17 13a6 6 0 0 0-6-6" />
                    <path d="M21 13A10 10 0 0 0 11 3" />
                  </svg>
                  Satellite Optical
                </button>
                <button
                  className={basemapStyle === "relief" ? "on" : ""}
                  onClick={() => handleSelectBasemap("relief")}
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
                    <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                  </svg>
                  Hills &amp; Relief
                </button>
                <button
                  className={basemapStyle === "dark" ? "on" : ""}
                  onClick={() => handleSelectBasemap("dark")}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                  Tactical Dark
                </button>
              </div>

              <button
                className={`btn3d ${is3D ? "on" : ""}`}
                onClick={handleToggle3D}
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
            facilities={INITIAL_FACILITIES}
            detections={filteredDetections}
            basemapStyle={basemapStyle}
            is3D={is3D}
          />
        </section>

        {/* RIGHT COLUMN: Tactical Alert Queue */}
        <aside className="col">
          <section
            ref={queueCardRef}
            className={`card queue-card ${isAlertAcked ? "ackd" : ""} ${
              isAlertFlashing ? "flash" : ""
            }`}
          >
            <div className="card-h">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--red)" }}
              >
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <span className="t">Tactical Alert Queue</span>
              <span className="spacer" />
              {!isAlertAcked && <span className="queue-badge">1</span>}
            </div>

            <div id="alertWrap">
              <div className="alert-item">
                <div className="alert-head">
                  <span className="tag-crit">
                    <span className="d" />
                    CRITICAL
                  </span>
                  <span className="alert-time">04:29 PM</span>
                </div>
                <div className="alert-body">
                  <h3>
                    CRITICAL: Uncontained Thermal Anomaly at Nayara Energy Vadinar Refinery
                  </h3>
                  <p>
                    Severe thermal signature (36.4 MW) detected 164m from Nayara Energy Vadinar Refinery. FRP is 3.6x higher than…
                  </p>
                </div>
                <div className="response-box">
                  <b>Response Action:</b> Dispatch onsite emergency industrial fire response team, initiate flare header inspection, and notify district disaster management authority.
                </div>
                <div className="alert-foot">
                  <button className="abtn zoom" onClick={handleZoomThreat}>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="2" x2="5" y1="12" y2="12" />
                      <line x1="19" x2="22" y1="12" y2="12" />
                      <line x1="12" x2="12" y1="2" y2="5" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                      <circle cx="12" cy="12" r="7" />
                    </svg>
                    Zoom to Threat
                  </button>
                  <button className="abtn ack" onClick={handleAcknowledgeAlert}>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Acknowledge
                  </button>
                </div>
              </div>
            </div>

            <div className="queue-empty">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <b>Queue clear</b>
              <span>All threats acknowledged. Monitoring continues.</span>
            </div>
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--teal)" }}
            >
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M10 6h4" />
              <path d="M10 10h4" />
              <path d="M10 14h4" />
            </svg>
            <span className="t">
              Monitored Assets — {INITIAL_FACILITIES.length} facilities
            </span>
            <div className="ml-4 flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Filter assets..."
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            {INITIAL_FACILITIES.filter(
              (f) =>
                f.name.toLowerCase().includes(assetFilter.toLowerCase()) ||
                f.type.toLowerCase().includes(assetFilter.toLowerCase())
            ).map((fc) => (
              <div
                key={fc.id}
                className="asset-row cursor-pointer hover:bg-teal-50/50 transition-colors"
                onClick={() => {
                  setIsAssetModalOpen(false);
                  setActiveNav("gis");
                  flyToFacility(fc);
                }}
              >
                <span className="nm">{fc.name}</span>
                <span className="tp">{fc.type.toUpperCase()}</span>
                <span className="cd">
                  {fc.lat.toFixed(2)}, {fc.lng.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ TOAST NOTIFICATIONS ══════════ */}
      <div id="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.ok ? "ok" : ""}`}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {t.ok ? (
                <path d="M20 6 9 17l-5-5" />
              ) : (
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              )}
            </svg>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
