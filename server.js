/**
 * Main application server for Audiobookshelf Manager
 * Handles API routes, static file serving, and server initialization
 * @module server
 */
const express = require('express');
const path = require('path');
const compression = require('compression');
const os = require('os');
const logger = require('./logger');
const { audiobookRouter } = require('./backend/api/audiobooks');
const { proxyRouter } = require('./backend/api/proxy');
const { debugRouter } = require('./backend/api/debug');
const { formatsRouter } = require('./backend/api/formats');
const { initSettings, getSettings, saveSettings } = require('./backend/services/settings');
const { cache, initializeCache } = require('./backend/services/cacheService');
const { startBackgroundRefresh } = require('./backend/services/background-refresh');
const { audiobookshelfService } = require('./backend/services/audiobookshelfService');

/**
 * Gets the local IP address of the server
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

const app = express();
const PORT = process.env.AUDIOBOOKSHELF_CUSTOM_PORT || 3020;
const REFRESH_INTERVAL = process.env.AUDIOBOOKSHELF_REFRESH_INTERVAL ? 
  parseInt(process.env.AUDIOBOOKSHELF_REFRESH_INTERVAL) : 60000; // 60 seconds default

// Export for other modules to use
app.locals.refreshInterval = REFRESH_INTERVAL;

// Log the configured refresh interval
logger.log(`Configured refresh interval: ${REFRESH_INTERVAL}ms`);

// Compression middleware - apply to all routes
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['content-type'] && 
        (req.headers['content-type'].includes('image/') || 
         req.headers['content-type'].includes('video/'))) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.json());

// Essential API Routes
app.use('/api/audiobooks', audiobookRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/debug', debugRouter);
app.use('/api/formats', formatsRouter);

/**
 * Health check endpoint
 * Verifies Audiobookshelf connection configuration
 * 
 * @route GET /api/health
 */
app.get('/api/health', async (req, res) => {
  try {
    const settings = await getSettings();
    const { AUDIOBOOKSHELF_BASE_URL: baseUrl, AUDIOBOOKSHELF_API_TOKEN: apiToken } = settings.env;
    
    let status = 'ok';
    let configured = true;
    let message = null;
    let cacheHealth = {};

    if (!baseUrl || !apiToken) {
      status = 'unconfigured';
      configured = false;
      message = 'Audiobookshelf connection not configured';
    }

    // Add cache health information
    if (configured) {
      const cacheStats = cache.getStats();
      const hitRate = cache.getHitRate();
      cacheHealth = {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: hitRate.hitRate,
        lastUpdated: cache.getLastSuccessfulTimestamp() || null
      };
    }

    res.json({ 
      status,
      configured,
      message,
      cache: cacheHealth,
      server_time: new Date().toISOString()
    });
  } catch (error) {
    logger.logError('Health check failed', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to check configuration status'
    });
  }
});

/**
 * Get configuration endpoint
 */
app.get('/api/config', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      baseUrl: settings.env.AUDIOBOOKSHELF_BASE_URL || '',
      apiToken: settings.env.AUDIOBOOKSHELF_API_TOKEN || '',
      homepageIp: settings.env.HOMEPAGE_IP || '',
      port: process.env.AUDIOBOOKSHELF_CUSTOM_PORT || 3020,
      refreshInterval: parseInt(process.env.AUDIOBOOKSHELF_REFRESH_INTERVAL || 60000),
      libraryId: settings.env.AUDIOBOOKSHELF_LIBRARY_ID || '',
      libraryIds: settings.env.AUDIOBOOKSHELF_LIBRARY_IDS || ''
    });
  } catch (error) {
    logger.logError('Failed to load configuration', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * Update configuration endpoint
 */
app.post('/api/config', express.json(), async (req, res) => {
  try {
    const { baseUrl, apiToken, homepageIp, libraryId, libraryIds } = req.body;
    
    // Normalize base URL
    let normalizedBaseUrl = baseUrl?.trim() || '';
    if (normalizedBaseUrl && !normalizedBaseUrl.startsWith('http://') && !normalizedBaseUrl.startsWith('https://')) {
      normalizedBaseUrl = 'http://' + normalizedBaseUrl;
    }
    normalizedBaseUrl = normalizedBaseUrl.replace(/\/+$/, '');
    
    // Get current settings
    const settings = await getSettings();
    
    // Update environment settings
    settings.env = {
      ...settings.env,
      AUDIOBOOKSHELF_BASE_URL: normalizedBaseUrl,
      AUDIOBOOKSHELF_API_TOKEN: apiToken || '',
      AUDIOBOOKSHELF_LIBRARY_ID: libraryId || '', // Keep for backward compatibility
      AUDIOBOOKSHELF_LIBRARY_IDS: libraryIds || '', // Add support for multiple libraries
      HOMEPAGE_IP: homepageIp || ''
    };
    
    // Save settings to file
    await saveSettings(settings);

    // Update current environment variables
    process.env.AUDIOBOOKSHELF_BASE_URL = normalizedBaseUrl;
    process.env.AUDIOBOOKSHELF_API_TOKEN = apiToken || '';
    process.env.AUDIOBOOKSHELF_LIBRARY_ID = libraryId || '';
    process.env.AUDIOBOOKSHELF_LIBRARY_IDS = libraryIds || '';
    process.env.HOMEPAGE_IP = homepageIp || '';

    // Log the update
    logger.log(`Configuration updated: Base URL=${normalizedBaseUrl}, Libraries=${libraryIds || libraryId}`);
    
    // Force cache refresh
    try {
      await initializeCache(audiobookshelfService);
    } catch (err) {
      logger.logError('Cache refresh after config update failed', err);
    }

    res.json({ success: true });
  } catch (error) {
    logger.logError('Failed to save configuration', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static frontend with cache headers
app.use(express.static(path.join(__dirname, 'frontend', 'build'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

/**
 * Catch-all route for SPA
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

/**
 * Check if application is fully configured
 * Used to determine whether to initialize cache
 */
function isFullyConfigured(settings) {
  const baseUrl = settings.env.AUDIOBOOKSHELF_BASE_URL;
  const apiToken = settings.env.AUDIOBOOKSHELF_API_TOKEN;
  const libraryId = settings.env.AUDIOBOOKSHELF_LIBRARY_ID;
  const libraryIds = settings.env.AUDIOBOOKSHELF_LIBRARY_IDS;
  
  return !!(baseUrl && apiToken && (libraryId || libraryIds));
}

/**
 * Starts the server and initializes required services
 */
async function startServer() {
  try {
    // Initialize settings first
    await initSettings();
    const settings = await getSettings();

    // Set environment variables from settings
    if (settings.env) {
      process.env.AUDIOBOOKSHELF_BASE_URL = settings.env.AUDIOBOOKSHELF_BASE_URL || '';
      process.env.AUDIOBOOKSHELF_API_TOKEN = settings.env.AUDIOBOOKSHELF_API_TOKEN || '';
      process.env.AUDIOBOOKSHELF_LIBRARY_ID = settings.env.AUDIOBOOKSHELF_LIBRARY_ID || '';
      process.env.AUDIOBOOKSHELF_LIBRARY_IDS = settings.env.AUDIOBOOKSHELF_LIBRARY_IDS || '';
      process.env.HOST_IP = settings.env.HOST_IP || '';
      process.env.HOMEPAGE_IP = settings.env.HOMEPAGE_IP || '';
    }

    // Check if application is fully configured
    const fullyConfigured = isFullyConfigured(settings);

    // Initialize cache only if fully configured
    if (fullyConfigured) {
      logger.log('Initializing cache with initial data...');
      try {
        // Pass the audiobookshelf service to break the circular dependency
        await initializeCache(audiobookshelfService);
      } catch (error) {
        logger.logError('Cache Initialization', error);
      }
    } else {
      logger.logWarn('Skipping cache initialization - not fully configured yet');
    }

    // Start background updates with staggered refresh
    startBackgroundRefresh();
    
    // Start the server
    app.listen(PORT, () => {
      logger.logServerStart(PORT, {
        baseUrl: settings.env.AUDIOBOOKSHELF_BASE_URL || null,
        libraryId: settings.env.AUDIOBOOKSHELF_LIBRARY_ID || null,
        libraryIds: settings.env.AUDIOBOOKSHELF_LIBRARY_IDS || null
      });
    });
  } catch (error) {
    logger.logError('Server Startup', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.logError('Uncaught Exception', error);
  // Keep the server running despite uncaught exceptions
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.logError('Unhandled Promise Rejection', reason);
  // Keep the server running despite unhandled rejections
});

// Start the server
startServer();