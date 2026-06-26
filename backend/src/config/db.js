const mongoose = require("mongoose");
const dns = require("dns");

// Fix for Node.js v22 DNS SRV resolution issues (querySrv ECONNREFUSED)
// This forces Node's internal DNS resolver to use Google's public DNS servers
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    // Optionally append database name to URI if not present in env
    const uri = process.env.MONGO_URI; 
    
    await mongoose.connect(uri);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("====== DATABASE CONNECTION ERROR ======");
    console.error("Error Name:", error.name);
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    console.error("Full Error Object:", JSON.stringify(error, null, 2));
    console.error("Error Stack:", error.stack);
    console.error("=======================================");
    process.exit(1);
  }
};

module.exports = connectDB;