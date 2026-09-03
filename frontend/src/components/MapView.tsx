"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  GeoJSONFeatureCollection,
  FacilityFeatureCollection,
  EventProperties,
  FacilityProperties,
} from "../lib/types";
import {
  Satellite,
  Moon,
  Mountain,
  Box,
} from "lucide-react";

interface Props {
  events: GeoJSONFeatureCollection;
  facilities: FacilityFeatureCollection;
  selectedEvent: EventProperties | null;
  onSelectEvent: (event: EventProperties | null) => void;
  onSelectFacility?: (fac: FacilityProperties | null) => void;
  flyToCoords?: { lat: number; lon: number; zoom?: number } | null;
}

type BaseLayerType = "satellite" | "dark" | "topo";

// Multi-Source Map Style supporting High-Res Satellite Optical, Mountain Terrain, and Tactical Dark
const MULTI_BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    // 1. High-Resolution Optical Satellite with Houses, Refineries, Roads & Places (Zero watermark)
    "google-satellite": {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      ],
      tileSize: 256,
      attribution: "© Google Maps Satellite",
      maxzoom: 20,
    },
    // 2. Topographic Relief with Mountain Ranges, Hills, and Elevation Contours
    "google-terrain": {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
      ],
      tileSize: 256,
      attribution: "© Google Terrain",
      maxzoom: 20,
    },
    // 3. Tactical Dark Matter (Night Command Theme)
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "base-satellite",
      type: "raster",
      source: "google-satellite",
      minzoom: 0,
      maxzoom: 22,
      layout: { visibility: "visible" },
    },
    {
      id: "base-topo",
      type: "raster",
      source: "google-terrain",
      minzoom: 0,
      maxzoom: 22,
      layout: { visibility: "none" },
    },
    {
      id: "base-dark",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 22,
      layout: { visibility: "none" },
    },
  ],
};

export default function MapView({
  events,
  facilities,
  selectedEvent,
  onSelectEvent,
  onSelectFacility,
  flyToCoords,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isLoadedRef = useRef(false);

  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>("satellite");
  const [is3DMode, setIs3DMode] = useState(false);

  // Keep latest data refs so map.on("load") always has current data
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const facilitiesRef = useRef(facilities);
  facilitiesRef.current = facilities;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MULTI_BASE_STYLE,
      center: [78.9629, 22.5937], // Centered on India
      zoom: 4.6, // National overview
      pitch: 0, // Flat national tactical view
      bearing: 0,
      maxPitch: 85,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-left");

    map.on("load", () => {
      isLoadedRef.current = true;

      // 1. Add Facilities Source & Layer
      map.addSource("facilities-source", {
        type: "geojson",
        data: facilitiesRef.current as any,
      });

      // Facility marker circle
      map.addLayer({
        id: "facilities-circle",
        type: "circle",
        source: "facilities-source",
        paint: {
          "circle-radius": 11,
          "circle-color": "#06b6d4",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      });

      // Facility labels with dark background halo
      map.addLayer({
        id: "facilities-labels",
        type: "symbol",
        source: "facilities-source",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 11,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#090d16",
          "text-halo-width": 3,
        },
      });

      // 2. Add Thermal Events Source & Layers
      map.addSource("events-source", {
        type: "geojson",
        data: eventsRef.current as any,
      });

      // Pulsing halo for critical anomalies & industrial fires
      map.addLayer({
        id: "events-critical-halo",
        type: "circle",
        source: "events-source",
        filter: ["==", ["get", "risk_level"], "CRITICAL"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "frp"],
            5, 16,
            35, 32,
          ],
          "circle-color": "#ef4444",
          "circle-opacity": 0.45,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ef4444",
        },
      });

      // Main thermal anomaly markers
      map.addLayer({
        id: "events-circle",
        type: "circle",
        source: "events-source",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "frp"],
            2, 5.5,
            10, 9.5,
            35, 18,
          ],
          "circle-color": [
            "match",
            ["get", "classification"],
            "industrial_fire", "#ef4444",
            "persistent_industrial_source", "#38bdf8",
            "gas_flare", "#c084fc",
            "wildfire", "#f97316",
            "agricultural_burning", "#facc15",
            "#9ca3af" // default unknown
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      });

      // Selected event indicator ring
      map.addLayer({
        id: "events-selected-ring",
        type: "circle",
        source: "events-source",
        filter: ["==", ["get", "id"], selectedEvent ? selectedEvent.id : -1],
        paint: {
          "circle-radius": 24,
          "circle-color": "transparent",
          "circle-stroke-width": 3.5,
          "circle-stroke-color": "#38bdf8",
        },
      });

      // Hover popups
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      map.on("mouseenter", "events-circle", (e) => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features && e.features[0]) {
          const f = e.features[0];
          const props = f.properties;
          const coords = (f.geometry as any).coordinates.slice();

          popup
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family: sans-serif; font-size: 11px; padding: 3px; color: #f8fafc;">
                <div style="font-weight: bold; color: #38bdf8; text-transform: uppercase; font-size: 11px;">
                  ${props.classification?.replace(/_/g, " ")}
                </div>
                <div style="margin-top: 2px;">FRP: <strong>${Number(props.frp).toFixed(1)} MW</strong></div>
                <div>Risk: <strong style="color: ${props.risk_level === "CRITICAL" ? "#ef4444" : "#f59e0b"}">${props.risk_level} (${props.risk_score})</strong></div>
                ${props.nearest_facility_name ? `<div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Near: ${props.nearest_facility_name}</div>` : ""}
              </div>
            `)
            .addTo(map);
        }
      });

      map.on("mouseleave", "events-circle", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      // Click on anomaly marker
      map.on("click", "events-circle", (e) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties as any;
          if (typeof props.inside_facility === "string") {
            props.inside_facility = props.inside_facility === "true";
          }
          onSelectEvent(props as EventProperties);
        }
      });

      // Click on facility marker
      map.on("click", "facilities-circle", (e) => {
        if (e.features && e.features[0] && onSelectFacility) {
          onSelectFacility(e.features[0].properties as FacilityProperties);
        }
      });

      // Auto-resize
      setTimeout(() => map.resize(), 150);
      setTimeout(() => map.resize(), 600);
    });

    mapRef.current = map;

    // ResizeObserver to prevent layout collapse
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    };
  }, []);

  // Update Events data dynamically
  useEffect(() => {
    if (!mapRef.current || !isLoadedRef.current) return;
    const source = mapRef.current.getSource("events-source") as GeoJSONSource;
    if (source) {
      source.setData(events as any);
    }
  }, [events]);

  // Update Facilities data dynamically
  useEffect(() => {
    if (!mapRef.current || !isLoadedRef.current) return;
    const source = mapRef.current.getSource("facilities-source") as GeoJSONSource;
    if (source) {
      source.setData(facilities as any);
    }
  }, [facilities]);

  // Update selected highlight ring
  useEffect(() => {
    if (!mapRef.current || !isLoadedRef.current) return;
    if (mapRef.current.getLayer("events-selected-ring")) {
      mapRef.current.setFilter("events-selected-ring", [
        "==",
        ["get", "id"],
        selectedEvent ? selectedEvent.id : -1,
      ]);
    }
  }, [selectedEvent]);

  // Handle camera fly-to
  useEffect(() => {
    if (!mapRef.current || !flyToCoords) return;
    mapRef.current.flyTo({
      center: [flyToCoords.lon, flyToCoords.lat],
      zoom: flyToCoords.zoom || 15,
      pitch: is3DMode ? 65 : 45,
      essential: true,
      duration: 1500,
    });
  }, [flyToCoords, is3DMode]);

  // Switch Base Map Layer (Satellite, Topo, Dark)
  const switchBaseLayer = (layer: BaseLayerType) => {
    setActiveBaseLayer(layer);
    if (!mapRef.current || !isLoadedRef.current) return;
    const map = mapRef.current;

    map.setLayoutProperty("base-satellite", "visibility", layer === "satellite" ? "visible" : "none");
    map.setLayoutProperty("base-topo", "visibility", layer === "topo" ? "visible" : "none");
    map.setLayoutProperty("base-dark", "visibility", layer === "dark" ? "visible" : "none");
  };

  // Toggle 3D Perspective Tilt View
  const toggle3D = () => {
    if (!mapRef.current) return;
    const new3D = !is3DMode;
    setIs3DMode(new3D);

    mapRef.current.easeTo({
      pitch: new3D ? 65 : 0,
      bearing: new3D ? -25 : 0,
      duration: 1200,
    });
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: "100%" }} />

      {/* Floating Tactical Layer Switcher & 3D Tilt Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Base Map Switcher Pill */}
        <div className="bg-slate-950/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-2xl flex items-center gap-1 text-xs">
          <button
            onClick={() => switchBaseLayer("satellite")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              activeBaseLayer === "satellite"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
            title="Real Optical Satellite Imagery with individual houses, refineries, trees, and roads"
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Satellite Optical</span>
          </button>

          <button
            onClick={() => switchBaseLayer("topo")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              activeBaseLayer === "topo"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
            title="Topographic Relief with mountain ranges, hills, and elevation contours"
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Hills & Relief</span>
          </button>

          <button
            onClick={() => switchBaseLayer("dark")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              activeBaseLayer === "dark"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
            title="Tactical Dark Matter Theme (Night Command Mode)"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Tactical Dark</span>
          </button>
        </div>

        {/* 3D Perspective Tilt Button */}
        <button
          onClick={toggle3D}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-2xl ${
            is3DMode
              ? "bg-emerald-500 text-slate-950 border-emerald-400 ring-2 ring-emerald-400/40 shadow-emerald-500/30"
              : "bg-slate-950/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
          }`}
          title="Tilt camera into 3D horizon perspective to view mountains and refinery structures"
        >
          <Box className={`w-3.5 h-3.5 ${is3DMode ? "animate-pulse" : ""}`} />
          <span>{is3DMode ? "3D Horizon: ON" : "3D View"}</span>
        </button>
      </div>
    </div>
  );
}
