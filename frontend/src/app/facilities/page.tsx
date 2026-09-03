"use client";

import React, { useEffect, useState } from "react";
import { FacilityProperties } from "../../lib/types";
import { api } from "../../lib/api";
import FacilityCard from "../../components/FacilityCard";
import Link from "next/link";
import { Factory, ArrowLeft, Search, Filter, ShieldCheck, Flame } from "lucide-react";

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityProperties[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");

  useEffect(() => {
    api.getFacilities().then((fc) => {
      const items = fc.features.map((f) => f.properties);
      setFacilities(items);
      setLoading(false);
    });
  }, []);

  const types = ["ALL", "refinery", "power_plant", "factory", "industrial_area"];

  const filtered = facilities.filter((f) => {
    if (selectedType !== "ALL" && f.facility_type !== selectedType) return false;
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      const matchName = f.name.toLowerCase().includes(q);
      const matchOp = f.operator?.toLowerCase().includes(q);
      if (!matchName && !matchOp) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to GIS Command</span>
            </Link>
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <Factory className="w-6 h-6 text-cyan-400" />
            <span>Monitored Industrial Assets & 30-Day Baselines</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Georeferenced critical infrastructure perimeters, baseline FRP distributions, and operational heat signatures.
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-right">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Tracked Facilities</div>
          <div className="font-mono text-xl font-extrabold text-cyan-400">{facilities.length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs">
        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Facility Sector:</span>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                selectedType === t
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              {t === "ALL" ? "All Types" : t.replace(/_/g, " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search facility name, operator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Loading industrial assets catalogue...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm bg-slate-900/40 rounded-xl border border-slate-800">
          No industrial facilities match the specified criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((fac) => (
            <Link key={fac.id} href={`/facilities/${fac.id}`}>
              <FacilityCard facility={fac} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
