"use client";

import React from "react";
import { Clock, Play, Pause } from "lucide-react";

interface Props {
  selectedRange: "all" | "today" | "3days" | "7days" | "30days";
  onRangeChange: (range: "all" | "today" | "3days" | "7days" | "30days") => void;
}

export default function TimeSlider({ selectedRange, onRangeChange }: Props) {
  const options: { id: "all" | "today" | "3days" | "7days" | "30days"; label: string }[] = [
    { id: "today", label: "Today (Live)" },
    { id: "3days", label: "Past 3 Days" },
    { id: "7days", label: "7 Days" },
    { id: "30days", label: "30 Days (Full Baseline)" },
    { id: "all", label: "All Records" },
  ];

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-2 flex items-center gap-2 shadow-lg text-xs">
      <div className="flex items-center gap-1.5 text-slate-400 font-semibold px-2">
        <Clock className="w-3.5 h-3.5 text-cyan-400" />
        <span>Time Horizon:</span>
      </div>

      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onRangeChange(opt.id)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              selectedRange === opt.id
                ? "bg-cyan-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
