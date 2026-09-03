"use client";

import React, { useEffect, useState } from "react";
import { EventProperties, EventDetail } from "../lib/types";
import { api } from "../lib/api";
import RiskBadge from "./RiskBadge";
import EvidencePanel from "./EvidencePanel";
import {
  X,
  Radio,
  Clock,
  MapPin,
  Flame,
  Factory,
  Layers,
  Activity,
  Calendar,
} from "lucide-react";

interface Props {
  event: EventProperties | null;
  onClose: () => void;
}

export default function EventDetailPanel({ event, onClose }: Props) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!event) {
      setDetail(null);
      return;
    }

    let active = true;
    setLoading(true);
    api.getEventDetail(event.id).then((data) => {
      if (active) {
        setDetail(data);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [event]);

  if (!event) return null;

  // Resilient resolution of properties from either detail (API) or event (GeoJSON)
  const classification =
    (detail as any)?.classification ||
    detail?.intel?.classification ||
    event.classification ||
    "unknown";

  const riskLevel =
    (detail as any)?.risk_level ||
    detail?.intel?.risk_level ||
    event.risk_level ||
    "LOW";

  const riskScore =
    (detail as any)?.risk_score ??
    detail?.intel?.risk_score ??
    event.risk_score ??
    0;

  const facilityName =
    (detail as any)?.nearest_facility_name ||
    detail?.intel?.nearest_facility_name ||
    event.nearest_facility_name;

  const facilityDistance =
    (detail as any)?.distance_to_facility_m ??
    detail?.intel?.distance_to_facility_m ??
    event.distance_to_facility_m;

  const insideFacility =
    (detail as any)?.inside_facility ??
    detail?.intel?.inside_facility ??
    event.inside_facility ??
    false;

  const classificationFormatted = (classification || "unknown")
    .replace(/_/g, " ")
    .toUpperCase();

  const evidenceData = detail?.intel?.evidence || (event as any)?.intel?.evidence;

  return (
    <div className="absolute right-4 top-20 bottom-6 w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl flex flex-col z-20 overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RiskBadge level={riskLevel} score={riskScore} />
            <span className="text-[10px] text-slate-400 font-mono">ID: #{event.id}</span>
          </div>
          <h2 className="text-sm font-bold text-slate-100 tracking-wide">
            {classificationFormatted}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* Key Telemetry Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>Coordinates</span>
            </div>
            <div className="font-mono font-bold text-slate-200 text-xs">
              {Number(event.latitude).toFixed(4)}°N, {Number(event.longitude).toFixed(4)}°E
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Radio className="w-3 h-3 text-amber-400" />
              <span>Satellite Sensor</span>
            </div>
            <div className="font-mono font-bold text-slate-200 text-xs">
              {event.satellite} ({event.daynight === "N" ? "Night" : "Day"})
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Clock className="w-3 h-3 text-purple-400" />
              <span>Acquired Time</span>
            </div>
            <div className="font-mono font-bold text-slate-200 text-xs">
              {event.acq_date} {event.acq_time} UTC
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Flame className="w-3 h-3 text-red-400" />
              <span>Thermal Output</span>
            </div>
            <div className="font-mono font-bold text-slate-200 text-xs">
              {Number(event.frp).toFixed(1)} MW
            </div>
          </div>
        </div>

        {/* Nearest Industrial Asset */}
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300 text-xs mb-1.5">
            <Factory className="w-3.5 h-3.5 text-cyan-400" />
            <span>Industrial Infrastructure Context:</span>
          </div>
          {facilityName ? (
            <div className="space-y-1">
              <div className="text-slate-200 font-medium">
                {facilityName}
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Distance from perimeter:</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {facilityDistance !== undefined && facilityDistance !== null
                    ? `${facilityDistance} m`
                    : "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Perimeter Status:</span>
                <span className={insideFacility ? "text-red-400 font-bold" : "text-emerald-400"}>
                  {insideFacility ? "INSIDE BOUNDARY" : "EXTERNAL BUFFER"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-[11px]">
              No high-criticality industrial facility located within 2.0 km radius.
            </div>
          )}
        </div>

        {/* Explainability Engine */}
        <div>
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Explainability Diagnostics</span>
          </div>
          <EvidencePanel
            evidence={evidenceData}
            classification={classification}
          />
        </div>
      </div>
    </div>
  );
}
