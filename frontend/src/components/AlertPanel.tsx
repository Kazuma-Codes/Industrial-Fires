"use client";

import React from "react";
import { AlertItem } from "../lib/types";
import RiskBadge from "./RiskBadge";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  LocateFixed,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { api } from "../lib/api";

interface Props {
  alerts: AlertItem[];
  onSelectEvent?: (lat: number, lon: number, eventId: number) => void;
  onRefresh?: () => void;
}

export default function AlertPanel({ alerts, onSelectEvent, onRefresh }: Props) {
  const handleAcknowledge = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.acknowledgeAlert(id);
    if (onRefresh) onRefresh();
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-xl flex flex-col max-h-[380px] overflow-hidden text-xs">
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
            Tactical Alert Queue
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-red-950 text-red-300 font-mono text-[10px] border border-red-800/60 font-bold">
            {alerts.filter((a) => a.status === "ACTIVE").length}
          </span>
        </div>
      </div>

      {/* Alert Feed */}
      <div className="overflow-y-auto divide-y divide-slate-800/60">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-slate-500 italic">
            No active threat alerts registered. All assets nominal.
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 transition-colors hover:bg-slate-800/40 cursor-pointer ${
                alert.status === "ACKNOWLEDGED" ? "opacity-60 bg-slate-950/20" : ""
              }`}
              onClick={() => {
                if (alert.latitude && alert.longitude && onSelectEvent) {
                  onSelectEvent(alert.latitude, alert.longitude, alert.event_id);
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <RiskBadge level={alert.severity} showScore={false} />
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <div className="font-bold text-slate-200 text-xs mb-1">
                {alert.title}
              </div>

              <div className="text-[11px] text-slate-400 mb-2 line-clamp-2 leading-relaxed">
                {alert.description}
              </div>

              {alert.recommended_action && (
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-cyan-300 mb-2">
                  <span className="font-semibold text-slate-400">Response Action: </span>
                  {alert.recommended_action}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-[11px]">
                {alert.latitude && alert.longitude && (
                  <button
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (alert.latitude && alert.longitude && onSelectEvent) {
                        onSelectEvent(alert.latitude, alert.longitude, alert.event_id);
                      }
                    }}
                  >
                    <LocateFixed className="w-3 h-3" />
                    <span>Zoom to Threat</span>
                  </button>
                )}

                {alert.status === "ACTIVE" ? (
                  <button
                    onClick={(e) => handleAcknowledge(alert.id, e)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px]"
                  >
                    <Check className="w-3 h-3" />
                    <span>Acknowledge</span>
                  </button>
                ) : (
                  <span className="text-slate-500 text-[10px] italic">Acknowledged</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
