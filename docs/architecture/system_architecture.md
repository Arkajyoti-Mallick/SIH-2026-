# LandSlideX System Architecture & Geospatial Data Flow
**Smart India Hackathon 2026 | Problem Statement: SIH26001 | Disaster Management | Team: Geo X**

## 1. High-Level Ingestion & Early Warning Architecture

```
                                [ MULTI-SOURCE INGESTION LAYER ]
   +--------------------+  +--------------------+  +--------------------+  +--------------------+
   |  IoT In-situ Nodes |  |   IMD / Weather    |  |  Satellite / DEM   |  | Citizen / Officer  |
   | (Moisture/Tilt/Rain)|  | (Rainfall 24h/API) |  | (Slope/Elevation)  |  |  (Geo-tagged Pics) |
   +---------+----------+  +---------+----------+  +---------+----------+  +---------+----------+
             |                       |                       |                       |
             +-----------------------+-----------+-----------+-----------------------+
                                                 |
                                                 v
                                   [ VALIDATION & PIPELINE ]
                                   (Pydantic / Cleansing / API)
                                                 |
                                                 v
                             [ ML RISK ENGINE & ANOMALY DETECTOR ]
                    +-------------------------------------------------+
                    | 1. Random Forest / Gradient Boosting Classifier |
                    | 2. Isolation Forest Sensor Anomaly Detector     |
                    | 3. Antecedent Precipitation Index (API) Decay   |
                    +-------------------------------------------------+
                                                 |
                                                 v
                                    [ UNIFIED RISK SCORING ]
                             Risk: 0-100 | Confidence % | Trend
                                                 |
                   +-----------------------------+-----------------------------+
                   |                                                           |
                   v                                                           v
      [ RECOMMENDATION MATRIX ]                                   [ MULTI-CHANNEL DISPATCH ]
  (Standard Operating Procedures)                             (SMS, Push, IVR, Siren, Email)
                   |                                                           |
                   +-----------------------------+-----------------------------+
                                                 |
                                                 v
                             [ REAL-TIME WEBSOCKET & REST API ]
                                  (FastAPI Backend Server)
                                                 |
                   +-----------------------------+-----------------------------+
                   |                                                           |
                   v                                                           v
      [ GIS COMMAND CENTER ]                                      [ FIELD OFFICER PWA ]
  (Leaflet, Heatmaps, Analytics)                              (Offline-first, Verify & Sync)
                   |                                                           |
                   +-----------------------------+-----------------------------+
                                                 |
                                                 v
                                    [ HUMAN-IN-THE-LOOP FEEDBACK ]
                              (Confirm / Reject / Model Retrain Queue)
```

## 2. Geotechnical Stability Proxy & Safety Factor Formulation

The infinite slope stability model proxy implemented in LandSlideX computes the factor of safety ($FS$):

$$FS = \frac{c' + (\sigma_n - u) \tan\phi'}{\tau}$$

Where:
- $c'$: Effective soil cohesion (attenuated by volumetric water content $VWC$)
- $\sigma_n$: Normal stress due to soil mass above failure plane ($35 \cdot \cos\theta$)
- $u$: Pore water pressure ($kPa$) recorded by piezometers
- $\phi'$: Effective internal friction angle of weathered Himalayan schist/phyllite ($26^\circ - 35^\circ$)
- $\tau$: Downslope driving shear stress ($35 \cdot \sin\theta$)

When $FS < 1.0$, gravitational driving shear stress exceeds resisting shear strength, signaling imminent slope movement.

## 3. Real-Time Communication Protocols
- **Sensors to Gateway**: RS485 Modbus RTU at 9600 baud, buffered into LoRaWAN packets (868 MHz).
- **Gateway to Cloud**: MQTT over TLS to port 8883 / 1883 with JSON payload schema.
- **Backend to Dashboard**: Persistent WebSockets (`/ws/dashboard`, `/ws/telemetry`, `/ws/alerts`) with heartbeat ping-pong.
