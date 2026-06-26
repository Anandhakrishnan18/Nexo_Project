require("dotenv").config({ path: "../.env" });
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("No MONGO_URI found in environment variables.");
  process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
  try {
    console.log("Attempting direct connection to MongoDB via Node.js Driver...");
    await client.connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");
    
    // Optional: List databases
    const databasesList = await client.db().admin().listDatabases();
    console.log("Databases on cluster:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
    
  } catch (error) {
    console.error("❌ Connection failed!");
    console.error("Name:", error.name);
    console.error("Message:", error.message);
    if (error.code) console.error("Code:", error.code);
    console.error("Stack:", error.stack);
  } finally {
    await client.close();
  }
}

run();
