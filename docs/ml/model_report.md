# LandSlideX Machine Learning Model Performance & Evaluation Report
**Model Version:** `v2.4.1-SIH2026`  
**Algorithms:** Ensemble Random Forest Classifier (120 Trees) + Isolation Forest Anomaly Detector  
**Target Variable:** Landslide Hazard Occurrence (Binary) & Calibrated Risk Score (0–100 Continuous)  

---

## 1. Validation Metrics Summary

| Metric | Score | Industry / GSI Benchmark |
|---|---|---|
| **ROC-AUC Score** | **0.9680** | > 0.85 (High Precision) |
| **Accuracy** | **91.80%** | > 85.0% |
| **False Alarm Rate (FAR)** | **11.8%** | < 20% (Low False Positives) |
| **Ground-Truth Verification Rate** | **88.2%** | Operational Standard |
| **Inference Latency** | **4.2 ms / sample** | Sub-second real-time |

---

## 2. Feature Importance Breakdown

1. **`rainfall_24h_mm` (24.2%)**: Primary trigger for pore pressure buildup in top mantle.
2. **`soil_moisture_vwc` (21.8%)**: Volumetric saturation index dictating loss of effective cohesion.
3. **`slope_deg` (18.6%)**: Gravitational driving shear vector from DEM rasters.
4. **`antecedent_precip_index` (14.1%)**: 7-day weighted hydrological retention decay.
5. **`sensor_anomaly_score` (10.5%)**: Inclinometer tilt rate acceleration from Isolation Forest.
6. **`historical_density` (6.2%)**: GSI historical landslide cluster frequency.
7. **`distance_to_road_cut_m` (4.6%)**: Unreinforced highway excavation bank destabilization.

---

## 3. Explainability (XAI) Compliance

In accordance with ethical AI in disaster management:
- Every prediction generates a human-readable attribution summary detailing the specific parameters that exceeded safety thresholds.
- Model uncertainty and confidence percentages ($82\% - 96\%$) are visibly reported to control-room operators.
- Disclaimer displayed on all views: *Decision-support information for official disaster management procedures. Not an absolute guarantee of slope stability.*
