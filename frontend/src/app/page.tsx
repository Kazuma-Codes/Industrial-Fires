"use client";

import React, { useEffect, useState, useMemo } from "react";
import MapView from "../components/MapView";
import StatsBar from "../components/StatsBar";
import FilterBar from "../components/FilterBar";
import EventDetailPanel from "../components/EventDetailPanel";
import AlertPanel from "../components/AlertPanel";
import Legend from "../components/Legend";
import TimeSlider from "../components/TimeSlider";
import { api } from "../lib/api";
import {
  DashboardStats,
  EventProperties,
  FacilityProperties,
  FilterState,
  GeoJSONFeatureCollection,
  FacilityFeatureCollection,
  AlertItem,
} from "../lib/types";

export default function DashboardPage() {
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
  const [flyToCoords, setFlyToCoords] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    classifications: [],
    riskLevels: [],
    minConfidence: 0,
    dateRange: "all",
    searchQuery: "",
  });

  const loadData = async () => {
    try {
      const [statsData, eventsData, facilitiesData, alertsData] = await Promise.all([
        api.getStats(),
        api.getEvents({ limit: 3000 }),
        api.getFacilities(),
        api.getAlerts({ limit: 30 }),
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
    // Poll every 45 seconds for continuous live feel
    const interval = setInterval(loadData, 45000);
    return () => clearInterval(interval);
  }, []);

  // Client-side filtering for fast interactive response
  const filteredEvents = useMemo(() => {
    if (!rawEvents || !rawEvents.features) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const filtered = rawEvents.features.filter((f) => {
      const p = f.properties;

      // Classification Filter
      if (
        filters.classifications.length > 0 &&
        !filters.classifications.includes(p.classification)
      ) {
        return false;
      }

      // Risk Level Filter
      if (
        filters.riskLevels.length > 0 &&
        !filters.riskLevels.includes(p.risk_level)
      ) {
        return false;
      }

      // Search Query Filter
      if (filters.searchQuery.trim() !== "") {
        const q = filters.searchQuery.toLowerCase();
        const matchesName = p.nearest_facility_name?.toLowerCase().includes(q);
        const matchesClass = p.classification.toLowerCase().includes(q);
        const matchesCoords = `${p.latitude},${p.longitude}`.includes(q);
        if (!matchesName && !matchesClass && !matchesCoords) return false;
      }

      return true;
    });

    return {
      type: "FeatureCollection" as const,
      features: filtered,
    };
  }, [rawEvents, filters]);

  const handleSelectAlertEvent = (lat: number, lon: number, eventId: number) => {
    setFlyToCoords({ lat, lon, zoom: 15 });
    // Find matching event
    const found = rawEvents.features.find((f) => f.properties.id === eventId);
    if (found) {
      setSelectedEvent(found.properties);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-53px)] overflow-hidden relative">
      {/* Top Telemetry Stats HUD */}
      <StatsBar stats={stats} onRefresh={loadData} />

      {/* Interactive Tactical Filter Bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Main Map Viewport */}
      <div className="flex-1 relative w-full min-h-0 overflow-hidden">
        <MapView
          events={filteredEvents}
          facilities={facilities}
          selectedEvent={selectedEvent}
          onSelectEvent={setSelectedEvent}
          flyToCoords={flyToCoords}
        />

        {/* Floating Bottom-Left Controls: Legend */}
        <div className="absolute left-4 bottom-6 z-10 flex flex-col gap-3">
          <Legend />
        </div>

        {/* Floating Bottom-Center Control: Time Horizon Slider */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 hidden md:block">
          <TimeSlider
            selectedRange={filters.dateRange}
            onRangeChange={(range) => setFilters({ ...filters, dateRange: range })}
          />
        </div>

        {/* Floating Bottom-Right Panel: Tactical Alert Queue (Collapsible or floating) */}
        {!selectedEvent && (
          <div className="absolute right-4 bottom-6 z-10 w-80 max-w-[calc(100vw-2rem)]">
            <AlertPanel
              alerts={alerts}
              onSelectEvent={handleSelectAlertEvent}
              onRefresh={loadData}
            />
          </div>
        )}

        {/* Right Drawer: Comprehensive Anomaly Inspection & Explainability */}
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>
    </div>
  );
}
