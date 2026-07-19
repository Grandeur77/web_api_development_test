require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

async function seedDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Successfully connected to MongoDB Atlas.');

    const db = client.db(); // Connects to the database specified in the URI (web_api_db)
    console.log(`Using database: ${db.databaseName}`);

    // Load seed.json
    console.log('Loading seed.json...');
    const seedFilePath = path.join(__dirname, 'seed.json');
    if (!fs.existsSync(seedFilePath)) {
      throw new Error(`seed.json file not found at ${seedFilePath}`);
    }
    const rawData = fs.readFileSync(seedFilePath, 'utf8');
    const data = JSON.parse(rawData);

    const collections = ['provinces', 'districts', 'stations', 'vehicles', 'pings'];

    for (const key of collections) {
      const items = data[key];
      if (!items || !Array.isArray(items)) {
        console.log(`Skipping key "${key}" as it is not present or not an array in seed.json.`);
        continue;
      }

      console.log(`\nProcessing collection: "${key}" (${items.length} items)...`);
      const collection = db.collection(key);

      // Drop existing collection if it exists
      try {
        await collection.drop();
        console.log(`Dropped existing collection "${key}".`);
      } catch (err) {
        if (err.codeName === 'NamespaceNotFound') {
          console.log(`Collection "${key}" did not exist yet.`);
        } else {
          throw err;
        }
      }

      // Insert items in batches if needed
      if (items.length > 0) {
        const batchSize = 5000;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          await collection.insertMany(batch);
          console.log(`  Inserted batch: lines ${i} to ${Math.min(i + batchSize, items.length)}`);
        }
      }

      // Create indexes for efficient querying
      console.log(`Creating indexes for collection "${key}"...`);
      if (key === 'provinces') {
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ name: 1 });
      } else if (key === 'districts') {
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ name: 1 });
        await collection.createIndex({ province_id: 1 });
      } else if (key === 'stations') {
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ name: 1 });
        await collection.createIndex({ district_id: 1 });
      } else if (key === 'vehicles') {
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ register_number: 1 });
        await collection.createIndex({ registration_number: 1 });
        await collection.createIndex({ device_id: 1 });
        await collection.createIndex({ station_id: 1 });
      } else if (key === 'pings') {
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ vehicle_id: 1 });
        await collection.createIndex({ timestamp: -1 });
        // Compound index for finding the last ping for a vehicle quickly
        await collection.createIndex({ vehicle_id: 1, timestamp: -1 });
      }
      console.log(`Collection "${key}" seeded and indexed successfully.`);
    }

    console.log('\nSeeding completed successfully!');
  } catch (error) {
    console.error('An error occurred during database seeding:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

seedDatabase();
