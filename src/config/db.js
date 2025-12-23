const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) {
    throw new Error('Missing MONGO_URI for database connection');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000
  });

  return mongoose.connection;
}

module.exports = { connectDB };

