const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;

    // If local/dev and connection fails or explicit usage
    if (process.env.NODE_ENV === 'development' || process.env.USE_MEMORY_DB === 'true') {
      try {
        // Attempt to connect to provided URI first? 
        // Better: Try to start MEMORY DB if no strict URI provided or if connection fails.
        // Simplified: Just start Memory Server if we are in dev node and want fallback.

        // For this environment where we know mongo is missing:
        console.log('Starting MongoDB Memory Server...');
        const mongod = await MongoMemoryServer.create();
        mongoUri = mongod.getUri();
        console.log(`MongoDB Memory Server started at ${mongoUri}`);
      } catch (memErr) {
        console.warn('Could not start Memory Server, trying standard URI', memErr);
      }
    }

    const conn = await mongoose.connect(mongoUri || process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
