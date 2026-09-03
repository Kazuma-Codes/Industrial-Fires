import type { Metadata } from "next";
import Link from "next/link";
import "../styles/globals.css";
import { Flame, ShieldAlert, Factory, Radio, Globe, Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Thermal Intelligence Platform | SIH 2026 (NTRO)",
  description:
    "AI-driven VIIRS thermal anomaly classification, industrial baseline intelligence, and explainable GIS defense command center.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-cyan-500 selection:text-slate-950">
        {/* Top Intelligence Header Bar */}
        <header className="bg-slate-950/95 backdrop-blur border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Flame className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm tracking-wider text-slate-100">
                    THERMAL INTELLIGENCE
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                    SIH26162 • NTRO
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  NASA FIRMS VIIRS • Facility Baselines • AI Explainability
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 text-xs">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>GIS Command</span>
            </Link>
            <Link
              href="/alerts"
              className="px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Threat Alerts</span>
            </Link>
            <Link
              href="/facilities"
              className="px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors"
            >
              <Factory className="w-3.5 h-3.5 text-amber-400" />
              <span>Monitored Assets</span>
            </Link>
          </nav>

          {/* Status Beacon & Operational Mode */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-semibold tracking-wide uppercase">
                Satellite Feed Live
              </span>
            </div>

            <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-400">
              Corridor: <strong className="text-cyan-300">Jamnagar, GJ</strong>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
