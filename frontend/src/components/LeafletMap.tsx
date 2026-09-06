"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type { Map as LeafletMapType, LayerGroup, Marker, CircleMarker, TileLayer } from "leaflet";

export interface FacilityItem {
  name: string;
  lat: number;
  lng: number;
  type: string;
  named: boolean;
  id: number;
}

export interface DetectionItem {
  cat: "industrial" | "persistent" | "flare" | "wildfire" | "agri" | "unknown";
  risk: "critical" | "high" | "medium" | "low";
  frp: number;
  age: "today" | "3d" | "7d" | "30d";
  lat: number;
  lng: number;
  note: string;
}

export interface LeafletMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  openCriticalPopup: () => void;
  openFacilityPopup: (id: number) => void;
  invalidateSize: () => void;
}

interface LeafletMapProps {
  facilities: FacilityItem[];
  detections: DetectionItem[];
  basemapStyle: "optical" | "relief" | "dark";
  is3D: boolean;
  onFacilityClick?: (facility: FacilityItem) => void;
}

const CAT_META: Record<DetectionItem["cat"], { label: string; color: string }> = {
  industrial: { label: "Industrial Fire / Hazard", color: "#e11d48" },
  flare: { label: "Routine Gas Flare", color: "#a855f7" },
  persistent: { label: "Persistent Industrial Source", color: "#0ea5e9" },
  wildfire: { label: "Wildfire Cluster", color: "#f97316" },
  agri: { label: "Agricultural Burning", color: "#eab308" },
  unknown: { label: "Unknown", color: "#94a3b8" },
};

const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  { facilities, detections, basemapStyle, is3D, onFacilityClick },
  ref
) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMapType | null>(null);
  const tileLayersRef = useRef<Record<string, TileLayer>>({});
  const activeStyleRef = useRef<"optical" | "relief" | "dark">(basemapStyle);
  const facilityLayerRef = useRef<LayerGroup | null>(null);
  const detectionLayerRef = useRef<LayerGroup | null>(null);
  const facMarkersRef = useRef<Record<number, Marker>>({});
  const critMarkerRef = useRef<Marker | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom: number = 12) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
      }
    },
    openCriticalPopup: () => {
      if (critMarkerRef.current && mapInstanceRef.current) {
        critMarkerRef.current.openPopup();
      }
    },
    openFacilityPopup: (id: number) => {
      if (facMarkersRef.current[id] && mapInstanceRef.current) {
        facMarkersRef.current[id].openPopup();
      }
    },
    invalidateSize: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    },
  }));

  // Initialize Map
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

      // Zoom listener for hiding/showing labels
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
      renderDetections(L, detLayer);

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

    facilities.forEach((fc) => {
      const icon = L.divIcon({
        className: "fac-sq",
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const mk = L.marker([fc.lat, fc.lng], { icon });
      const popupHtml = `
        <div class="pop-t">${fc.name}</div>
        <span class="pop-tag" style="background:#0891b2">${fc.type.toUpperCase()}</span>
        <div class="pop-m">OSM Refinery / Plant • Asset #${fc.id}<br/>${fc.lat.toFixed(3)}, ${fc.lng.toFixed(3)}</div>
      `;
      mk.bindPopup(popupHtml);

      if (fc.named) {
        mk.bindTooltip(fc.name, {
          permanent: true,
          direction: "right",
          className: "flabel",
          offset: [7, 0],
        });
      }

      mk.on("click", () => {
        if (onFacilityClick) {
          onFacilityClick(fc);
        }
      });

      facMarkersRef.current[fc.id] = mk;
      facLayer.addLayer(mk);
    });
  };

  // Helper: Render Detections
  const renderDetections = (L: typeof import("leaflet"), detLayer: LayerGroup) => {
    detLayer.clearLayers();
    critMarkerRef.current = null;

    detections.forEach((dt) => {
      const meta = CAT_META[dt.cat];
      const popHtml = `
        <div class="pop-t">${meta.label}</div>
        <span class="pop-tag" style="background:${meta.color}">${dt.risk.toUpperCase()}</span>
        <div class="pop-m">FRP: ${dt.frp.toFixed(1)} MW • Age: ${dt.age}<br/>${dt.note}<br/>${dt.lat.toFixed(4)}, ${dt.lng.toFixed(4)}</div>
      `;

      if (dt.risk === "critical") {
        const icon = L.divIcon({
          className: "",
          html: '<div class="pulse-wrap"><span class="pulse-ring"></span><span class="pulse-core"></span></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const cm = L.marker([dt.lat, dt.lng], { icon });
        cm.bindPopup(popHtml);
        detLayer.addLayer(cm);
        critMarkerRef.current = cm;
      } else {
        const rad = Math.min(16, 4 + Math.sqrt(dt.frp) * 1.9);
        const cmm = L.circleMarker([dt.lat, dt.lng], {
          radius: rad,
          color: "#ffffff",
          weight: 2,
          fillColor: meta.color,
          fillOpacity: 0.92,
        });
        cmm.bindPopup(popHtml);
        cmm.bindTooltip(`${meta.label} — ${dt.frp.toFixed(1)} MW`, {
          direction: "top",
          offset: [0, -4],
        });
        detLayer.addLayer(cmm);
      }
    });
  };

  // Re-render facilities on facility change
  useEffect(() => {
    if (LRef.current && facilityLayerRef.current) {
      renderFacilities(LRef.current, facilityLayerRef.current);
    }
  }, [facilities]);

  // Re-render detections on detection change
  useEffect(() => {
    if (LRef.current && detectionLayerRef.current) {
      renderDetections(LRef.current, detectionLayerRef.current);
    }
  }, [detections]);

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
