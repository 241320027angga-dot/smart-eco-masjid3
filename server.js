import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.ESP32_API_KEY || '';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: '16kb' }));

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function validatePayload(body) {
  const deviceId = String(body.device_id || '').trim();
  if (!deviceId || deviceId.length > 80) return 'device_id wajib diisi.';
  if (!finite(body.tds) || body.tds < 0 || body.tds > 5000) return 'tds harus 0–5000 ppm.';
  if (!finite(body.ph) || body.ph < 0 || body.ph > 14) return 'ph harus 0–14.';
  if (!finite(body.flow_rate) || body.flow_rate < 0 || body.flow_rate > 100) return 'flow_rate harus 0–100 L/mnt.';
  if (!['ON', 'OFF'].includes(body.pump_status)) return 'pump_status harus ON atau OFF.';
  if (!['online', 'offline'].includes(body.esp32_status)) return 'esp32_status harus online atau offline.';
  return null;
}

function checkDeviceKey(req, res, next) {
  if (!API_KEY) return res.status(503).json({ ok: false, error: 'ESP32_API_KEY belum dikonfigurasi di server.' });
  const supplied = req.get('X-API-Key') || '';
  if (supplied !== API_KEY) return res.status(401).json({ ok: false, error: 'API key tidak valid.' });
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'eco-jamaah-api', time: new Date().toISOString() });
});

app.post('/api/sensor', checkDeviceKey, async (req, res) => {
  const error = validatePayload(req.body || {});
  if (error) return res.status(400).json({ ok: false, error });

  const row = {
    device_id: String(req.body.device_id).trim(),
    tds: Number(req.body.tds),
    ph: Number(req.body.ph),
    flow_rate: Number(req.body.flow_rate),
    pump_status: req.body.pump_status,
    esp32_status: req.body.esp32_status,
    recorded_at: req.body.timestamp && !Number.isNaN(Date.parse(req.body.timestamp))
      ? new Date(req.body.timestamp).toISOString()
      : new Date().toISOString()
  };

  const { data, error: dbError } = await supabase
    .from('sensor_readings')
    .insert(row)
    .select()
    .single();

  if (dbError) {
    console.error(dbError);
    return res.status(500).json({ ok: false, error: 'Gagal menyimpan data sensor.' });
  }

  res.status(201).json({ ok: true, data });
});

app.get('/api/sensor/latest', async (_req, res) => {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('device_id,tds,ph,flow_rate,pump_status,esp32_status,recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: 'Gagal mengambil data sensor.' });
  }

  if (!data) {
    return res.json({
      device_id: null,
      tds: 0,
      ph: 0,
      flow_rate: 0,
      pump_status: 'OFF',
      esp32_status: 'offline',
      timestamp: null
    });
  }

  res.json({ ...data, timestamp: data.recorded_at });
});

app.get('/api/sensor/history', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('device_id,tds,ph,flow_rate,pump_status,esp32_status,recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: 'Gagal mengambil riwayat sensor.' });
  }

  res.json((data || []).reverse().map((r) => ({ ...r, timestamp: r.recorded_at })));
});

app.use(express.static('public'));

app.get('*', (_req, res) => res.sendFile('index.html', { root: 'public' }));

app.listen(PORT, () => {
  console.log(`Eco-Jamaah API berjalan di http://localhost:${PORT}`);
});
