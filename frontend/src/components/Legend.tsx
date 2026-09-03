"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";

export default function Legend() {
  const [isOpen, setIsOpen] = useState(true);

  const items = [
    { label: "Industrial Fire / Hazard", color: "#ef4444", shape: "ring", desc: "Sudden spike (>2.5x baseline)" },
    { label: "Routine Gas Flare", color: "#c084fc", shape: "circle", desc: "Nighttime persistent flaring" },
    { label: "Persistent Industrial Source", color: "#38bdf8", shape: "circle", desc: "Process heat / cracker unit" },
    { label: "Wildfire Cluster", color: "#f97316", shape: "circle", desc: "Vegetative / forest spread" },
    { label: "Agricultural Burning", color: "#facc15", shape: "circle", desc: "Seasonal crop residue clearing" },
    { label: "Industrial Facility Context", color: "#06b6d4", shape: "square", desc: "OSM Refinery / Plant" },
  ];

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-xl text-xs text-slate-300 w-64 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 bg-slate-950/60 hover:bg-slate-800/50 transition-colors font-medium border-b border-slate-800/80"
      >
        <span className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          Intelligence Legend
        </span>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="p-2.5 space-y-2">
          {items.map((it) => (
            <div key={it.label} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-shrink-0">
                {it.shape === "square" ? (
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-sm border border-cyan-300"
                    style={{ backgroundColor: it.color }}
                  />
                ) : it.shape === "ring" ? (
                  <span className="relative flex h-3.5 w-3.5">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: it.color }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white"
                      style={{ backgroundColor: it.color }}
                    />
                  </span>
                ) : (
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-full border border-slate-900"
                    style={{ backgroundColor: it.color }}
                  />
                )}
              </span>
              <div>
                <div className="font-semibold text-slate-200">{it.label}</div>
                <div className="text-[10px] text-slate-400">{it.desc}</div>
              </div>
            </div>
          ))}
          <div className="pt-1.5 mt-1.5 border-t border-slate-800 text-[10px] text-slate-400">
            Circle radius scales with Fire Radiative Power (MW)
          </div>
        </div>
      )}
    </div>
  );
}
