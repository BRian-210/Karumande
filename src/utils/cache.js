// src/utils/cache.js
const { getRedisClient, isConnected } = require('../config/redis');

class Cache {
  constructor() {
    this.client = null;
    this.defaultTTL = 300; // 5 minutes
  }

  async init() {
    if (!this.client) {
      this.client = await getRedisClient();
    }
  }

  async get(key) {
    if (!isConnected()) return null;
    await this.init();
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!isConnected()) return;
    await this.init();
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key) {
    if (!isConnected()) return;
    await this.init();
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache del error:', error);
    }
  }

  async clear(pattern = '*') {
    if (!isConnected()) return;
    await this.init();
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

module.exports = new Cache();