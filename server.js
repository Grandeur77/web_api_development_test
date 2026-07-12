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

// Helper to find a vehicle by numeric ID, registration number, device ID, or formatted string (e.g. v-01)
function findVehicle(idOrStr) {
  if (!idOrStr) return null;
  const normalized = idOrStr.trim().toLowerCase();

  // Try matching registration_number exactly
  const foundByReg = data.vehicles.find(v => v.registration_number.toLowerCase() === normalized);
  if (foundByReg) return foundByReg;

  // Try matching device_id exactly
  const foundByDevice = data.vehicles.find(v => v.device_id.toLowerCase() === normalized);
  if (foundByDevice) return foundByDevice;

  // Try matching formatted ID: v-XX
  if (normalized.startsWith('v-')) {
    const parsedId = parseInt(normalized.substring(2), 10);
    if (!isNaN(parsedId)) {
      const found = data.vehicles.find(v => v.id === parsedId);
      if (found) return found;
    }
  }

  // Try matching numeric ID
  const numericId = parseInt(idOrStr, 10);
  if (!isNaN(numericId)) {
    const found = data.vehicles.find(v => v.id === numericId);
    if (found) return found;
  }

  return null;
}



// Helper to find a province by numeric ID or name (case-insensitive)
function findProvince(idOrName) {
  if (!idOrName) return null;
  const normalized = idOrName.trim().toLowerCase();
  const foundByName = data.provinces.find(p => p.name.toLowerCase() === normalized);
  if (foundByName) return foundByName;

  const numericId = parseInt(idOrName, 10);
  if (!isNaN(numericId)) {
    return data.provinces.find(p => p.id === numericId);
  }
  return null;
}

// Helper to find a district by numeric ID or name (case-insensitive)
function findDistrict(idOrName) {
  if (!idOrName) return null;
  const normalized = idOrName.trim().toLowerCase();
  const foundByName = data.districts.find(d => d.name.toLowerCase() === normalized);
  if (foundByName) return foundByName;

  const numericId = parseInt(idOrName, 10);
  if (!isNaN(numericId)) {
    return data.districts.find(d => d.id === numericId);
  }
  return null;
}

// Helper to find a station by numeric ID or name (case-insensitive)
function findStation(idOrName) {
  if (!idOrName) return null;
  const normalized = idOrName.trim().toLowerCase();
  const foundByName = data.stations.find(s => s.name.toLowerCase() === normalized);
  if (foundByName) return foundByName;

  const numericId = parseInt(idOrName, 10);
  if (!isNaN(numericId)) {
    return data.stations.find(s => s.id === numericId);
  }
  return null;
}

// Root route returning status and session
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    session: 'N86007CEM S2'
  });
});

// Handle favicon requests to prevent 404 errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

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
  const province = findProvince(req.params.id);
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
  const district = findDistrict(req.params.id);
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
  const station = findStation(req.params.id);
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
  const vehicle = findVehicle(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const id = vehicle.id;

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
  const vehicle = findVehicle(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const id = vehicle.id;
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
  const vehicle = findVehicle(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const id = vehicle.id;

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

  // 2. Parse and find vehicle
  const vehicle = findVehicle(req.params.vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const numericId = vehicle.id;

  // 4. expected key is key_vXX based on the formatted vehicle id
  const expectedKey = `key_v${String(numericId).padStart(2, '0')}`;
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
  res.set('Location', `/vehicles/${req.params.vehicleId}/pings/${newPing.id}`);

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
