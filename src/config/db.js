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

  try {
    const connectOptions = {
      // Recommended modern options for high concurrency
      maxPoolSize: 50, // Increased for high concurrency - maintain up to 50 socket connections
      minPoolSize: 10, // Minimum number of connections in pool
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      serverSelectionTimeoutMS: 15000, // Keep trying to send operations for 15 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable buffering during initial connection
      bufferMaxEntries: 0, // Disable mongoose buffering
      // Connection monitoring
      heartbeatFrequencyMS: 10000, // Check server every 10 seconds
    };

    await mongoose.connect(uri, connectOptions);

    const { host, port, name } = mongoose.connection;
    console.log(`MongoDB connected successfully: ${name}@${host}:${port}`);

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
    console.error('Failed to connect to MongoDB:', {
      message: error.message,
      code: error.code,
      codeName: error.codeName,
    });

    // In production, you might want to exit or trigger a restart
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting process due to database connection failure');
      process.exit(1);
    }

    throw error; // Re-throw for caller to handle
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