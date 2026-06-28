const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Load seed.json into memory at startup
const seedPath = path.join(__dirname, 'seed.json');
let data = { provinces: [], districts: [], stations: [], vehicles: [], pings: [] };

try {
  const fileContent = fs.readFileSync(seedPath, 'utf8');
  data = JSON.parse(fileContent);
} catch (err) {
  console.error('Error loading seed.json:', err);
}

// Root route returning status and session
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    session: 'N86007CEM S2'
  });
});

// GET /provinces - Retrieve all provinces
app.get('/provinces', (req, res) => {
  res.json(data.provinces);
});

// GET /provinces/:provinceId - Retrieve a specific province
app.get('/provinces/:provinceId', (req, res) => {
  const provinceId = parseInt(req.params.provinceId, 10);
  const province = data.provinces.find(p => p.id === provinceId);
  if (!province) {
    return res.status(404).json({ error: 'Province not found' });
  }
  res.json(province);
});

// GET /districts - Retrieve all districts
app.get('/districts', (req, res) => {
  res.json(data.districts);
});

// GET /districts/:districtId - Retrieve a specific district
app.get('/districts/:districtId', (req, res) => {
  const districtId = parseInt(req.params.districtId, 10);
  const district = data.districts.find(d => d.id === districtId);
  if (!district) {
    return res.status(404).json({ error: 'District not found' });
  }
  res.json(district);
});

// GET /stations - Retrieve all stations
app.get('/stations', (req, res) => {
  res.json(data.stations);
});

// GET /stations/:stationId - Retrieve a specific station
app.get('/stations/:stationId', (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);
  const station = data.stations.find(s => s.id === stationId);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  res.json(station);
});

// GET /vehicles - Retrieve all vehicles
app.get('/vehicles', (req, res) => {
  res.json(data.vehicles);
});

// GET /vehicles/:vehicleId - Retrieve a specific vehicle
app.get('/vehicles/:vehicleId', (req, res) => {
  const vehicleId = parseInt(req.params.vehicleId, 10);
  const vehicle = data.vehicles.find(v => v.id === vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  res.json(vehicle);
});

// GET /vehicles/:vehicleId/pings - Retrieve pings for a specific vehicle
app.get('/vehicles/:vehicleId/pings', (req, res) => {
  const vehicleId = parseInt(req.params.vehicleId, 10);
  const vehicle = data.vehicles.find(v => v.id === vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const vehiclePings = data.pings.filter(p => p.vehicle_id === vehicleId);
  res.json(vehiclePings);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
