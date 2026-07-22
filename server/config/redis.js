const { createClient } = require('redis');

class RedisService {
  static client = null;
  static isConnected = false;
  static memoryCache = new Map(); // Simple in-memory fallback cache

  static async init() {
    console.log('🔌 Connecting to Redis...');
    
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 3000,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              console.warn('⚠️ Redis reconnection strategy terminated: Max retries exceeded. Falling back to memory cache.');
              this.isConnected = false;
              return new Error('Max retries exceeded');
            }
            return 1000; // Retry after 1 second
          }
        }
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn('⚠️ Redis Client Error:', err.message);
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully.');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('end', () => {
        this.isConnected = false;
      });

      await this.client.connect();

    } catch (err) {
      console.warn('⚠️ Redis connection failed on startup. Falling back to in-memory JS cache.');
      this.client = null;
      this.isConnected = false;
    }
  }

  static async get(key) {
    if (this.isConnected && this.client) {
      try {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } catch (err) {
        console.warn(`⚠️ Redis GET error for key "${key}":`, err.message);
      }
    }
    
    // In-memory fallback
    const item = this.memoryCache.get(key);
    if (item) {
      if (item.expiry && item.expiry < Date.now()) {
        this.memoryCache.delete(key);
        return null;
      }
      return item.value;
    }
    return null;
  }

  static async set(key, value, ttlSeconds = 300) {
    const stringified = JSON.stringify(value);
    
    if (this.isConnected && this.client) {
      try {
        await this.client.set(key, stringified, {
          EX: ttlSeconds
        });
        return true;
      } catch (err) {
        console.warn(`⚠️ Redis SET error for key "${key}":`, err.message);
      }
    }

    // In-memory fallback
    const expiry = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;
    this.memoryCache.set(key, { value, expiry });
    return true;
  }

  static async del(key) {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return true;
      } catch (err) {
        console.warn(`⚠️ Redis DEL error for key "${key}":`, err.message);
      }
    }

    // In-memory fallback
    this.memoryCache.delete(key);
    return true;
  }

  // Deletes keys matching a pattern (e.g., 'blog:posts:*')
  static async delPattern(pattern) {
    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys && keys.length > 0) {
          await this.client.del(keys);
        }
        return true;
      } catch (err) {
        console.warn(`⚠️ Redis DEL pattern error for "${pattern}":`, err.message);
      }
    }

    // In-memory fallback: scan keys manually matching simple wildcard pattern
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regexPattern.test(key)) {
        this.memoryCache.delete(key);
      }
    }
    return true;
  }

  static async flush() {
    if (this.isConnected && this.client) {
      try {
        await this.client.flushAll();
        return true;
      } catch (err) {
        console.warn('⚠️ Redis FLUSH error:', err.message);
      }
    }

    this.memoryCache.clear();
    return true;
  }

  static async close() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (err) {
        // ignore
      }
      this.client = null;
      this.isConnected = false;
    }
  }
}

module.exports = RedisService;
