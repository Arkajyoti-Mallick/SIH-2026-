"""
Feature Engineering and Antecedent Precipitation Index (API) for LandslideX
"""

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "rainfall_intensity_mmh",
    "rainfall_24h_mm",
    "rainfall_72h_mm",
    "antecedent_precip_index",
    "soil_moisture_vwc",
    "pore_water_pressure_kpa",
    "slope_deg",
    "elevation_m",
    "lithology_weakness",
    "historical_density",
    "distance_to_road_cut_m",
    "distance_to_drainage_m",
    "sensor_anomaly_score"
]

def calculate_antecedent_precipitation_index(daily_rainfall_list, decay_factor=0.85):
    """
    Computes Antecedent Precipitation Index (API):
    API_t = sum_{i=1}^N (k^i * P_{t-i})
    Standard hydrologic decay model for soil saturation retention.
    """
    api = 0.0
    for i, rain in enumerate(daily_rainfall_list, start=1):
        api += (decay_factor ** i) * float(rain)
    return round(api, 2)

def calculate_factor_of_safety_proxy(slope_deg, soil_moisture_vwc, pore_pressure_kpa, lithology_weakness=3):
    """
    Simplified geotechnical safety factor (FS) proxy:
    FS > 1.25 : Stable
    1.0 <= FS <= 1.25 : Marginally Stable / High Risk
    FS < 1.0 : Critical Failure Impending
    """
    slope_rad = np.radians(slope_deg)
    phi_eff_deg = 35.0 - (lithology_weakness * 3.0)
    phi_eff_rad = np.radians(max(15.0, phi_eff_deg))
    
    cohesion_eff = max(5.0, 22.0 - (lithology_weakness * 3.0) - (soil_moisture_vwc * 0.15))
    normal_stress = 35.0 * np.cos(slope_rad)
    effective_normal_stress = max(2.0, normal_stress - pore_pressure_kpa)
    
    shear_strength = cohesion_eff + effective_normal_stress * np.tan(phi_eff_rad)
    shear_stress = 35.0 * np.sin(slope_rad)
    
    fs = shear_strength / max(0.1, shear_stress)
    return round(float(fs), 2)
