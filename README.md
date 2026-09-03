# AI-Based Thermal Intelligence Platform — SIH 2026 (NTRO)

**Problem Statement ID:** SIH26162  
**Target Organization:** National Technical Research Organisation (NTRO)  
**Primary Demo Region:** Jamnagar Refinery & Petrochemical Corridor, Gujarat, India

---

## Executive Summary

Standard wildfire monitoring portals display undifferentiated "fire dots" on a map. For defense and national intelligence organizations like NTRO, this is insufficient.

The **AI-Based Thermal Intelligence Platform** transforms raw satellite sensor data into high-value tactical intelligence by answering four core operational questions:

1. **What is it?** Multi-class discrimination separating routine gas flaring, industrial process heat, uncontrolled industrial fires, wildfire fronts, and seasonal crop residue burns.
2. **Is it normal?** Dynamic 30-day Fire Radiative Power (FRP) rolling baselines and spatial persistence metrics per industrial asset.
3. **How serious?** A multi-factor tactical threat score (0–100) and severity rating (CRITICAL, HIGH, MEDIUM, LOW).
4. **Why?** Transparent AI explainability diagnostics with spatial, thermal, and temporal evidence, directly linked to Copernicus Sentinel-2 optical imagery and NASA Worldview for ground-truth validation.

---

## System Architecture

```mermaid
graph TD
    A["NASA FIRMS VIIRS Feed<br/>(375m Active Fire Detections)"] -->|CSV / REST API| B["Ingestion & ETL Engine"]
    C["OpenStreetMap Overpass API<br/>(Critical Infrastructure)"] -->|GeoJSON Centroids| B
    B --> D[("PostgreSQL + PostGIS<br/>(Neon Free Tier / Local)")]
    
    subgraph Intelligence Processing Engine
        D --> E["Spatial Enrichment Join<br/>(2km buffer / perimeter)"]
        E --> F["Grid Temporal Persistence<br/>(30d / 7d recurrence)"]
        F --> G["Facility FRP Baselines<br/>(Mean, P90, Anomaly Ratio)"]
        G --> H["2-Layer Classification Engine<br/>(Rule-Based + ML Classifier)"]
        H --> I["Tactical Risk Scorer<br/>(0-100 multi-factor formula)"]
        I --> J["Operational Alert Generator<br/>(Active, Ack, Resolved)"]
    end
    
    J --> D
    D --> K["FastAPI Backend Server<br/>(REST & GeoJSON API)"]
    K --> L["Next.js Tactical GIS Dashboard<br/>(MapLibre GL + Tailwind CSS)"]
    
    L --> M["Interactive OpenFreeMap"]
    L --> N["AI Explainability Drawer"]
    L --> O["Live Alert Dispatch Queue"]
    L --> P["Asset Baseline Telemetry"]
```

---

## What Makes This Win for Judges

| Evaluation Pillar | Generic Fire Dashboards | NTRO Thermal Intelligence Platform |
|---|---|---|
| **Data Context** | Isolated FIRMS point dots | Spatially joined with OSM refineries, power plants, chemical estates |
| **Normalcy Detection** | Cannot distinguish routine flare from fire | Calculates rolling 30-day mean & 90th percentile FRP baseline |
| **Temporal Footprint** | Static single-day points | 30-day grid persistence ratio (\% recurrence) |
| **Explainability** | Black-box output | Evidence tree breaking down distance, anomaly ratio, and ML probabilities |
| **Optical Ground-Truth** | None | 1-click launch to Copernicus Sentinel-2 MSI and NASA Worldview |
| **Tactical Usability** | No triage workflow | Real-time incident dispatch queue with acknowledge & resolve states |

---

## 4 Ready-to-Pitch Demo Scenarios (Jamnagar Corridor)

1. **Scenario 1: Routine Gas Flare (Reliance Jamnagar Flare Stack 1)**
   - **Signature:** Nighttime detection, detected 25 of last 30 days (persistence = 0.83), stable FRP ~9.5 MW.
   - **Classification:** `gas_flare` / `persistent_industrial_source`
   - **Risk:** LOW. No alert triggered.

2. **Scenario 2: Critical Industrial Fire / Flare Spike Anomaly (Nayara Refinery)**
   - **Signature:** Located 140m from refinery perimeter, sudden massive jump to 36.4 MW (4.5x baseline), zero detections over preceding 3 weeks.
   - **Classification:** `industrial_fire`
   - **Risk:** CRITICAL (Score: 88/100). Triggers immediate priority alert with emergency containment directive.

3. **Scenario 3: Expanding Wildfire Cluster (Gir Outskirts Fringe)**
   - **Signature:** Moving cluster of 6 fire anomalies advancing across 3 days, >12km away from industrial facilities.
   - **Classification:** `wildfire`
   - **Risk:** MEDIUM/HIGH. Recommends aerial drone perimeter reconnaissance.

4. **Scenario 4: Seasonal Agricultural Burning (Rural Saurashtra Cropland)**
   - **Signature:** 18 dispersed low-intensity anomalies (FRP 3–9 MW) in agricultural zones matching harvest calendar.
   - **Classification:** `agricultural_burning`
   - **Risk:** LOW.

---

## Free Cloud Stack Architecture

| Layer | Provider | Free Tier Specification |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Unlimited builds, global CDN edge, `.vercel.app` domain |
| **Backend API** | [Render](https://render.com) | 750 free hours/month web service, `.onrender.com` |
| **Database** | [Neon](https://neon.tech) | 0.5 GB Serverless PostgreSQL with native PostGIS extension |
| **Map Base** | [OpenFreeMap](https://openfreemap.org) | Unlimited vector map tiles (Liberty style), zero API key needed |
| **Automation** | [GitHub Actions](https://github.com) | 2,000 free minutes/month for 6-hourly FIRMS ingestion workflow |

---

## Local Development Quickstart

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup

```bash
# Navigate to project root
cd d:/RaidenShogun/SIH

# Activate Python 3.11 virtual environment
backend\venv\Scripts\activate

# Initialize Database Schema & Seed Jamnagar Demo Scenarios
python backend/scripts/init_db.py
python backend/scripts/seed_demo.py

# Start FastAPI Development Server
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
```

Backend will be live at `http://localhost:8000`.  
Interactive Swagger API documentation: `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd d:/RaidenShogun/SIH/frontend

# Install dependencies
npm install

# Run Next.js tactical dashboard
npm run dev
```

Frontend will be live at `http://localhost:3000`.

---

## Free Cloud Deployment Guide

### Step 1: Provision Neon PostgreSQL with PostGIS
1. Sign up at [neon.tech](https://neon.tech) and create a project in `AWS ap-south-1 (Mumbai)` or `us-east-1`.
2. In the Neon SQL Editor, paste and execute `sql/schema.sql`.
3. Copy your connection URL: `postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require`.

### Step 2: Deploy Backend to Render
1. Sign up at [render.com](https://render.com) -> **New Web Service** -> Connect your GitHub repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Environment Variables:
   - `DATABASE_URL`: *(Your Neon connection string)*
   - `ADMIN_API_TOKEN`: `sih_ntro_thermal_secret_2026`
   - `ALLOWED_ORIGINS`: `https://your-frontend.vercel.app,http://localhost:3000`
   - `DEMO_BBOX`: `69.5,22.0,70.8,23.0`

### Step 3: Deploy Frontend to Vercel
1. Sign up at [vercel.com](https://vercel.com) -> **Import Git Repository**.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Next.js`
3. Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend.onrender.com`
4. Click **Deploy**.

---

## API Documentation

- `GET /api/events` — Returns standard GeoJSON FeatureCollection of classified thermal anomalies with filters (`classification`, `risk_level`, `bbox`, `start_date`, `end_date`).
- `GET /api/events/{id}` — Exhaustive telemetry, baseline deviation %, and AI explainability evidence tree.
- `GET /api/facilities` — GeoJSON of critical industrial assets with baseline FRP statistics.
- `GET /api/facilities/{id}` — Individual facility telemetry profile and active threat count.
- `GET /api/alerts` — Tactical alert feeds with severity filtering.
- `POST /api/alerts/{id}/acknowledge` — Mark alert acknowledged.
- `POST /api/alerts/{id}/resolve` — Mark alert resolved.
- `GET /api/stats` — Dashboard HUD KPI metrics.
- `POST /api/admin/seed-demo` — Seed Jamnagar demonstration scenarios.
- `POST /api/admin/run-pipeline` — Trigger end-to-end intelligence pipeline.

---

## Team & Presentation Talk Track for SIH Judges

1. **The Hook (0:00 - 0:45):** *"Honorable judges, open any thermal fire dashboard today and you will see identical fire dots over forests and refineries alike. First responders cannot tell whether a heat signature is a routine flare stack or a catastrophic tank explosion. We built the AI-Based Thermal Intelligence Platform for NTRO."*
2. **The Intelligence Engine (0:45 - 2:00):** *"By maintaining continuous 30-day FRP baselines for critical infrastructure, our system identifies when heat is expected routine flaring versus a sudden 4.5x surge. Notice this blue marker on Reliance Jamnagar: high persistence, within baseline, zero risk. But here at Nayara, FRP spiked to 36.4 MW today—instant CRITICAL alert."*
3. **The Explainability (2:00 - 3:00):** *"Every alert is 100% explainable with spatial proximity, thermal deviation, temporal persistence, and 1-click optical verification via Sentinel-2. Ready for immediate deployment on free cloud infrastructure."*
