// src/config/db.js
const mongoose = require('mongoose');

/**
 * Connects to MongoDB with enhanced options and proper event handling
 * @param {string} uri - MongoDB connection string (from process.env.MONGO_URI)
 * @returns {Promise<mongoose.Connection>} The active Mongoose connection
 * @throws {Error} If connection fails or URI is missing
 */
async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  // Prevent multiple connections in development (Hot Reload issues)
  if (mongoose.connection.readyState === 1) {
    console.log('MongoDB already connected');
    return mongoose.connection;
  }

  // Retry loop with exponential backoff to handle transient network/DNS issues
  const maxRetries = parseInt(process.env.MONGO_CONNECT_RETRIES || '5', 10);
  const baseDelayMs = parseInt(process.env.MONGO_RETRY_DELAY_MS || '2000', 10);

  const maxPool = parseInt(process.env.MONGO_MAX_POOL_SIZE || '100', 10);
  const minPool = parseInt(process.env.MONGO_MIN_POOL_SIZE || '5', 10);
  const maxPoolSize = Number.isFinite(maxPool) ? Math.min(Math.max(maxPool, 1), 500) : 100;
  const minPoolSize = Number.isFinite(minPool) ? Math.min(Math.max(minPool, 0), maxPoolSize) : 5;

  const connectOptions = {
    // Pool size: tune per Atlas tier; each app instance has its own pool.
    maxPoolSize,
    minPoolSize,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    heartbeatFrequencyMS: 10000,
  };

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      attempt += 1;
      console.log(`Attempting MongoDB connection (attempt ${attempt}/${maxRetries + 1})`);
      await mongoose.connect(uri, connectOptions);

      const { host, port, name } = mongoose.connection;
      console.log(
        `MongoDB connected successfully: ${name}@${host}:${port} (pool min=${connectOptions.minPoolSize} max=${connectOptions.maxPoolSize})`
      );

      // Event listeners for better monitoring
      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected! Attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected successfully');
      });

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err.message);
      });

      return mongoose.connection;
    } catch (error) {
      console.error('Failed to connect to MongoDB (attempt ' + attempt + '):', error.message);

      if (attempt > maxRetries) {
        console.error('Exceeded maximum MongoDB connection attempts');
        console.error('Last error details:', {
          message: error.message,
          code: error.code,
          codeName: error.codeName,
        });
        if (process.env.NODE_ENV === 'production') {
          console.error('Exiting process due to database connection failure');
          // Give logs a moment to flush
          setTimeout(() => process.exit(1), 100);
        }
        throw error;
      }

      const delay = baseDelayMs * attempt;
      console.log(`Waiting ${delay}ms before next MongoDB connect retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Gracefully close MongoDB connection
 * Useful during server shutdown
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('MongoDB connection closed gracefully');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  mongoose, // Optional: export if needed elsewhere
};