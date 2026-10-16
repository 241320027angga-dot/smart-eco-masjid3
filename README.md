# Smart Eco-Masjid — versi tanpa registrasi jamaah + sensor ESP32

## Yang sudah diubah

- Pendaftaran/login jamaah dihilangkan dari alur utama.
- Jamaah langsung membuka Beranda dan dapat memakai Scan QR.
- Kamera QR tetap menggunakan `getUserMedia()` + jsQR.
- Check-in tetap bisa memakai mode lokal jika anonymous Supabase tidak tersedia.
- Jika Supabase tersedia, aplikasi mencoba anonymous auth tanpa meminta jamaah membuat akun.
- Dashboard pengelola mempunyai mode API ESP32.
- Polling data sensor diubah menjadi setiap 5 detik.
- Payload sensor mencakup TDS, pH, flow, status pompa, status ESP32 dan device ID.

## Struktur

- `public/index.html` — aplikasi web.
- `server.js` — API untuk menerima data ESP32.
- `schema.sql` — tabel Supabase.
- `.env.example` — konfigurasi server.
- `esp32_eco_masjid.ino` — contoh pengirim data dari ESP32.

## Menjalankan server

1. Buat tabel dengan `schema.sql` di Supabase SQL Editor.
2. Salin `.env.example` menjadi `.env`.
3. Isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `ESP32_API_KEY`.
4. `npm install`
5. `npm start`
6. Buka `http://localhost:3000`.

Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke frontend atau sketch ESP32.

## Menghubungkan dashboard

Masuk ke Pengelola → Monitoring → pilih `API ESP32`.

Jika frontend dan API disajikan oleh server yang sama, alamat API dapat diisi:

`http://localhost:3000`

Untuk deployment, gunakan domain HTTPS server Anda.

## Endpoint

### ESP32 → server

`POST /api/sensor`

Header:

`X-API-Key: TOKEN_RAHASIA`

JSON:

```json
{
  "device_id": "ESP32-001",
  "tds": 320,
  "ph": 6.8,
  "flow_rate": 4.2,
  "pump_status": "ON",
  "esp32_status": "online"
}
```

### Dashboard

- `GET /api/sensor/latest`
- `GET /api/sensor/history?limit=100`
- `GET /api/health`

## Catatan sensor

Nilai TDS dan pH di sketch adalah placeholder. Rumus final harus mengikuti tipe sensor dan hasil kalibrasi alat kakak kelas. Flow meter juga harus menggunakan nilai pulses-per-liter yang sesuai datasheet/kalibrasi.

Kamera browser membutuhkan HTTPS saat sudah online (localhost diperbolehkan saat development).
