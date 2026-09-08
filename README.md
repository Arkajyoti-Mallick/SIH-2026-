# LANDSLIDEX
### AI-Powered Landslide Risk Intelligence & Early Warning Platform
**Smart India Hackathon 2026 | Problem Statement: SIH26001 | Theme: Disaster Management | Team: Geo X**

---

## 1. Executive Summary & Problem Context

The North-Eastern Region (NER) of India—spanning Sikkim, Nagaland, Meghalaya, Mizoram, Assam, and Arunachal Pradesh—faces devastating landslides during the monsoon season. Lifeline transportation corridors such as **National Highway 10 (Siliguri - Rangpo - Gangtok)** and **National Highway 29 (Dimapur - Kohima)** suffer recurring slope failures that isolate entire states, sever supply chains, damage infrastructure, and endanger lives.

Traditional early warning systems suffer from critical deficiencies:
- **Binary "Landslide / No Landslide" output:** Lacks granular risk progression, leaving authorities unable to prioritize resources.
- **Isolated single-sensor reliance:** Rain gauges alone fail to account for cumulative antecedent saturation, internal pore water pressure, or slope gradient.
- **High false alarm rates:** Breeds warning fatigue and administrative complacency.
- **Connectivity blindness:** Mountainous valleys frequently lose cellular connectivity during storms, disabling conventional cloud-only dashboards.
- **No closed-loop human feedback:** Citizen and field officer observations are siloed rather than integrated into real-time decision-support systems.

---

## 2. The LandSlideX Solution

LandSlideX is an enterprise-grade geospatial and AI disaster-management platform. It transforms heterogeneous raw environmental telemetry into:
$$\text{RAW DATA} \longrightarrow \text{VALIDATION} \longrightarrow \text{PROCESSING} \longrightarrow \text{AI ANALYSIS} \longrightarrow \text{CALIBRATED RISK SCORE} \longrightarrow \text{CONFIDENCE \%} \longrightarrow \text{GIS VISUALIZATION} \longrightarrow \text{SOP RECOMMENDATION} \longrightarrow \text{MULTI-CHANNEL EARLY WARNING} \longrightarrow \text{HUMAN FEEDBACK}$$

### Calibrated Risk Scoring Matrix
LandSlideX does **not** generate crude binary alerts. It calculates a site-calibrated continuous score from **0 to 100**:
- **0–25 (LOW):** Green (`#10B981`) • Routine surveillance, normal drain maintenance.
- **26–50 (MODERATE):** Yellow (`#F59E0B`) • Increase telemetry polling frequency, inspect culvert chutes.
- **51–75 (HIGH):** Orange (`#F97316`) • Technical field inspection team deployed, restrict heavy freight transit, pre-position earthmoving machinery.
- **76–100 (EXTREME):** Red (`#EF4444`) • Immediate emergency traffic diversion, activate multi-channel sirens (130dB) and cell broadcast SMS, open relief shelters.

> [!IMPORTANT]
> **Safety & Regulatory Standard**: In strict accordance with disaster management ethics, LandSlideX provides **decision-support risk intelligence and early warnings** to assist district magistrates, engineers, and field officers. It does not issue unverified automated evacuation mandates.

---

## 3. Monorepo Structure

```
LandSlideX/
│
├── frontend/                     # Modern Web Application (React, TypeScript, Tailwind, Leaflet, PWA)
│   ├── public/                   # PWA Manifest, Service Worker, Static GeoJSON
│   ├── app.css                   # Tactical Mission-Control Design System
│   ├── app.js                    # SPA State Store, Leaflet GIS Engine, 16 Page Controllers
│   ├── index.html                # Main Shell, Topbar, Sidebar, SIH Simulation Controller
│   └── package.json
│
├── backend/                      # High-Performance API & WebSockets (FastAPI & Python 3.14)
│   ├── api/                      # REST Endpoints (Auth, Zones, Sensors, Alerts, Incidents, GIS, Admin)
│   ├── services/                 # Risk Engine, Alert Management, SOP Matrix, Multi-channel Notification
│   ├── models/                   # Pydantic Schemas & Data Structures
│   ├── database/                 # Rich Seed Data for 8 NER Zones, 48 Sensors, Historical Landslides
│   ├── workers/                  # SIH 5-Phase Simulation State Machine & Telemetry Generators
│   ├── requirements.txt
│   └── main.py                   # FastAPI Server, WebSockets, SPA Static File Mounting
│
├── ml/                           # AI/ML Pipeline
│   ├── datasets/                 # Synthetic Historical NER Landslide & Weather Datasets
│   ├── feature_engineering/      # Antecedent Precipitation Index (API), Safety Factor Proxy
│   ├── training/                 # Model Training Pipeline (ROC-AUC 0.968, Accuracy 91.8%)
│   ├── risk_prediction/          # Inference Engine with Explainable AI (XAI) Attribution
│   └── models/                   # Serialized Random Forest, Isolation Forest & Model Metrics
│
├── iot/                          # Embedded & Sensor Telemetry Gateway
│   ├── esp32/                    # ESP32 C++ Firmware Sketch (RS485 Modbus, Tipping Rain, MPU6050 Tilt, MQTT)
│   ├── mqtt/                     # MQTT Subscriber & Ingestion Bridge
│   └── gateway/                  # Telemetry Packet Simulator
│
├── gis/                          # Spatial Layers & Geospatial Processing
│   ├── dem/                      # Digital Elevation Model Profiles & Slope Gradients
│   ├── roads/                    # GeoJSON Strategic Highway Corridors (NH-10, NH-29, NH-55)
│   ├── villages/                 # GeoJSON Vulnerable Settlements & Relief Shelters
│   ├── landslide_inventory/      # Geological Survey of India (GSI) Historical Slide Records
│   └── layers/                   # High-Risk NER Polygon Zones
│
├── edge/                         # Offline-First Edge Synchronizer
│   ├── local_cache/              # Offline Cache Files & Incident Queue
│   └── sync_manager/             # Auto-reconnection & Queue Flushing Logic
│
├── infrastructure/               # Containerization & Deployment
│   ├── docker/                   # Dockerfile.backend, Dockerfile.frontend, docker-compose.yml
│   └── nginx/                    # Reverse Proxy with WebSocket Upgrades
│
├── docs/                         # Project Documentation
│   ├── architecture/             # Architectural Diagrams & Data Flow Specifications
│   └── ml/                       # Model Evaluation & Feature Importance Reports
│
└── README.md                     # Comprehensive Presentation Document
```

---

## 4. Key Platform Features

1. **Mission-Control Command Center (`/dashboard`):** Real-time KPI cards, interactive GIS map, 24h environmental condition gauges, acceleration trend lines, and multi-channel dispatch trackers.
2. **Fullscreen GIS Risk Map (`/risk-map`):** Vector polygon zones, strategic highway lifelines, live sensor markers with pulse animations, settlement population exposure, and inspector drawer.
3. **Explainable AI (XAI) Risk Engine (`/prediction`):** 0–100 risk dial, confidence gauge, geotechnical factor of safety ($FS$), and natural language attribution statements explaining the primary contributing factors.
4. **IoT Sensor Fleet Telemetry (`/sensors`):** 48 in-situ stations monitoring soil moisture (VWC %), cumulative rainfall, tilt angle, pore water pressure, and battery health with interactive modal charts.
5. **Emergency Alert Center (`/alerts`):** Multi-channel notification delivery verification across SMS cell broadcast, push notifications, email, multilingual IVR telephony, and 130dB physical acoustic sirens.
6. **Citizen & Field Officer Reporting (`/incidents`):** Crowd-sourced incident submission portal with simulated photo evidence upload and a formal field officer verification pipeline.
7. **SOP Action Matrix (`/actions`):** Decision-support action checklists categorized by risk level, assigning specific operational protocols to BRO, Police, and SDMA.
8. **Disaster Analytics & Dossier Export (`/analytics`):** Historical trend charts, false-alarm rate auditing (11.8%), sensor uptime tracking (96.5%), and one-click PDF/CSV report generation.
9. **Role-Based Access Control (RBAC):** Distinct interfaces for Super Admin, District Administrator, Disaster Management Officer, Field Officer, Operator, and Citizen with instant 1-click profile switching.
10. **Offline-First PWA Operation:** Progressive Web App service worker with local cache storage and automatic background sync (`"7 events synchronized successfully"`).
11. **Google Maps Platform Integration:** Dual-engine GIS capability allowing live switching between **Tactical Leaflet Dark Matter** and **Google Maps (Terrain DEM, Satellite Hybrid, Roadmap)** with live vector polygons, sensor markers, and highway corridors. Configurable via `.env` or the in-app Settings modal.

---

## 5. The 3–5 Minute SIH Demonstration Flow

Judges can evaluate the complete end-to-end platform using the dedicated top simulation bar:

```
[ START LANDSLIDE SCENARIO ] ──► P1: Normal ──► P2: Rain+ ──► P3: Moisture+ ──► P4: Anomaly ──► P5: EXTREME ──► [ RESET ]
```

1. **Step 1: Baseline Command View (Phase 1)**
   - Open `http://127.0.0.1:8000/#/dashboard`.
   - Observe baseline environmental conditions: Zone NER-024 (Burtuk) displays **Risk = 28 (LOW)**, Rainfall = 18.2 mm, Soil Moisture = 42.0%.
2. **Step 2: Convective Monsoon Event Begins (Phase 2)**
   - Click `P2: Rain+`.
   - Rainfall surges to 52.4 mm/24h. Risk score escalates to **43 (MODERATE)**. Recommendation updates to: *"Increase sensor polling, inspect Burtuk drainage chutes."*
3. **Step 3: Soil Moisture Approaches Critical Saturation (Phase 3)**
   - Click `P3: Moisture+`.
   - Topsoil reaches 68.2% VWC, pore water pressure spikes to 24.5 kPa. Risk score increases to **61 (HIGH)**.
4. **Step 4: Sensor Tilt Anomaly Detected by Isolation Forest (Phase 4)**
   - Click `P4: Anomaly`.
   - Inclinometer S-001 registers rapid displacement rate. Isolation Forest model flags a pre-failure anomaly. Risk score reaches **72 (HIGH)**.
5. **Step 5: Critical Threshold Crossed & Multi-Channel Alert (Phase 5)**
   - Click `P5: EXTREME`.
   - Risk score jumps to **82 (EXTREME)**.
   - The top **Emergency Siren Alarm Banner** activates with flashing audio simulation!
   - Multi-channel notification delivery updates: SMS (4,850 Sent), Push (6,240 Sent), Email (34 Officials Contacted), IVR (Triggered), Acoustic Siren (130dB Active).
   - Automated SOP Recommendation generated: *"Initiate emergency traffic diversion on NH-10 via Burtuk bypass, alert DDMA, prepare evacuation protocols."*
6. **Step 6: Field Officer Verification & Retraining Feedback**
   - Click `Report Incident` or navigate to `/incidents`.
   - Review pending incident `INC-2026-001`, click `[ Field Verify & Feed AI ]`.
   - Observe ground-truth verification rate update on `/analytics`.
7. **Step 7: Reset**
   - Click `[ Reset ]` to restore baseline normal operations instantly.

---

## 6. Running Locally

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Modern web browser (Chrome, Edge, Firefox)

### Installation & Launch in 2 Steps:
```bash
# 1. Install required Python packages
python -m pip install -r backend/requirements.txt

# 2. Launch FastAPI Full-Stack Server
python backend/main.py
```

Open your browser and navigate to:
```
http://127.0.0.1:8000
```
*All 16 routes, GIS maps, WebSockets, APIs, and simulation controls are active out-of-the-box on port 8000.*

---

## 7. Docker Deployment

To launch the complete containerized stack (FastAPI Backend + PostgreSQL / PostGIS Spatial Database + Redis + Nginx Reverse Proxy):

```bash
cd infrastructure/docker
docker-compose up -d --build
```
Access the application through the Nginx reverse proxy at `http://localhost`.

---

## 8. Team Geo X & SIH 2026 Attribution

- **Competition:** Smart India Hackathon 2026
- **Problem Statement:** SIH26001 – AI-Based Early Warning and Landslide Risk Monitoring System in NER
- **Theme:** Disaster Management
- **Team Name:** Geo X
- **Lead Contact:** team.geox@sih2026.gov.in
