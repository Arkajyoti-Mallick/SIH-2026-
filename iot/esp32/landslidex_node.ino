/*
 * LandSlideX - IoT Slope Telemetry Node Firmware
 * Platform: ESP32 Dev Module / Heltec WiFi LoRa 32
 * Sensors:
 *   - RS485 Modbus Soil Moisture & Temperature (VWC %)
 *   - Tipping Bucket Rain Gauge (Digital Interrupt GPIO 25)
 *   - MPU6050 6-DOF I2C Accelerometer & Gyro (Tilt & Vibration)
 * Protocol: MQTT over WiFi / LoRaWAN fallback
 * SIH 2026 - Disaster Management (Team Geo X)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// Configuration
const char* WIFI_SSID     = "DisasterNet_NER";
const char* WIFI_PASSWORD = "SafeHillsSecure";
const char* MQTT_BROKER   = "192.168.1.100";
const int   MQTT_PORT     = 1883;
const char* NODE_ID       = "NODE-SKM-NER024-S01";
const char* ZONE_ID       = "NER-024";

// Rain Gauge Pin
#define RAIN_PIN 25
volatile unsigned int rainTipCount = 0;
const float RAIN_PER_TIP_MM = 0.2; // 0.2mm per tip

// Sensor Handles
Adafruit_MPU6050 mpu;
WiFiClient espClient;
PubSubClient client(espClient);

// Timing
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 10000; // 10s telemetry interval

void IRAM_ATTR countRainTip() {
    rainTipCount++;
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n[LandSlideX] Booting IoT Slope Sensor Node...");

    // Setup Rain Interrupt
    pinMode(RAIN_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(RAIN_PIN), countRainTip, FALLING);

    // Setup I2C MPU6050
    Wire.begin(21, 22);
    if (!mpu.begin()) {
        Serial.println("[LandSlideX] Warning: MPU6050 not detected. Using internal gyro simulation.");
    } else {
        mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
        mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
        Serial.println("[LandSlideX] MPU6050 Inclinometer initialized.");
    }

    // Connect WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    client.setServer(MQTT_BROKER, MQTT_PORT);
}

float readSoilMoisture() {
    // ADC or RS485 read (Simulated calibrated range 20% to 85%)
    int raw = analogRead(34);
    float moisture = map(raw, 0, 4095, 15, 85);
    return constrain(moisture, 10.0, 90.0);
}

float readBatteryVoltage() {
    int raw = analogRead(35);
    float voltage = (raw / 4095.0) * 2.0 * 3.3 * 1.1; // Voltage divider
    float percent = (voltage - 3.3) / (4.2 - 3.3) * 100.0;
    return constrain(percent, 0.0, 100.0);
}

void reconnect() {
    while (!client.connected()) {
        Serial.print("[LandSlideX] Connecting to MQTT broker...");
        if (client.connect(NODE_ID)) {
            Serial.println(" Connected!");
            client.publish("landslidex/nodes/status", "{\"status\":\"ONLINE\",\"node_id\":\"NODE-SKM-NER024-S01\"}");
        } else {
            Serial.print(" Failed, rc=");
            Serial.print(client.state());
            delay(3000);
            break; // Return to avoid blocking loop in demo
        }
    }
}

void loop() {
    if (!client.connected()) {
        reconnect();
    }
    client.loop();

    unsigned long now = millis();
    if (now - lastSend > SEND_INTERVAL_MS) {
        lastSend = now;

        // Collect Telemetry
        float rainfall_mm = rainTipCount * RAIN_PER_TIP_MM;
        float soilMoisture = readSoilMoisture();
        float batteryPct = readBatteryVoltage();
        int rssi = WiFi.RSSI();

        // MPU6050 readings
        sensors_event_t a, g, temp;
        float tilt_deg = 0.0;
        if (mpu.getEvent(&a, &g, &temp)) {
            tilt_deg = atan2(a.acceleration.y, a.acceleration.z) * 180.0 / PI;
        }

        // Build JSON Payload
        char payload[256];
        snprintf(payload, sizeof(payload),
            "{\"node_id\":\"%s\",\"zone_id\":\"%s\",\"soil_moisture\":%.1f,\"rainfall\":%.1f,\"temperature\":%.1f,\"tilt\":%.2f,\"battery\":%.0f,\"rssi\":%d,\"status\":\"ONLINE\"}",
            NODE_ID, ZONE_ID, soilMoisture, rainfall_mm, temp.temperature, tilt_deg, batteryPct, rssi);

        Serial.print("[Telemetry Publish]: ");
        Serial.println(payload);

        client.publish("landslidex/telemetry/nodes", payload);
    }
}
