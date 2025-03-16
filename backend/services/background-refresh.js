/**
 * Background refresh service
 * Handles periodic data refreshing in the background
 * @module services/background-refresh
 */
const logger = require('../../logger');
const { cache } = require('./cacheService');
const { audiobookshelfService } = require('./audiobookshelfService');

let refreshTimers = [];
const STAGGER_DELAY = 5000; // 5 seconds stagger between refreshes

/**
 * Start background refresh services
 */
function startBackgroundRefresh() {
  try {
    // Clear any existing timers
    stopBackgroundRefresh();
    
    logger.log('Starting background refresh services');
    
    // Get the configured refresh interval
    const refreshInterval = process.env.AUDIOBOOKSHELF_REFRESH_INTERVAL ? 
      parseInt(process.env.AUDIOBOOKSHELF_REFRESH_INTERVAL) : 60000;
    
    // Stagger refreshes to avoid API load spikes
    const refreshRecentAudiobooks = () => {
      // Only refresh if we have libraries configured
      if (process.env.AUDIOBOOKSHELF_LIBRARY_IDS || process.env.AUDIOBOOKSHELF_LIBRARY_ID) {
        refreshAudiobooksData();
      }
      
      // Schedule next refresh
      refreshTimers.push(setTimeout(refreshRecentAudiobooks, refreshInterval));
    };
    
    // Initial delay for first run
    refreshTimers.push(setTimeout(refreshRecentAudiobooks, STAGGER_DELAY));
    
    logger.log(`Background refresh services started with ${refreshInterval}ms interval`);
  } catch (error) {
    logger.logError('Error starting background refresh', error);
  }
}

/**
 * Stop all background refresh services
 */
function stopBackgroundRefresh() {
  refreshTimers.forEach(timer => clearTimeout(timer));
  refreshTimers = [];
  logger.log('Background refresh services stopped');
}

/**
 * Refresh audiobooks data
 */
async function refreshAudiobooksData() {
  try {
    logger.log('Background refresh: Refreshing audiobooks data');
    
    if (!audiobookshelfService.isConfigured()) {
      logger.logWarn('Background refresh: Audiobookshelf not configured');
      return;
    }
    
    // Check if we have libraries configured
    const libraryIds = process.env.AUDIOBOOKSHELF_LIBRARY_IDS;
    const legacyLibraryId = process.env.AUDIOBOOKSHELF_LIBRARY_ID;
    
    if (!libraryIds && !legacyLibraryId) {
      logger.logWarn('Background refresh: No library IDs configured');
      return;
    }
    
    // Force refresh of recent audiobooks data (will update cache)
    await audiobookshelfService.getRecentAudiobooks(15);
    
    logger.log('Background refresh: Audiobooks data refreshed successfully');
  } catch (error) {
    logger.logError('Background refresh: Failed to refresh audiobooks data', error);
  }
}

module.exports = {
  startBackgroundRefresh,
  stopBackgroundRefresh
};