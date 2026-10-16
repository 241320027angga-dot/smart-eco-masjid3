/*
  Smart Eco-Masjid — ESP32 sensor sender
  Kirim TDS, pH, flow dan status pompa ke:
  POST https://DOMAIN-ANDA/api/sensor

  Library:
  - WiFi (bawaan ESP32)
  - HTTPClient (bawaan ESP32)
*/

#include <WiFi.h>
#include <HTTPClient.h>

// ---------- WiFi & API ----------
const char* WIFI_SSID = "NAMA_WIFI";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";
const char* API_URL = "https://DOMAIN-ANDA/api/sensor";
const char* API_KEY = "GANTI_DENGAN_TOKEN_RAHASIA";
const char* DEVICE_ID = "ESP32-001";

// ---------- Pin sensor (SESUAIKAN DENGAN RANGKAIAN) ----------
const int TDS_PIN = 34;       // sensor TDS analog
const int PH_PIN = 35;        // sensor pH analog
const int FLOW_PIN = 27;      // flow meter pulse
const int PUMP_PIN = 26;      // relay pompa, opsional

volatile unsigned long flowPulses = 0;
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000; // 5 detik

void IRAM_ATTR onFlowPulse() {
  flowPulses++;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(300);
  }
}

float readTDS() {
  // PLACEHOLDER KALIBRASI:
  // Ganti rumus ini dengan rumus/kalibrasi sensor TDS yang dipakai kakak kelas.
  int raw = analogRead(TDS_PIN);
  float voltage = raw * (3.3f / 4095.0f);
  return voltage * 1000.0f; // hanya nilai awal untuk integrasi
}

float readPH() {
  // PLACEHOLDER KALIBRASI:
  // pH sensor harus dikalibrasi memakai larutan buffer.
  int raw = analogRead(PH_PIN);
  float voltage = raw * (3.3f / 4095.0f);

  // Contoh linear kasar. JANGAN dianggap sebagai kalibrasi final.
  return 7.0f + (2.50f - voltage) * 3.0f;
}

float readFlowRate() {
  noInterrupts();
  unsigned long pulses = flowPulses;
  flowPulses = 0;
  interrupts();

  // PLACEHOLDER:
  // Sesuaikan PULSES_PER_LITER dengan datasheet/hasil kalibrasi flow meter.
  const float PULSES_PER_LITER = 450.0f;
  const float elapsedMinutes = SEND_INTERVAL / 60000.0f;
  float liters = pulses / PULSES_PER_LITER;

  return elapsedMinutes > 0 ? liters / elapsedMinutes : 0;
}

String jsonNumber(float value, int decimals = 2) {
  return String(value, decimals);
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  float tds = readTDS();
  float ph = readPH();
  float flow = readFlowRate();

  // Jika relay aktif-HIGH, sesuaikan logika ini.
  bool pumpOn = digitalRead(PUMP_PIN) == HIGH;

  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"tds\":" + jsonNumber(tds, 2) + ",";
  payload += "\"ph\":" + jsonNumber(ph, 2) + ",";
  payload += "\"flow_rate\":" + jsonNumber(flow, 2) + ",";
  payload += "\"pump_status\":\"" + String(pumpOn ? "ON" : "OFF") + "\",";
  payload += "\"esp32_status\":\"online\"";
  payload += "}";

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);

  int code = http.POST(payload);
  Serial.print("POST sensor HTTP ");
  Serial.println(code);

  if (code > 0) {
    Serial.println(http.getString());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);

  pinMode(TDS_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  pinMode(FLOW_PIN, INPUT_PULLUP);
  pinMode(PUMP_PIN, INPUT);

  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), onFlowPulse, RISING);

  connectWiFi();
  Serial.println(WiFi.localIP());
}

void loop() {
  if (millis() - lastSend >= SEND_INTERVAL) {
    lastSend = millis();
    sendSensorData();
  }
}
