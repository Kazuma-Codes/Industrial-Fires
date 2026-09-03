"use client";

import React from "react";
import { RiskLevel } from "../lib/types";

interface Props {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
}

export default function RiskBadge({ level, score, showScore = true }: Props) {
  const styles: Record<RiskLevel, { bg: string; text: string; border: string; pulse?: boolean }> = {
    CRITICAL: {
      bg: "bg-red-950/80",
      text: "text-red-400",
      border: "border-red-500/50",
      pulse: true,
    },
    HIGH: {
      bg: "bg-orange-950/80",
      text: "text-orange-400",
      border: "border-orange-500/50",
    },
    MEDIUM: {
      bg: "bg-amber-950/80",
      text: "text-amber-400",
      border: "border-amber-500/50",
    },
    LOW: {
      bg: "bg-emerald-950/80",
      text: "text-emerald-400",
      border: "border-emerald-500/50",
    },
  };

  const current = styles[level] || styles.LOW;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase border ${current.bg} ${current.text} ${current.border}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          level === "CRITICAL"
            ? "bg-red-500 animate-ping"
            : level === "HIGH"
            ? "bg-orange-500"
            : level === "MEDIUM"
            ? "bg-amber-400"
            : "bg-emerald-500"
        }`}
      />
      <span>{level}</span>
      {showScore && score !== undefined && (
        <span className="opacity-80 font-mono text-[10px]">({score})</span>
      )}
    </span>
  );
}
