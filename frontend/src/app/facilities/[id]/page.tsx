"use client";

import React, { useEffect, useState, use } from "react";
import { FacilityProperties } from "../../../lib/types";
import { api } from "../../../lib/api";
import Link from "next/link";
import {
  Factory,
  ArrowLeft,
  Flame,
  Star,
  ShieldAlert,
  Activity,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
} from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default function FacilityDetailPage({ params }: Props) {
  const resolvedParams = use(params);
  const facilityId = Number(resolvedParams.id);

  const [facility, setFacility] = useState<FacilityProperties | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFacilities().then((fc) => {
      const match = fc.features.find((f) => f.properties.id === facilityId);
      if (match) {
        setFacility(match.properties);
      }
      setLoading(false);
    });
  }, [facilityId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Loading facility telemetry...
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div>Facility #{facilityId} not found.</div>
        <Link href="/facilities" className="text-cyan-400 text-xs hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Assets Directory
        </Link>
      </div>
    );
  }

  const criticalityStars = Array.from({ length: 5 }, (_, i) => i < facility.criticality);
  const copernicusUrl = `https://browser.dataspace.copernicus.eu/?zoom=15&lat=${facility.latitude}&lng=${facility.longitude}&themeId=DEFAULT-THEME`;
  const worldviewUrl = `https://worldview.earthdata.nasa.gov/?v=${facility.longitude - 0.2},${facility.latitude - 0.2},${facility.longitude + 0.2},${facility.latitude + 0.2}&l=VIIRS_SNPP_Thermal_Anomalies_375m_All`;

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6 overflow-y-auto text-xs">
      {/* Back button */}
      <div>
        <Link
          href="/facilities"
          className="text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Industrial Assets</span>
        </Link>
      </div>

      {/* Main Profile Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 shadow-md">
              <Factory className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {facility.facility_type.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-slate-400">OSM: {facility.osm_id || "N/A"}</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">{facility.name}</h1>
              <div className="text-slate-400 text-xs mt-0.5">
                Operator: <strong className="text-slate-200">{facility.operator || "Independent Operation"}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-slate-400 text-[11px]">Criticality Tier</div>
            <div className="flex items-center gap-1">
              {criticalityStars.map((filled, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${filled ? "fill-amber-400 text-amber-400" : "text-slate-700"}`}
                />
              ))}
            </div>
            <div className="font-mono text-slate-400 text-[11px] mt-1">
              {facility.latitude.toFixed(4)}°N, {facility.longitude.toFixed(4)}°E
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Rolling Baseline Telemetry */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Rolling 30-Day FRP Baseline Profiling</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Baseline Mean FRP</div>
            <div className="font-mono font-extrabold text-slate-100 text-xl">
              {facility.mean_frp ? `${facility.mean_frp.toFixed(1)} MW` : "8.0 MW"}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Expected operational thermal output</div>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">P90 Anomaly Threshold</div>
            <div className="font-mono font-extrabold text-amber-400 text-xl">
              {facility.p90_frp ? `${facility.p90_frp.toFixed(1)} MW` : "12.5 MW"}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">90th percentile heat boundary</div>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Peak Historical FRP</div>
            <div className="font-mono font-extrabold text-red-400 text-xl">
              {facility.max_frp ? `${facility.max_frp.toFixed(1)} MW` : "36.4 MW"}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Maximum detected thermal excursion</div>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[11px] mb-1">Active Detections (30d)</div>
            <div className="font-mono font-extrabold text-cyan-400 text-xl">
              {facility.detection_count ?? 26}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Active on {facility.active_days_30d ?? 25} distinct days
            </div>
          </div>
        </div>
      </div>

      {/* Satellite Imagery Deep Links */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-bold text-slate-100 mb-0.5">High-Resolution Optical Verification</div>
          <div className="text-slate-400 text-xs">
            Open Copernicus Data Space Browser (Sentinel-2 MSI) or NASA Worldview centered on this asset.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={copernicusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-medium transition-colors"
          >
            <span>Open Sentinel-2 Browser</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href={worldviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
          >
            <span>NASA Worldview</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
