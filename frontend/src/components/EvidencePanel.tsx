"use client";

import React from "react";
import { EvidenceData } from "../lib/types";
import {
  ExternalLink,
  ShieldCheck,
  Flame,
  Clock,
  MapPin,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

interface Props {
  evidence?: EvidenceData;
  classification: string;
}

export default function EvidencePanel({ evidence, classification }: Props) {
  if (!evidence) {
    return (
      <div className="p-4 text-xs text-slate-500 italic bg-slate-950/40 rounded-lg border border-slate-800">
        No automated explainability telemetry available for this record.
      </div>
    );
  }

  const { summary = [], spatial, thermal, temporal, probabilities = {}, external_links } = evidence;

  return (
    <div className="space-y-3.5 text-xs">
      {/* 1. Reasoning Summary */}
      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Explainable AI Rationale:</span>
        </div>
        <ul className="space-y-1.5">
          {summary.length > 0 ? (
            summary.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>{point}</span>
              </li>
            ))
          ) : (
            <li className="text-slate-400">Classified using multi-factor temporal & spatial heuristics.</li>
          )}
        </ul>
      </div>

      {/* 2. Three Diagnostic Pillars */}
      <div className="grid grid-cols-3 gap-2">
        {/* Spatial */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 mb-1">
            <MapPin className="w-3 h-3" />
            <span>Spatial</span>
          </div>
          <div className="text-[10px] text-slate-400">Asset Distance</div>
          <div className="font-mono font-bold text-slate-100 text-xs">
            {spatial?.distance_to_facility_m !== undefined && spatial?.distance_to_facility_m !== null
              ? `${spatial.distance_to_facility_m} m`
              : "Isolated (>2km)"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate" title={spatial?.facility_name || ""}>
            {spatial?.facility_name || "No nearby asset"}
          </div>
        </div>

        {/* Thermal */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 mb-1">
            <Flame className="w-3 h-3" />
            <span>Thermal</span>
          </div>
          <div className="text-[10px] text-slate-400">Baseline Deviation</div>
          <div className="font-mono font-bold text-slate-100 text-xs flex items-center gap-1">
            <span>{thermal?.frp_anomaly_ratio ? `${thermal.frp_anomaly_ratio}x` : "1.0x"}</span>
            {thermal?.frp_anomaly_ratio && thermal.frp_anomaly_ratio >= 2.0 && (
              <TrendingUp className="w-3 h-3 text-red-400" />
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            FRP: {thermal?.frp_mw ? `${thermal.frp_mw.toFixed(1)} MW` : "N/A"}
          </div>
        </div>

        {/* Temporal */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 mb-1">
            <Clock className="w-3 h-3" />
            <span>Temporal</span>
          </div>
          <div className="text-[10px] text-slate-400">30-Day Recurrence</div>
          <div className="font-mono font-bold text-slate-100 text-xs">
            {temporal?.persistence_30d !== undefined
              ? `${(temporal.persistence_30d * 100).toFixed(0)}%`
              : "0%"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {temporal?.detections_30d ? `${temporal.detections_30d} detections` : "First pass"}
          </div>
        </div>
      </div>

      {/* 3. Probabilities Distribution */}
      {Object.keys(probabilities).length > 0 && (
        <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-300 mb-2">
            Model Class Confidence Breakdown:
          </div>
          <div className="space-y-1.5">
            {Object.entries(probabilities)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([cls, prob]) => {
                const percent = Math.round(prob * 100);
                const isWinner = cls === classification;
                return (
                  <div key={cls} className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className={isWinner ? "font-bold text-cyan-300" : "text-slate-400"}>
                        {(cls || "unknown").replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className="font-mono text-slate-300">{percent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isWinner ? "bg-cyan-500" : "bg-slate-600"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 4. Satellite Ground Truth Validation */}
      {external_links && (
        <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
            External Satellite Optical Ground Truth:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {external_links.copernicus_browser && (
              <a
                href={external_links.copernicus_browser}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 transition-colors"
                title="Open Copernicus Data Space Browser (Sentinel-2 10m Multi-spectral)"
              >
                <span className="font-medium text-[11px]">Sentinel-2 (Copernicus)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {external_links.nasa_worldview && (
              <a
                href={external_links.nasa_worldview}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 transition-colors"
                title="Open NASA Worldview (VIIRS Thermal Radiance)"
              >
                <span className="font-medium text-[11px]">NASA Worldview</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {(external_links as any).google_satellite && (
              <a
                href={(external_links as any).google_satellite}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 flex items-center justify-between p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                title="Open High-Resolution Satellite & Aerial Imagery"
              >
                <span className="font-medium text-[11px]">High-Res Optical Satellite View (Google Earth)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
