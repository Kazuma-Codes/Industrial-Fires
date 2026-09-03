"use client";

import React from "react";
import { FacilityProperties } from "../lib/types";
import { Factory, Star, Activity, Flame, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Props {
  facility: FacilityProperties;
  onSelect?: () => void;
}

export default function FacilityCard({ facility, onSelect }: Props) {
  const criticalityStars = Array.from({ length: 5 }, (_, i) => i < facility.criticality);

  return (
    <div
      onClick={onSelect}
      className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3.5 transition-all shadow-md hover:shadow-cyan-950/20 cursor-pointer text-xs"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800/60 text-cyan-400">
            <Factory className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-xs tracking-wide">
              {facility.name}
            </h3>
            <span className="text-[10px] text-slate-400 uppercase">
              {(facility.facility_type || "facility").replace(/_/g, " ")} {facility.operator ? `• ${facility.operator}` : ""}
            </span>
          </div>
        </div>

        {/* Criticality Rating */}
        <div className="flex items-center gap-0.5" title={`Criticality: ${facility.criticality}/5`}>
          {criticalityStars.map((filled, i) => (
            <Star
              key={i}
              className={`w-3 h-3 ${
                filled ? "fill-amber-400 text-amber-400" : "text-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 30-day Baseline Metrics */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80 my-2">
        <div className="text-center">
          <div className="text-[10px] text-slate-400">Mean FRP</div>
          <div className="font-mono font-bold text-slate-200">
            {facility.mean_frp ? `${facility.mean_frp.toFixed(1)} MW` : "N/A"}
          </div>
        </div>

        <div className="text-center">
          <div className="text-[10px] text-slate-400">P90 Threshold</div>
          <div className="font-mono font-bold text-amber-400">
            {facility.p90_frp ? `${facility.p90_frp.toFixed(1)} MW` : "N/A"}
          </div>
        </div>

        <div className="text-center">
          <div className="text-[10px] text-slate-400">30d Detections</div>
          <div className="font-mono font-bold text-cyan-300">
            {facility.detection_count ?? 0}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
        <span>{facility.latitude.toFixed(4)}°N, {facility.longitude.toFixed(4)}°E</span>
        <span className="text-cyan-400 flex items-center gap-0.5 font-medium hover:underline">
          View Detail <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
