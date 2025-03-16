/**
 * Audiobookshelf API service
 * Provides methods for interacting with the Audiobookshelf API
 * @module services/audiobookshelfService
 */
const axios = require('axios');
const logger = require('../../logger');
const { cache } = require('./cacheService');

const RETRY_DELAY = 1000;
const MAX_RETRIES = 2;
const DEFAULT_TIMEOUT = 5000;

class AudiobookshelfService {
  constructor() {
    this.api = axios.create({
      timeout: DEFAULT_TIMEOUT,
      headers: { 
        'Accept-Encoding': 'gzip',
        'User-Agent': 'AudiobookshelfManager/1.0'
      }
    });
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      avgResponseTime: 0,
      deduplicatedRequests: 0
    };
    
    this.pendingRequests = new Map();
  }

  /**
   * Makes a request to the Audiobookshelf API
   * 
   * @param {string} endpoint - API endpoint path
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(endpoint, params = {}, options = {}) {
    const { 
      maxRetries = MAX_RETRIES, 
      timeout = DEFAULT_TIMEOUT,
      deduplicate = true,
    } = options;
    
    if (!process.env.AUDIOBOOKSHELF_BASE_URL || !process.env.AUDIOBOOKSHELF_API_TOKEN) {
      throw new Error('Audiobookshelf configuration missing');
    }
    
    const requestId = `${endpoint}:${JSON.stringify(params)}`;
    
    if (deduplicate && this.pendingRequests.has(requestId)) {
      this.metrics.deduplicatedRequests++;
      return this.pendingRequests.get(requestId);
    }
    
    const requestPromise = this._executeRequest(endpoint, params, {
      maxRetries,
      timeout,
      requestId
    });
    
    if (deduplicate) {
      this.pendingRequests.set(requestId, requestPromise);
      
      requestPromise.finally(() => {
        this.pendingRequests.delete(requestId);
      });
    }
    
    return requestPromise;
  }
  
  async _executeRequest(endpoint, params, options) {
    const { maxRetries, timeout, requestId } = options;
    let lastError;
    
    this.metrics.totalRequests++;
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `${process.env.AUDIOBOOKSHELF_BASE_URL}${endpoint}`;
        const queryParams = new URLSearchParams({
          ...params,
          token: process.env.AUDIOBOOKSHELF_API_TOKEN
        }).toString();
        
        const response = await this.api.get(`${url}?${queryParams}`, {
          timeout: timeout
        });

        if (!response.data) {
          throw new Error('Invalid response format from Audiobookshelf');
        }
        
        this.metrics.successfulRequests++;
        
        const elapsed = Date.now() - startTime;
        this.metrics.avgResponseTime = 
          (this.metrics.avgResponseTime * (this.metrics.successfulRequests - 1) + elapsed) / 
          this.metrics.successfulRequests;

        return response.data;
      } catch (error) {
        lastError = error;
        
        if (attempt > 1) {
          this.metrics.retries++;
        }
        
        if (attempt === maxRetries) {
          break;
        }

        const backoffDelay = RETRY_DELAY * Math.pow(1.5, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    this.metrics.failedRequests++;
    throw new Error(this._getErrorMessage(lastError, endpoint));
  }
  
  _getErrorMessage(error, endpoint) {
    if (error.response?.data?.message) {
      return `Audiobookshelf API error (${endpoint}): ${error.response.data.message}`;
    } else if (error.response?.status) {
      return `Audiobookshelf API returned status ${error.response.status} (${endpoint})`;
    } else if (error.code === 'ECONNABORTED') {
      return `Audiobookshelf API request timed out (${endpoint})`;
    } else if (error.code === 'ECONNREFUSED') {
      return `Could not connect to Audiobookshelf (${endpoint}): Connection refused`;
    } else {
      return error.message || `Unknown error in Audiobookshelf API request (${endpoint})`;
    }
  }

  /**
   * Gets recent audiobooks from configured library
   * 
   * @param {number} limit - Maximum number of items to return
   * @param {string} libraryId - Library ID to fetch from
   * @returns {Promise<Array>} Array of audiobook items
   */
  async getRecentAudiobooks(limit = 15, libraryId = null) {
    try {
      // Use specified library ID or fall back to configured ones
      let targetLibraryId = libraryId;
      
      if (!targetLibraryId) {
        // Check for multiple library IDs first
        if (process.env.AUDIOBOOKSHELF_LIBRARY_IDS) {
          const libraryIds = process.env.AUDIOBOOKSHELF_LIBRARY_IDS.split(',').filter(id => id.trim());
          if (libraryIds.length > 0) {
            targetLibraryId = libraryIds[0]; // Use the first library ID
          }
        } else if (process.env.AUDIOBOOKSHELF_LIBRARY_ID) {
          targetLibraryId = process.env.AUDIOBOOKSHELF_LIBRARY_ID;
        }
      }
      
      if (!targetLibraryId) {
        logger.logWarn('No library ID configured, returning empty results');
        return [];
      }
      
      const data = await this.makeRequest(`/api/libraries/${targetLibraryId}/items`, {
        sort: 'addedAt',
        desc: 1,
        limit: limit,
        page: 0
      });
      
      return data.results || [];
    } catch (error) {
      logger.logError('Error fetching recent audiobooks:', error);
      return [];
    }
  }

  /**
   * Gets information about a specific library
   * 
   * @param {string} libraryId - Library ID to get info for
   * @returns {Promise<Object>} Library information
   */
  async getLibraryInfo(libraryId) {
    try {
      if (!libraryId) {
        throw new Error('Library ID is required');
      }
      
      const data = await this.makeRequest(`/api/libraries/${libraryId}`);
      return data;
    } catch (error) {
      logger.logError('Error fetching library info:', error);
      throw error;
    }
  }

  /**
   * Gets statistics for a specific library
   * 
   * @param {string} libraryId - Library ID to get stats for
   * @returns {Promise<Object>} Library statistics
   */
  async getLibraryStats(libraryId) {
    try {
      if (!libraryId) {
        throw new Error('Library ID is required');
      }
      
      const data = await this.makeRequest(`/api/libraries/${libraryId}/stats`);
      return data;
    } catch (error) {
      logger.logError('Error fetching library stats:', error);
      throw error;
    }
  }

  /**
   * Gets a list of all libraries
   * 
   * @returns {Promise<Array>} List of libraries
   */
  async getAllLibraries() {
    try {
      const data = await this.makeRequest('/api/libraries');
      return data.libraries || [];
    } catch (error) {
      logger.logError('Error fetching all libraries:', error);
      throw error;
    }
  }

  /**
   * Format duration in seconds to human-readable string
   * 
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours < 1) {
      return `${minutes}m`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Format relative time from timestamp
   * 
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Relative time string
   */
  formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    
    // Convert to seconds
    const diffSeconds = Math.floor(diff / 1000);
    
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return `${Math.floor(diffSeconds / 604800)}w ago`;
  }

  /**
   * Check if Audiobookshelf is configured
   * 
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return !!(
      process.env.AUDIOBOOKSHELF_BASE_URL && 
      process.env.AUDIOBOOKSHELF_API_TOKEN
    );
  }

  /**
   * Get Audiobookshelf configuration
   * 
   * @returns {Object} Configuration object
   */
  getConfig() {
    return {
      baseUrl: process.env.AUDIOBOOKSHELF_BASE_URL || '',
      apiToken: process.env.AUDIOBOOKSHELF_API_TOKEN || '',
      libraryId: process.env.AUDIOBOOKSHELF_LIBRARY_ID || '',
      libraryIds: process.env.AUDIOBOOKSHELF_LIBRARY_IDS || ''
    };
  }
}

// Create singleton instance
const audiobookshelfService = new AudiobookshelfService();

module.exports = { audiobookshelfService };