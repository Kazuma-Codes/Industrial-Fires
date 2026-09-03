"use client";

import React, { useState } from "react";
import { DashboardStats } from "../lib/types";
import {
  Flame,
  AlertTriangle,
  Factory,
  Radio,
  RefreshCw,
  Sparkles,
  TreePine,
  Wheat,
} from "lucide-react";
import { api } from "../lib/api";

interface Props {
  stats: DashboardStats | null;
  onRefresh: () => void;
}

export default function StatsBar({ stats, onRefresh }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleSeedDemo = async () => {
    setLoadingAction("seed");
    try {
      await api.seedDemo();
      onRefresh();
    } catch (e) {
      console.error("Failed to seed demo:", e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRunPipeline = async () => {
    setLoadingAction("pipeline");
    try {
      await api.runPipeline();
      onRefresh();
    } catch (e) {
      console.error("Failed to run pipeline:", e);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
      <div className="flex flex-wrap items-center gap-4">
        {/* Total Anomalies */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-md border border-slate-800">
          <Flame className="w-4 h-4 text-amber-500" />
          <span className="text-slate-400">Total Detections:</span>
          <span className="font-mono font-bold text-slate-100 text-sm">
            {stats?.total_events ?? "--"}
          </span>
        </div>

        {/* Critical Alerts */}
        <div className="flex items-center gap-2 bg-red-950/40 px-3 py-1.5 rounded-md border border-red-900/50 text-red-300">
          <span className="relative flex h-2.5 w-2.5">
            {(stats?.critical_alerts ?? 0) > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span>Critical Alerts:</span>
          <span className="font-mono font-bold text-red-200">
            {stats?.critical_alerts ?? 0}
          </span>
        </div>

        {/* Industrial Fires */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-md border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-slate-400">Industrial Fires:</span>
          <span className="font-mono font-bold text-red-400">
            {stats?.industrial_fires ?? 0}
          </span>
        </div>

        {/* Persistent Flares */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-md border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span className="text-slate-400">Routine Flares & Sources:</span>
          <span className="font-mono font-bold text-purple-300">
            {(stats?.persistent_sources ?? 0) + (stats?.gas_flares ?? 0)}
          </span>
        </div>

        {/* Wildfires */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-md border border-slate-800">
          <TreePine className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-slate-400">Wildfires:</span>
          <span className="font-mono font-bold text-orange-300">
            {stats?.wildfires ?? 0}
          </span>
        </div>

        {/* Agricultural */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-md border border-slate-800">
          <Wheat className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-slate-400">Agri Burns:</span>
          <span className="font-mono font-bold text-yellow-300">
            {stats?.agricultural_burning ?? 0}
          </span>
        </div>

        {/* Facilities */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-md border border-slate-800">
          <Factory className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Assets Monitored:</span>
          <span className="font-mono font-bold text-cyan-300">
            {stats?.total_facilities ?? 0}
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSeedDemo}
          disabled={loadingAction !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
          title="Reset & populate Jamnagar demo scenarios (refinery flares, fire anomaly, wildfire, agri burns)"
        >
          <Sparkles className={`w-3.5 h-3.5 ${loadingAction === "seed" ? "animate-spin" : ""}`} />
          <span>{loadingAction === "seed" ? "Seeding..." : "Load Demo Scenarios"}</span>
        </button>

        <button
          onClick={handleRunPipeline}
          disabled={loadingAction !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
          title="Run Spatial Enrichment, Persistence, Baseline, and Classifier"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAction === "pipeline" ? "animate-spin" : ""}`} />
          <span>{loadingAction === "pipeline" ? "Running..." : "Run Pipeline"}</span>
        </button>
      </div>
    </div>
  );
}
