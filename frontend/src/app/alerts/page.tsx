"use client";

import React, { useEffect, useState } from "react";
import { AlertItem, RiskLevel } from "../../lib/types";
import { api } from "../../lib/api";
import RiskBadge from "../../components/RiskBadge";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Check,
  LocateFixed,
  ArrowLeft,
  Filter,
} from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts({ limit: 100 });
      setAlerts(data);
    } catch (e) {
      console.error("Error loading alerts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleAcknowledge = async (id: number) => {
    await api.acknowledgeAlert(id);
    loadAlerts();
  };

  const handleResolve = async (id: number) => {
    await api.resolveAlert(id);
    loadAlerts();
  };

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    return true;
  });

  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status === "ACTIVE").length;
  const highCount = alerts.filter((a) => a.severity === "HIGH" && a.status === "ACTIVE").length;
  const acknowledgedCount = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED").length;

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
      {/* Top Banner */}
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
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <span>Tactical Intelligence Threat Alerts</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational anomalies exceeding critical FRP thresholds or located within high-hazard industrial perimeters.
          </p>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-900/60 text-center">
            <div className="text-[10px] text-red-400 uppercase font-bold">Active Critical</div>
            <div className="font-mono text-lg font-extrabold text-red-200">{criticalCount}</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-orange-950/60 border border-orange-900/60 text-center">
            <div className="text-[10px] text-orange-400 uppercase font-bold">Active High</div>
            <div className="font-mono text-lg font-extrabold text-orange-200">{highCount}</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Acknowledged</div>
            <div className="font-mono text-lg font-extrabold text-slate-200">{acknowledgedCount}</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Resolved</div>
            <div className="font-mono text-lg font-extrabold text-slate-200">{resolvedCount}</div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Severity:</span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                severityFilter === sev
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Status:</span>
          {["ALL", "ACTIVE", "ACKNOWLEDGED", "RESOLVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                statusFilter === st
                  ? "bg-slate-200 text-slate-950 font-bold"
                  : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Loading active tactical threat alerts...
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm bg-slate-900/40 rounded-xl border border-slate-800">
          No threat alerts match the selected criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-slate-900/90 border rounded-xl p-4 transition-all shadow-md ${
                alert.severity === "CRITICAL"
                  ? "border-red-500/50 bg-red-950/10 hover:border-red-500"
                  : "border-slate-800 hover:border-slate-700"
              } ${alert.status === "RESOLVED" ? "opacity-50" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <RiskBadge level={alert.severity} />
                  <span className="text-xs font-mono text-slate-400">
                    Incident #{alert.id} • Event Ref #{alert.event_id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      alert.status === "ACTIVE"
                        ? "bg-red-950 text-red-300 border border-red-800"
                        : alert.status === "ACKNOWLEDGED"
                        ? "bg-amber-950 text-amber-300 border border-amber-800"
                        : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(alert.created_at).toLocaleString()}</span>
                </div>
              </div>

              <h2 className="text-sm font-bold text-slate-100 mb-1.5 tracking-wide">
                {alert.title}
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {alert.description}
              </p>

              {alert.recommended_action && (
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 mb-3 text-xs">
                  <span className="font-semibold text-cyan-400">Operational Directive: </span>
                  <span className="text-slate-300">{alert.recommended_action}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-4 text-slate-400">
                  {alert.facility_name && (
                    <span>
                      Target Asset: <strong className="text-slate-200">{alert.facility_name}</strong>
                    </span>
                  )}
                  {alert.latitude && alert.longitude && (
                    <span className="font-mono text-[11px]">
                      {alert.latitude.toFixed(4)}°N, {alert.longitude.toFixed(4)}°E
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/?event=${alert.event_id}`}
                    className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium transition-colors"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>View on GIS Map</span>
                  </Link>

                  {alert.status === "ACTIVE" && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-300 font-medium transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  )}

                  {alert.status !== "RESOLVED" && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-medium transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
