"use client";

import React from "react";
import { ClassificationType, FilterState, RiskLevel } from "../lib/types";
import { Filter, RotateCcw, Search } from "lucide-react";

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const CLASSIFICATIONS: { id: ClassificationType; label: string; color: string }[] = [
  { id: "industrial_fire", label: "Industrial Fire", color: "text-red-400 border-red-500/50 bg-red-950/40" },
  { id: "persistent_industrial_source", label: "Persistent Source", color: "text-sky-400 border-sky-500/50 bg-sky-950/40" },
  { id: "gas_flare", label: "Gas Flare", color: "text-purple-400 border-purple-500/50 bg-purple-950/40" },
  { id: "wildfire", label: "Wildfire", color: "text-orange-400 border-orange-500/50 bg-orange-950/40" },
  { id: "agricultural_burning", label: "Agri Burning", color: "text-yellow-400 border-yellow-500/50 bg-yellow-950/40" },
  { id: "unknown", label: "Unknown", color: "text-slate-400 border-slate-700 bg-slate-900/40" },
];

const RISK_LEVELS: { id: RiskLevel; label: string; color: string }[] = [
  { id: "CRITICAL", label: "Critical", color: "text-red-400 border-red-500/60 bg-red-950/60" },
  { id: "HIGH", label: "High", color: "text-orange-400 border-orange-500/60 bg-orange-950/60" },
  { id: "MEDIUM", label: "Medium", color: "text-amber-400 border-amber-500/60 bg-amber-950/60" },
  { id: "LOW", label: "Low", color: "text-emerald-400 border-emerald-500/60 bg-emerald-950/60" },
];

export default function FilterBar({ filters, onChange }: Props) {
  const toggleClassification = (cls: ClassificationType) => {
    const exists = filters.classifications.includes(cls);
    const updated = exists
      ? filters.classifications.filter((c) => c !== cls)
      : [...filters.classifications, cls];
    onChange({ ...filters, classifications: updated });
  };

  const toggleRisk = (risk: RiskLevel) => {
    const exists = filters.riskLevels.includes(risk);
    const updated = exists
      ? filters.riskLevels.filter((r) => r !== risk)
      : [...filters.riskLevels, risk];
    onChange({ ...filters, riskLevels: updated });
  };

  const resetFilters = () => {
    onChange({
      classifications: [],
      riskLevels: [],
      minConfidence: 0,
      dateRange: "all",
      searchQuery: "",
    });
  };

  const hasActiveFilters =
    filters.classifications.length > 0 ||
    filters.riskLevels.length > 0 ||
    filters.searchQuery !== "";

  return (
    <div className="bg-slate-950/80 backdrop-blur border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filters:</span>
        </div>

        {/* Classification Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CLASSIFICATIONS.map((c) => {
            const active =
              filters.classifications.length === 0 ||
              filters.classifications.includes(c.id);
            const isExplicit = filters.classifications.includes(c.id);

            return (
              <button
                key={c.id}
                onClick={() => toggleClassification(c.id)}
                className={`px-2 py-1 rounded border text-[11px] font-medium transition-all ${
                  isExplicit
                    ? `${c.color} ring-1 ring-white/20 font-semibold`
                    : active && filters.classifications.length === 0
                    ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                    : "bg-slate-950/40 border-slate-800/50 text-slate-600 opacity-40 hover:opacity-75"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-[1px] bg-slate-800 hidden md:block" />

        {/* Risk Level Filters */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px]">Risk:</span>
          {RISK_LEVELS.map((r) => {
            const isSelected = filters.riskLevels.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggleRisk(r.id)}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider uppercase transition-all ${
                  isSelected
                    ? `${r.color} ring-1 ring-white/30`
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Reset */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search facility or coordinate..."
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            className="bg-slate-900 border border-slate-800 rounded-md pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 w-48 transition-all"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
