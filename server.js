require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable express.json() middleware
app.use(express.json());

// MongoDB connection management (designed for serverless reuse)
let client = null;
let db = null;

async function getDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in the environment variables.');
  }
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB Atlas');
  }
  db = client.db();
  return db;
}

// Middleware to attach MongoDB db instance to req object
app.use(async (req, res, next) => {
  try {
    req.db = await getDb();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ error: 'Database connection failure' });
  }
});

// Helper to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Helper to find a vehicle by numeric ID, registration number, device ID, or formatted string (e.g. v-01)
async function findVehicle(idOrStr, db) {
  if (!idOrStr) return null;
  const normalized = idOrStr.trim();
  const vehiclesCollection = db.collection('vehicles');

  const queryConditions = [];

  // Try matching numeric ID directly
  const numericId = parseInt(normalized, 10);
  if (!isNaN(numericId) && String(numericId) === normalized) {
    queryConditions.push({ id: numericId });
  }

  // Try matching formatted ID: v-XX
  if (normalized.toLowerCase().startsWith('v-')) {
    const parsedId = parseInt(normalized.substring(2), 10);
    if (!isNaN(parsedId)) {
      queryConditions.push({ id: parsedId });
    }
  }

  // Exact case-insensitive match for register_number, registration_number, device_id
  const caseInsensitiveRegex = { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') };
  queryConditions.push({ register_number: caseInsensitiveRegex });
  queryConditions.push({ registration_number: caseInsensitiveRegex });
  queryConditions.push({ device_id: caseInsensitiveRegex });

  return await vehiclesCollection.findOne({ $or: queryConditions });
}

// Helper to find a province by numeric ID or name (case-insensitive)
async function findProvince(idOrName, db) {
  if (!idOrName) return null;
  const normalized = idOrName.trim();
  const provincesCollection = db.collection('provinces');

  const queryConditions = [];
  const numericId = parseInt(normalized, 10);
  if (!isNaN(numericId) && String(numericId) === normalized) {
    queryConditions.push({ id: numericId });
  }

  const caseInsensitiveRegex = { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') };
  queryConditions.push({ name: caseInsensitiveRegex });

  return await provincesCollection.findOne({ $or: queryConditions });
}

// Helper to find a district by numeric ID or name (case-insensitive)
async function findDistrict(idOrName, db) {
  if (!idOrName) return null;
  const normalized = idOrName.trim();
  const districtsCollection = db.collection('districts');

  const queryConditions = [];
  const numericId = parseInt(normalized, 10);
  if (!isNaN(numericId) && String(numericId) === normalized) {
    queryConditions.push({ id: numericId });
  }

  const caseInsensitiveRegex = { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') };
  queryConditions.push({ name: caseInsensitiveRegex });

  return await districtsCollection.findOne({ $or: queryConditions });
}

// Helper to find a station by numeric ID or name (case-insensitive)
async function findStation(idOrName, db) {
  if (!idOrName) return null;
  const normalized = idOrName.trim();
  const stationsCollection = db.collection('stations');

  const queryConditions = [];
  const numericId = parseInt(normalized, 10);
  if (!isNaN(numericId) && String(numericId) === normalized) {
    queryConditions.push({ id: numericId });
  }

  const caseInsensitiveRegex = { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') };
  queryConditions.push({ name: caseInsensitiveRegex });

  return await stationsCollection.findOne({ $or: queryConditions });
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
app.get('/provinces', async (req, res) => {
  try {
    const provinces = await req.db.collection('provinces').find().toArray();
    const mapped = provinces.map(p => ({
      province_id: p.id,
      name: p.name
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching provinces:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /provinces/:id - Retrieve a specific province by id
app.get('/provinces/:id', async (req, res) => {
  try {
    const province = await findProvince(req.params.id, req.db);
    if (!province) {
      return res.status(404).json({ error: 'Province not found' });
    }
    res.json({
      province_id: province.id,
      name: province.name
    });
  } catch (err) {
    console.error('Error fetching province:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /districts - Retrieve all districts
app.get('/districts', async (req, res) => {
  try {
    const districts = await req.db.collection('districts').find().toArray();
    const mapped = districts.map(d => ({
      district_id: d.id,
      name: d.name,
      province_id: d.province_id
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching districts:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /districts/:id - Retrieve a specific district by id
app.get('/districts/:id', async (req, res) => {
  try {
    const district = await findDistrict(req.params.id, req.db);
    if (!district) {
      return res.status(404).json({ error: 'District not found' });
    }
    res.json({
      district_id: district.id,
      name: district.name,
      province_id: district.province_id
    });
  } catch (err) {
    console.error('Error fetching district:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /stations - Retrieve all stations
app.get('/stations', async (req, res) => {
  try {
    const stations = await req.db.collection('stations').find().toArray();
    const mapped = stations.map(s => ({
      station_id: s.id,
      name: s.name,
      district_id: s.district_id
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching stations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /stations/:id - Retrieve a specific station by id
app.get('/stations/:id', async (req, res) => {
  try {
    const station = await findStation(req.params.id, req.db);
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    res.json({
      station_id: station.id,
      name: station.name,
      district_id: station.district_id
    });
  } catch (err) {
    console.error('Error fetching station:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles - Retrieve all vehicles
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await req.db.collection('vehicles').find().toArray();
    const mapped = vehicles.map(v => ({
      vehicle_id: v.id,
      reg_number: v.register_number || v.registration_number,
      device_id: v.device_id,
      station_id: v.station_id
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching vehicles:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles/:vehicleId - Retrieve a specific vehicle by vehicleId (with last_ping composite)
app.get('/vehicles/:vehicleId', async (req, res) => {
  try {
    const vehicle = await findVehicle(req.params.vehicleId, req.db);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const id = vehicle.id;

    // Find last_ping: query pings for vehicle, sort by timestamp descending, take the first one
    const lastPingDoc = await req.db.collection('pings').findOne(
      { vehicle_id: id },
      { sort: { timestamp: -1 } }
    );

    let lastPing = null;
    if (lastPingDoc) {
      lastPing = {
        ping_id: lastPingDoc.id,
        vehicle_id: lastPingDoc.vehicle_id,
        timestamp: lastPingDoc.timestamp,
        lat: lastPingDoc.latitude,
        lng: lastPingDoc.longitude,
        speed: lastPingDoc.speed !== undefined ? lastPingDoc.speed : 0
      };
    }

    res.json({
      vehicle_id: vehicle.id,
      reg_number: vehicle.register_number || vehicle.registration_number,
      device_id: vehicle.device_id,
      station_id: vehicle.station_id,
      last_ping: lastPing
    });
  } catch (err) {
    console.error('Error fetching vehicle details:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles/:id/pings - Retrieve pings for a specific vehicle by id
app.get('/vehicles/:id/pings', async (req, res) => {
  try {
    const vehicle = await findVehicle(req.params.id, req.db);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const id = vehicle.id;

    const vehiclePings = await req.db.collection('pings')
      .find({ vehicle_id: id })
      .toArray();

    const mapped = vehiclePings.map(p => ({
      ping_id: p.id,
      vehicle_id: p.vehicle_id,
      timestamp: p.timestamp,
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed !== undefined ? p.speed : 0
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching vehicle pings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles/:id/last-position - Retrieve most recent position only (no vehicle metadata)
app.get('/vehicles/:id/last-position', async (req, res) => {
  try {
    const vehicle = await findVehicle(req.params.id, req.db);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const id = vehicle.id;

    const lp = await req.db.collection('pings').findOne(
      { vehicle_id: id },
      { sort: { timestamp: -1 } }
    );

    if (!lp) {
      return res.status(404).json({ error: 'No pings found for this vehicle' });
    }

    res.json({
      vehicle_id: lp.vehicle_id,
      timestamp: lp.timestamp,
      lat: lp.latitude,
      lng: lp.longitude,
      speed: lp.speed !== undefined ? lp.speed : 0
    });
  } catch (err) {
    console.error('Error fetching last position:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /vehicles/:vehicleId/pings - Create a new telemetry ping for a vehicle
app.post('/vehicles/:vehicleId/pings', async (req, res) => {
  try {
    // 1. Require X-API-Key header. 401 if header is absent
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is missing' });
    }

    // 2. Parse and find vehicle
    const vehicle = await findVehicle(req.params.vehicleId, req.db);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const numericId = vehicle.id;

    // 4. expected key is dev-[vehicleId]-secret based on the request parameter
    const expectedKey = `dev-${req.params.vehicleId}-secret`;
    if (apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 5. 400 if body missing lat, lng, or speed
    const { lat, lng, speed } = req.body;
    if (lat === undefined || lat === null ||
        lng === undefined || lng === null ||
        speed === undefined || speed === null) {
      return res.status(400).json({ error: 'Missing lat, lng, or speed' });
    }

    // Determine the next ping ID
    const maxPing = await req.db.collection('pings').findOne({}, { sort: { id: -1 } });
    const newPingId = maxPing ? maxPing.id + 1 : 1;

    // 6. Server sets timestamp: new Date().toISOString()
    const newPing = {
      id: newPingId,
      vehicle_id: numericId,
      latitude: lat,
      longitude: lng,
      speed: speed,
      timestamp: new Date().toISOString()
    };

    // 7. Push ping to collection
    await req.db.collection('pings').insertOne(newPing);

    // 8. Set up response payload matching the required wire contrast shape
    const responsePayload = {
      ping_id: `PNG-${newPingId}`,
      vehicle_id: req.params.vehicleId,
      lat: lat,
      lng: lng,
      speed: speed
    };

    // 9. Set Location header: /vehicles/:vehicleId/pings/PNG-:pingId
    res.set('Location', `/vehicles/${req.params.vehicleId}/pings/PNG-${newPingId}`);

    // 10. Set ETag and Last-Modified headers
    const lastModified = new Date(newPing.timestamp).toUTCString();
    res.set('Last-Modified', lastModified);

    const etag = '"' + crypto.createHash('md5').update(JSON.stringify(responsePayload)).digest('hex') + '"';
    res.set('ETag', etag);

    // 11. Return 201 Created
    return res.status(201).json(responsePayload);
  } catch (err) {
    console.error('Error creating telemetry ping:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
