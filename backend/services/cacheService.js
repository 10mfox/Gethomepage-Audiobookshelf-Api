/**
 * Caching service
 * Provides in-memory caching for API responses
 * @module services/cacheService
 */
const logger = require('../../logger');

/**
 * Simple in-memory cache with TTL
 */
class Cache {
  constructor() {
    this.cache = {};
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
    this.lastSuccessfulUpdate = null;
  }

  /**
   * Get an item from the cache
   * 
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const item = this.cache[key];
    
    if (!item) {
      this.stats.misses++;
      return undefined;
    }
    
    if (Date.now() > item.expiry) {
      this.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return undefined;
    }
    
    this.stats.hits++;
    return item.value;
  }

  /**
   * Set an item in the cache with TTL
   * 
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds
   */
  set(key, value, ttlSeconds = 60) {
    this.cache[key] = {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    };
    
    this.stats.sets++;
    
    // Track last successful update
    this.lastSuccessfulUpdate = Date.now();
  }

  /**
   * Delete an item from the cache
   * 
   * @param {string} key - Cache key
   */
  delete(key) {
    delete this.cache[key];
  }

  /**
   * Clear all cache items
   */
  clear() {
    this.cache = {};
    logger.log('Cache cleared');
  }

  /**
   * Get cache stats
   * 
   * @returns {Object} Cache statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate
   * 
   * @returns {Object} Hit rate information
   */
  getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    
    return {
      total,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Get timestamp of last successful update
   * 
   * @returns {number|null} Timestamp or null
   */
  getLastSuccessfulTimestamp() {
    return this.lastSuccessfulUpdate;
  }
}

// Create singleton instance
const cache = new Cache();

/**
 * Initialize cache with initial data
 * Modified to accept the service instance as a parameter to break circular dependency
 * 
 * @param {Object} absService - The audiobookshelf service instance
 */
async function initializeCache(absService) {
  try {
    // Check if Audiobookshelf is configured with library IDs
    if (!absService.isConfigured()) {
      logger.logWarn('Cannot initialize cache: Audiobookshelf not configured');
      return;
    }
    
    // Check if at least one library ID is configured
    const libraryIds = process.env.AUDIOBOOKSHELF_LIBRARY_IDS;
    const legacyLibraryId = process.env.AUDIOBOOKSHELF_LIBRARY_ID;
    
    if (!libraryIds && !legacyLibraryId) {
      logger.logWarn('Cannot initialize cache: No library IDs configured');
      return;
    }
    
    logger.log('Initializing cache with recent audiobooks...');
    
    // Force a new request to Audiobookshelf
    cache.clear();
    
    try {
      // Attempt to prefetch recent audiobooks
      await absService.getRecentAudiobooks(15);
      logger.log('Cache initialization complete');
    } catch (error) {
      // Handle errors but don't throw - the application should still work
      logger.logError('Error during cache initialization', error);
      logger.log('Application will continue without initial cache data');
    }
  } catch (error) {
    logger.logError('Cache initialization failed', error);
    // Don't throw the error - allow application to continue
  }
}

module.exports = {
  cache,
  initializeCache
};