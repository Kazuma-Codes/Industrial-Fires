"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type { Map as LeafletMapType, LayerGroup, Marker, CircleMarker, TileLayer } from "leaflet";
import {
  GeoJSONFeatureCollection,
  FacilityFeatureCollection,
  EventProperties,
  FacilityProperties,
} from "../lib/types";

export interface LeafletMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  openEventPopup: (eventId: number) => void;
  openFacilityPopup: (facilityId: number) => void;
  invalidateSize: () => void;
}

interface LeafletMapProps {
  events: GeoJSONFeatureCollection;
  facilities: FacilityFeatureCollection;
  selectedEvent: EventProperties | null;
  onSelectEvent: (event: EventProperties | null) => void;
  onSelectFacility?: (facility: FacilityProperties | null) => void;
  basemapStyle: "optical" | "relief" | "dark";
  is3D: boolean;
}

const CLASSIFICATION_COLORS: Record<string, { label: string; color: string }> = {
  industrial_fire: { label: "Industrial Fire / Hazard", color: "#e11d48" },
  gas_flare: { label: "Routine Gas Flare", color: "#a855f7" },
  persistent_industrial_source: { label: "Persistent Industrial Source", color: "#0ea5e9" },
  wildfire: { label: "Wildfire Cluster", color: "#f97316" },
  agricultural_burning: { label: "Agricultural Burning", color: "#eab308" },
  unknown: { label: "Unknown", color: "#94a3b8" },
};

const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  {
    events,
    facilities,
    selectedEvent,
    onSelectEvent,
    onSelectFacility,
    basemapStyle,
    is3D,
  },
  ref
) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMapType | null>(null);
  const tileLayersRef = useRef<Record<string, TileLayer>>({});
  const activeStyleRef = useRef<"optical" | "relief" | "dark">(basemapStyle);
  const facilityLayerRef = useRef<LayerGroup | null>(null);
  const detectionLayerRef = useRef<LayerGroup | null>(null);
  const facMarkersRef = useRef<Record<number, Marker>>({});
  const eventMarkersRef = useRef<Record<number, Marker | CircleMarker>>({});
  const LRef = useRef<typeof import("leaflet") | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom: number = 12) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
      }
    },
    openEventPopup: (eventId: number) => {
      const mk = eventMarkersRef.current[eventId];
      if (mk && mapInstanceRef.current) {
        mk.openPopup();
      }
    },
    openFacilityPopup: (facilityId: number) => {
      const mk = facMarkersRef.current[facilityId];
      if (mk && mapInstanceRef.current) {
        mk.openPopup();
      }
    },
    invalidateSize: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    },
  }));

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = await import("leaflet");
      if (!isMounted || !mapContainerRef.current) return;
      LRef.current = L;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([22.6, 79.5], 5);

      mapInstanceRef.current = map;

      // Define Basemap Tile Layers
      const tiles: Record<string, TileLayer> = {
        optical: L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18 }
        ),
        relief: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
          maxZoom: 16,
        }),
        dark: L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          { maxZoom: 19 }
        ),
      };
      tileLayersRef.current = tiles;

      tiles[basemapStyle].addTo(map);
      activeStyleRef.current = basemapStyle;

      // Handle label visibility based on zoom
      const handleZoom = () => {
        if (!mapContainerRef.current) return;
        if (map.getZoom() < 7) {
          mapContainerRef.current.classList.add("hide-labels");
        } else {
          mapContainerRef.current.classList.remove("hide-labels");
        }
      };

      map.on("zoomend", handleZoom);
      handleZoom();

      // Create Layer Groups
      const facLayer = L.layerGroup().addTo(map);
      facilityLayerRef.current = facLayer;

      const detLayer = L.layerGroup().addTo(map);
      detectionLayerRef.current = detLayer;

      renderFacilities(L, facLayer);
      renderEvents(L, detLayer);

      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Basemap Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayersRef.current[basemapStyle]) return;
    const map = mapInstanceRef.current;
    if (activeStyleRef.current !== basemapStyle) {
      const prev = tileLayersRef.current[activeStyleRef.current];
      if (prev && map.hasLayer(prev)) {
        map.removeLayer(prev);
      }
      tileLayersRef.current[basemapStyle].addTo(map);
      activeStyleRef.current = basemapStyle;
    }
  }, [basemapStyle]);

  // Handle 3D Tilt resize
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [is3D]);

  // Helper: Render Facilities
  const renderFacilities = (L: typeof import("leaflet"), facLayer: LayerGroup) => {
    facLayer.clearLayers();
    facMarkersRef.current = {};

    if (!facilities || !facilities.features) return;

    facilities.features.forEach((feature) => {
      const p = feature.properties;
      const coords = feature.geometry.coordinates; // [lng, lat]
      const lat = coords[1];
      const lng = coords[0];

      const icon = L.divIcon({
        className: "fac-sq",
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const mk = L.marker([lat, lng], { icon });
      const popupHtml = `
        <div class="pop-t">${p.name}</div>
        <span class="pop-tag" style="background:#0891b2">${(p.facility_type || "PLANT").toUpperCase()}</span>
        <div class="pop-m">Asset #${p.id} • Criticality: ${p.criticality || 1}<br/>${lat.toFixed(3)}, ${lng.toFixed(3)}</div>
      `;
      mk.bindPopup(popupHtml);

      mk.bindTooltip(p.name, {
        permanent: true,
        direction: "right",
        className: "flabel",
        offset: [7, 0],
      });

      mk.on("click", () => {
        if (onSelectFacility) {
          onSelectFacility(p);
        }
      });

      facMarkersRef.current[p.id] = mk;
      facLayer.addLayer(mk);
    });
  };

  // Helper: Render Events
  const renderEvents = (L: typeof import("leaflet"), detLayer: LayerGroup) => {
    detLayer.clearLayers();
    eventMarkersRef.current = {};

    if (!events || !events.features) return;

    events.features.forEach((feature) => {
      const p = feature.properties;
      const coords = feature.geometry.coordinates; // [lng, lat]
      const lat = coords[1];
      const lng = coords[0];

      const meta = CLASSIFICATION_COLORS[p.classification] || {
        label: (p.classification || "Unknown").replace(/_/g, " "),
        color: "#94a3b8",
      };

      const popHtml = `
        <div class="pop-t">${meta.label}</div>
        <span class="pop-tag" style="background:${meta.color}">${(p.risk_level || "LOW").toUpperCase()}</span>
        <div class="pop-m">FRP: ${Number(p.frp).toFixed(1)} MW • Conf: ${p.confidence || "nominal"}<br/>
        ${p.nearest_facility_name ? `Near: ${p.nearest_facility_name}<br/>` : ""}
        ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
      `;

      if (p.risk_level === "CRITICAL") {
        const icon = L.divIcon({
          className: "",
          html: '<div class="pulse-wrap"><span class="pulse-ring"></span><span class="pulse-core"></span></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const cm = L.marker([lat, lng], { icon });
        cm.bindPopup(popHtml);
        cm.on("click", () => {
          onSelectEvent(p);
        });
        detLayer.addLayer(cm);
        eventMarkersRef.current[p.id] = cm;
      } else {
        const rad = Math.min(16, 4 + Math.sqrt(p.frp || 2) * 1.9);
        const cmm = L.circleMarker([lat, lng], {
          radius: rad,
          color: "#ffffff",
          weight: 2,
          fillColor: meta.color,
          fillOpacity: 0.92,
        });
        cmm.bindPopup(popHtml);
        cmm.bindTooltip(`${meta.label} — ${Number(p.frp).toFixed(1)} MW`, {
          direction: "top",
          offset: [0, -4],
        });
        cmm.on("click", () => {
          onSelectEvent(p);
        });
        detLayer.addLayer(cmm);
        eventMarkersRef.current[p.id] = cmm;
      }
    });
  };

  // Re-render facilities on facility change
  useEffect(() => {
    if (LRef.current && facilityLayerRef.current) {
      renderFacilities(LRef.current, facilityLayerRef.current);
    }
  }, [facilities]);

  // Re-render events on events change
  useEffect(() => {
    if (LRef.current && detectionLayerRef.current) {
      renderEvents(LRef.current, detectionLayerRef.current);
    }
  }, [events]);

  return (
    <div
      id="mapShell"
      className={is3D ? "tilt" : ""}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <div id="map" ref={mapContainerRef} />
    </div>
  );
});

export default LeafletMap;
