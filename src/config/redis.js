// src/config/redis.js
const redis = require('redis');

let client;
let isConnected = false;

async function connectRedis() {
  if (!client) {
    try {
      client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 60000,
          lazyConnect: true,
        },
      });

      client.on('error', (err) => {
        console.warn('Redis Client Error (caching disabled):', err.message);
        isConnected = false;
      });

      client.on('connect', () => {
        console.log('Connected to Redis');
        isConnected = true;
      });

      await client.connect();
    } catch (error) {
      console.warn('Failed to connect to Redis (caching disabled):', error.message);
      isConnected = false;
    }
  }
  return client;
}

async function getRedisClient() {
  if (!client) {
    await connectRedis();
  }
  return isConnected ? client : null;
}

async function disconnectRedis() {
  if (client && isConnected) {
    try {
      await client.disconnect();
      console.log('Disconnected from Redis');
    } catch (error) {
      console.warn('Error disconnecting Redis:', error.message);
    }
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
  isConnected: () => isConnected,
};