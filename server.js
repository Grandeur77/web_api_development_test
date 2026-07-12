const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable express.json() middleware
app.use(express.json());

// Load seed.json into memory at startup
const data = require('./seed.json');


// Root route returning status and session
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    session: 'N86007CEM S2'
  });
});

// GET /provinces - Retrieve all provinces
app.get('/provinces', (req, res) => {
  const mapped = data.provinces.map(p => ({
    province_id: p.id,
    name: p.name
  }));
  res.json(mapped);
});

// GET /provinces/:id - Retrieve a specific province by id
app.get('/provinces/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const province = data.provinces.find(p => p.id === id);
  if (!province) {
    return res.status(404).json({ error: 'Province not found' });
  }
  res.json({
    province_id: province.id,
    name: province.name
  });
});

// GET /districts - Retrieve all districts
app.get('/districts', (req, res) => {
  const mapped = data.districts.map(d => ({
    district_id: d.id,
    name: d.name,
    province_id: d.province_id
  }));
  res.json(mapped);
});

// GET /districts/:id - Retrieve a specific district by id
app.get('/districts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const district = data.districts.find(d => d.id === id);
  if (!district) {
    return res.status(404).json({ error: 'District not found' });
  }
  res.json({
    district_id: district.id,
    name: district.name,
    province_id: district.province_id
  });
});

// GET /stations - Retrieve all stations
app.get('/stations', (req, res) => {
  const mapped = data.stations.map(s => ({
    station_id: s.id,
    name: s.name,
    district_id: s.district_id
  }));
  res.json(mapped);
});

// GET /stations/:id - Retrieve a specific station by id
app.get('/stations/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const station = data.stations.find(s => s.id === id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  res.json({
    station_id: station.id,
    name: station.name,
    district_id: station.district_id
  });
});

// GET /vehicles - Retrieve all vehicles
app.get('/vehicles', (req, res) => {
  const mapped = data.vehicles.map(v => ({
    vehicle_id: v.id,
    reg_number: v.registration_number,
    device_id: v.device_id,
    station_id: v.station_id
  }));
  res.json(mapped);
});

// GET /vehicles/:id - Retrieve a specific vehicle by id (with last_ping composite)
app.get('/vehicles/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const vehicle = data.vehicles.find(v => v.id === id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  // Find last_ping: filter pings where vehicle_id matches, sort by timestamp descending, take [0]
  const vehiclePings = data.pings.filter(p => p.vehicle_id === id);
  let lastPing = null;
  if (vehiclePings.length > 0) {
    vehiclePings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lp = vehiclePings[0];
    lastPing = {
      ping_id: lp.id,
      vehicle_id: lp.vehicle_id,
      timestamp: lp.timestamp,
      lat: lp.latitude,
      lng: lp.longitude,
      speed: lp.speed !== undefined ? lp.speed : 0
    };
  }

  res.json({
    vehicle_id: vehicle.id,
    reg_number: vehicle.registration_number,
    device_id: vehicle.device_id,
    station_id: vehicle.station_id,
    last_ping: lastPing
  });
});

// GET /vehicles/:id/pings - Retrieve pings for a specific vehicle by id
app.get('/vehicles/:id/pings', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const vehicle = data.vehicles.find(v => v.id === id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const vehiclePings = data.pings
    .filter(p => p.vehicle_id === id)
    .map(p => ({
      ping_id: p.id,
      vehicle_id: p.vehicle_id,
      timestamp: p.timestamp,
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed !== undefined ? p.speed : 0
    }));
  res.json(vehiclePings);
});

// GET /vehicles/:id/last-position - Retrieve most recent position only (no vehicle metadata)
app.get('/vehicles/:id/last-position', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const vehicle = data.vehicles.find(v => v.id === id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  const vehiclePings = data.pings.filter(p => p.vehicle_id === id);
  if (vehiclePings.length === 0) {
    return res.status(404).json({ error: 'No pings found for this vehicle' });
  }

  // Sort by timestamp descending
  vehiclePings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const lp = vehiclePings[0];

  res.json({
    vehicle_id: lp.vehicle_id,
    timestamp: lp.timestamp,
    lat: lp.latitude,
    lng: lp.longitude,
    speed: lp.speed !== undefined ? lp.speed : 0
  });
});

// POST /vehicles/:vehicleId/pings - Create a new telemetry ping for a vehicle
app.post('/vehicles/:vehicleId/pings', (req, res) => {
  // 1. Require X-API-Key header. 401 if header is absent
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is missing' });
  }

  // 2. Parse vehicleId
  const vehicleId = req.params.vehicleId;
  let numericId = null;
  if (vehicleId.startsWith('v-')) {
    numericId = parseInt(vehicleId.substring(2), 10);
  } else {
    numericId = parseInt(vehicleId, 10);
  }

  // 3. 404 if vehicleId not in vehicles array
  const vehicle = data.vehicles.find(v => v.id === numericId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  // 4. Build deviceKeys = { "v-01": "key_v01", "v-02": "key_v02", ... }
  // 403 if key does not match deviceKeys[vehicleId]
  const deviceKeys = {};
  data.vehicles.forEach(v => {
    const formattedId = `v-${String(v.id).padStart(2, '0')}`;
    const key = `key_v${String(v.id).padStart(2, '0')}`;
    deviceKeys[formattedId] = key;
    deviceKeys[String(v.id)] = key;
  });

  const expectedKey = deviceKeys[vehicleId];
  if (apiKey !== expectedKey) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 5. 400 if body missing latitude, longitude, or speed
  const { latitude, longitude, speed } = req.body;
  if (latitude === undefined || latitude === null ||
      longitude === undefined || longitude === null ||
      speed === undefined || speed === null) {
    return res.status(400).json({ error: 'Missing latitude, longitude, or speed' });
  }

  // 6. Server sets timestamp: new Date().toISOString()
  const newPingId = data.pings.length > 0 ? Math.max(...data.pings.map(p => p.id)) + 1 : 1;
  const newPing = {
    id: newPingId,
    vehicle_id: numericId,
    latitude,
    longitude,
    speed,
    timestamp: new Date().toISOString()
  };

  // 7. Push ping to array
  data.pings.push(newPing);

  // 8. Set Location header: /vehicles/:vehicleId/pings/:pingId
  res.set('Location', `/vehicles/${vehicleId}/pings/${newPing.id}`);

  // 9. Set ETag and Last-Modified headers
  const lastModified = new Date(newPing.timestamp).toUTCString();
  res.set('Last-Modified', lastModified);

  const etag = '"' + crypto.createHash('md5').update(JSON.stringify(newPing)).digest('hex') + '"';
  res.set('ETag', etag);

  // 10. Return 201 Created
  return res.status(201).json(newPing);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
