/**
 * Audiobooks API endpoint handler
 * Provides endpoints for retrieving audiobook data
 * @module api/audiobooks
 */
const express = require('express');
const axios = require('axios');
const { cache } = require('../services/cacheService');
const { audiobookshelfService } = require('../services/audiobookshelfService');
const logger = require('../../logger');

const router = express.Router();

// Cache TTLs and keys
const AUDIOBOOKS_CACHE_TTL = 60; // 60 seconds
const RECENT_AUDIOBOOKS_CACHE_PREFIX = 'recentAudiobooks:';
const RAW_AUDIOBOOKS_CACHE_PREFIX = 'rawAudiobooks:';
const LIBRARY_INFO_CACHE_PREFIX = 'libraryInfo:';
const LIBRARY_STATS_CACHE_PREFIX = 'libraryStats:';

/**
 * Get recently added audiobooks with processed data
 * 
 * @route GET /api/audiobooks/recent
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.limit=30] - Number of items to return per library
 * @param {string} [req.query.libraryId] - Specific library ID to fetch from
 * @param {boolean} [req.query.combined=false] - Whether to combine results from all libraries
 * @param {number} [req.query.globalLimit] - Maximum number of items to return when combined
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with processed audiobook data organized by library or combined
 */
router.get('/recent', async (req, res) => {
  try {
    const perLibraryLimit = parseInt(req.query.limit) || 30;
    const specificLibraryId = req.query.libraryId;
    const combined = req.query.combined === 'true';
    const globalLimit = parseInt(req.query.globalLimit) || 30;
    
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }

    // Determine which libraries to fetch from
    let libraryIds = [];
    
    if (specificLibraryId) {
      // If a specific library is requested, use only that one
      libraryIds = [specificLibraryId];
    } else {
      // Otherwise, use all configured libraries
      const configuredLibraryIds = process.env.AUDIOBOOKSHELF_LIBRARY_IDS;
      if (configuredLibraryIds) {
        libraryIds = configuredLibraryIds.split(',').filter(id => id.trim());
      } else if (process.env.AUDIOBOOKSHELF_LIBRARY_ID) {
        libraryIds = [process.env.AUDIOBOOKSHELF_LIBRARY_ID];
      }
    }

    if (libraryIds.length === 0) {
      throw new Error('No library IDs specified or configured');
    }
    
    // Structure to hold organized library data
    const librariesData = {};
    const allLibraryInfo = {};
    
    // Fetch data for each library separately
    for (const libraryId of libraryIds) {
      try {
        // Check if we have this library's data in cache
        const cacheKey = `${RECENT_AUDIOBOOKS_CACHE_PREFIX}${libraryId}:${perLibraryLimit}`;
        const cachedData = cache.get(cacheKey);
        
        // Get library info for name reference
        try {
          const libraryInfoCacheKey = `${LIBRARY_INFO_CACHE_PREFIX}${libraryId}`;
          const cachedLibraryInfo = cache.get(libraryInfoCacheKey);
          
          if (cachedLibraryInfo) {
            allLibraryInfo[libraryId] = cachedLibraryInfo;
          } else {
            const libraryInfo = await audiobookshelfService.getLibraryInfo(libraryId);
            allLibraryInfo[libraryId] = libraryInfo;
            cache.set(libraryInfoCacheKey, libraryInfo, 300); // 5 minutes TTL
          }
        } catch (libInfoError) {
          logger.logError(`Error fetching library info for ${libraryId}:`, libInfoError);
          allLibraryInfo[libraryId] = { name: `Library ${libraryId.substring(0, 5)}` };
        }
        
        if (cachedData && cachedData.response && cachedData.response.data) {
          // If cached data exists, use it for this library
          librariesData[libraryId] = cachedData.response.data;
          continue;
        }
        
        // Fetch fresh data for this library
        const libraryData = await audiobookshelfService.getRecentAudiobooks(perLibraryLimit, libraryId);
        
        // Process the data for this library
        const processedData = libraryData.map(book => {
          const metadata = book.media.metadata;
          
          return {
            id: book.id,
            title: metadata.title,
            subtitle: metadata.subtitle,
            authorName: metadata.authorName,
            seriesName: metadata.seriesName,
            narratorName: metadata.narratorName,
            description: metadata.description,
            coverPath: book.media.coverPath,
            duration: audiobookshelfService.formatDuration(book.media.duration),
            addedAt: book.addedAt,
            addedAtRelative: audiobookshelfService.formatRelativeTime(book.addedAt),
            numChapters: book.media.numChapters,
            genres: metadata.genres || [],
            tags: book.media.tags || [],
            mediaType: book.media.mediaType || 'audiobook',
            libraryId: libraryId,
            libraryName: allLibraryInfo[libraryId]?.name || `Library ${libraryId.substring(0, 5)}`
          };
        });
        
        // Sort each library's data by addedAt date (newest first)
        processedData.sort((a, b) => {
          return new Date(b.addedAt) - new Date(a.addedAt);
        });
        
        // Cache the processed data for this library
        const libraryResponseData = {
          response: {
            result: 'success',
            data: processedData,
            count: processedData.length,
            timestamp: new Date().toISOString()
          }
        };
        
        cache.set(cacheKey, libraryResponseData, AUDIOBOOKS_CACHE_TTL);
        
        // Store in our libraries collection
        librariesData[libraryId] = processedData;
      } catch (libraryError) {
        logger.logError(`Error fetching data from library ${libraryId}:`, libraryError);
        // Continue with other libraries even if one fails
        librariesData[libraryId] = [];
      }
    }
    
    // If combined view is requested, merge all items and sort by addedAt
    if (combined) {
      // Unique cache key for the combined view
      const combinedCacheKey = `combinedRecentAudiobooks:${libraryIds.join(',')}-${perLibraryLimit}-${globalLimit}`;
      const cachedCombinedData = cache.get(combinedCacheKey);
      
      if (cachedCombinedData) {
        return res.json(cachedCombinedData);
      }
      
      let allItems = [];
      
      // Collect all items
      Object.entries(librariesData).forEach(([libraryId, items]) => {
        // Add each item to the combined array
        allItems = allItems.concat(items);
      });
      
      // Sort all items by addedAt (newest first)
      allItems.sort((a, b) => {
        return new Date(b.addedAt) - new Date(a.addedAt);
      });
      
      // If a global limit was specified, apply it to the combined results
      const effectiveGlobalLimit = globalLimit > 0 ? globalLimit : (perLibraryLimit * libraryIds.length);
      if (effectiveGlobalLimit > 0 && allItems.length > effectiveGlobalLimit) {
        allItems = allItems.slice(0, effectiveGlobalLimit);
      }
      
      // Create response object
      const responseData = {
        response: {
          result: 'success',
          combined: true,
          data: allItems,
          count: allItems.length,
          timestamp: new Date().toISOString()
        }
      };
      
      // Cache the combined results
      cache.set(combinedCacheKey, responseData, AUDIOBOOKS_CACHE_TTL);
      
      res.json(responseData);
    } else {
      // Return the original library-organized format
      const responseData = {
        response: {
          result: 'success',
          combined: false,
          libraries: libraryIds.map(id => ({
            id,
            name: allLibraryInfo[id]?.name || `Library ${id.substring(0, 5)}`,
            data: librariesData[id] || [],
            count: (librariesData[id] || []).length
          })),
          timestamp: new Date().toISOString()
        }
      };
      
      res.json(responseData);
    }
  } catch (error) {
    logger.logError('Error fetching audiobooks:', error);
    res.status(500).json({
      response: {
        result: 'error',
        message: error.message
      }
    });
  }
});

/**
 * Get raw unprocessed audiobook data directly from Audiobookshelf
 * 
 * @route GET /api/audiobooks/raw
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.limit=30] - Number of items to return per library
 * @param {string} [req.query.libraryId] - Specific library ID to fetch from
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with completely unmodified audiobook data from Audiobookshelf
 */
router.get('/raw', async (req, res) => {
  try {
    const libraryId = req.query.libraryId;
    const limit = parseInt(req.query.limit) || 30;
    const sort = req.query.sort || 'addedAt';
    const desc = req.query.order === 'asc' ? 0 : 1;
    
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }

    // Validate required parameters
    if (!libraryId) {
      throw new Error('Library ID is required for raw data endpoint');
    }
    
    // Check for cached raw data
    const cacheKey = `${RAW_AUDIOBOOKS_CACHE_PREFIX}${libraryId}:${limit}:${sort}:${desc}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // Direct request to Audiobookshelf API
    const baseUrl = process.env.AUDIOBOOKSHELF_BASE_URL;
    const apiToken = process.env.AUDIOBOOKSHELF_API_TOKEN;
    
    if (!baseUrl || !apiToken) {
      throw new Error('Audiobookshelf configuration is incomplete');
    }
    
    const url = `${baseUrl}/api/libraries/${libraryId}/items`;
    const queryParams = new URLSearchParams({
      sort,
      desc,
      limit,
      page: 0,
      token: apiToken
    }).toString();
    
    // Make direct request to Audiobookshelf
    const response = await axios.get(`${url}?${queryParams}`);
    
    if (!response.data) {
      throw new Error('Invalid response from Audiobookshelf API');
    }
    
    // Cache the raw data
    cache.set(cacheKey, response.data, AUDIOBOOKS_CACHE_TTL);
    
    // Return the unmodified Audiobookshelf response
    res.json(response.data);
  } catch (error) {
    logger.logError('Error fetching raw audiobooks data:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch raw data from Audiobookshelf'
    });
  }
});

/**
 * Get combined raw unprocessed data from all libraries
 * 
 * @route GET /api/audiobooks/raw/combined
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.limit=30] - Number of items to return per library
 * @param {number} [req.query.globalLimit=30] - Total number of items across all libraries
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with combined raw audiobook data from all libraries
 */
router.get('/raw/combined', async (req, res) => {
  try {
    const perLibraryLimit = parseInt(req.query.limit) || 30;
    const globalLimit = parseInt(req.query.globalLimit) || 30;
    const sort = req.query.sort || 'addedAt';
    const desc = req.query.order === 'asc' ? 0 : 1;
    
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }
    
    // Get all configured libraries
    let libraryIds = [];
    const configuredLibraryIds = process.env.AUDIOBOOKSHELF_LIBRARY_IDS;
    
    if (configuredLibraryIds) {
      libraryIds = configuredLibraryIds.split(',').filter(id => id.trim());
    } else if (process.env.AUDIOBOOKSHELF_LIBRARY_ID) {
      libraryIds = [process.env.AUDIOBOOKSHELF_LIBRARY_ID];
    }
    
    if (libraryIds.length === 0) {
      throw new Error('No library IDs specified or configured');
    }
    
    // Check for cached combined raw data
    const cacheKey = `${RAW_AUDIOBOOKS_CACHE_PREFIX}combined:${libraryIds.join(',')}-${perLibraryLimit}-${globalLimit}-${sort}-${desc}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }
    
    const baseUrl = process.env.AUDIOBOOKSHELF_BASE_URL;
    const apiToken = process.env.AUDIOBOOKSHELF_API_TOKEN;
    
    if (!baseUrl || !apiToken) {
      throw new Error('Audiobookshelf configuration is incomplete');
    }
    
    // Fetch raw data from all libraries
    const allItemsPromises = libraryIds.map(async (libraryId) => {
      try {
        const url = `${baseUrl}/api/libraries/${libraryId}/items`;
        const queryParams = new URLSearchParams({
          sort,
          desc,
          limit: perLibraryLimit,
          page: 0,
          token: apiToken
        }).toString();
        
        const response = await axios.get(`${url}?${queryParams}`);
        
        if (!response.data || !response.data.results) {
          return [];
        }
        
        // Add libraryId to each item
        return response.data.results.map(item => ({
          ...item,
          _absLibraryId: libraryId // add a non-conflicting field to track source library
        }));
      } catch (error) {
        logger.logError(`Error fetching raw data from library ${libraryId}:`, error);
        return [];
      }
    });
    
    // Wait for all requests to complete
    const allItemsArrays = await Promise.all(allItemsPromises);
    
    // Combine all items
    let allItems = [].concat(...allItemsArrays);
    
    // Sort by addedAt date (newest first)
    allItems.sort((a, b) => {
      return new Date(b.addedAt) - new Date(a.addedAt);
    });
    
    // Apply global limit if needed
    if (allItems.length > globalLimit) {
      allItems = allItems.slice(0, globalLimit);
    }
    
    // Create response
    const responseData = {
      results: allItems,
      total: allItems.length,
      limit: globalLimit,
      page: 0,
      sortBy: sort,
      sortDesc: desc === 1,
      libraryIds: libraryIds,
      timestamp: new Date().toISOString()
    };
    
    // Cache the combined results
    cache.set(cacheKey, responseData, AUDIOBOOKS_CACHE_TTL);
    
    res.json(responseData);
  } catch (error) {
    logger.logError('Error fetching combined raw audiobooks data:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch combined raw data from Audiobookshelf'
    });
  }
});

/**
 * Get library information
 * 
 * @route GET /api/audiobooks/library/:libraryId
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.libraryId - Library ID to get info for
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with library data
 */
router.get('/library/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    
    if (!libraryId) {
      throw new Error('Library ID is required');
    }
    
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Calculate cache key based on library ID
    const cacheKey = `${LIBRARY_INFO_CACHE_PREFIX}${libraryId}`;
    
    // Check for cached data
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }
    
    const libraryData = await audiobookshelfService.getLibraryInfo(libraryId);
    
    const responseData = {
      response: {
        result: 'success',
        data: libraryData,
        timestamp: new Date().toISOString()
      }
    };
    
    // Cache the response for a longer period (5 minutes) as library info rarely changes
    cache.set(cacheKey, responseData, 300);
    
    res.json(responseData);
  } catch (error) {
    logger.logError('Error fetching library info:', error);
    res.status(500).json({
      response: {
        result: 'error',
        message: error.message
      }
    });
  }
});

/**
 * Get raw library data directly from Audiobookshelf
 * 
 * @route GET /api/audiobooks/libraries/raw
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with unmodified libraries data from Audiobookshelf
 */
router.get('/libraries/raw', async (req, res) => {
  try {
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }
    
    const baseUrl = process.env.AUDIOBOOKSHELF_BASE_URL;
    const apiToken = process.env.AUDIOBOOKSHELF_API_TOKEN;
    
    if (!baseUrl || !apiToken) {
      throw new Error('Audiobookshelf configuration is incomplete');
    }
    
    // Direct request to Audiobookshelf API
    const url = `${baseUrl}/api/libraries`;
    const queryParams = new URLSearchParams({ token: apiToken }).toString();
    
    const response = await axios.get(`${url}?${queryParams}`);
    
    if (!response.data) {
      throw new Error('Invalid response from Audiobookshelf API');
    }
    
    // Return the unmodified Audiobookshelf response
    res.json(response.data);
  } catch (error) {
    logger.logError('Error fetching raw libraries data:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch raw libraries data from Audiobookshelf'
    });
  }
});

/**
 * Get all libraries
 * 
 * @route GET /api/audiobooks/libraries
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with libraries data
 */
router.get('/libraries', async (req, res) => {
  try {
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Check for cached data
    const cacheKey = 'allLibraries';
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }
    
    const libraries = await audiobookshelfService.getAllLibraries();
    
    const responseData = {
      response: {
        result: 'success',
        data: libraries,
        count: libraries.length,
        timestamp: new Date().toISOString()
      }
    };
    
    // Cache the response for a longer period
    cache.set(cacheKey, responseData, 300);
    
    res.json(responseData);
  } catch (error) {
    logger.logError('Error fetching libraries:', error);
    res.status(500).json({
      response: {
        result: 'error',
        message: error.message
      }
    });
  }
});

/**
 * Get stats about the audiobook libraries
 * 
 * @route GET /api/audiobooks/stats
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.libraryId] - Specific library ID to fetch stats for
 * @param {boolean} [req.query.all=true] - Get stats for all libraries even if libraryId is specified
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with library statistics including totals
 */
router.get('/stats', async (req, res) => {
  try {
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }
    
    const specificLibraryId = req.query.libraryId;
    const allStats = req.query.all === 'true' || !specificLibraryId;
    
    // Get all configured library IDs
    let libraryIds = [];
    const configuredLibraryIds = process.env.AUDIOBOOKSHELF_LIBRARY_IDS;
    
    if (configuredLibraryIds) {
      libraryIds = configuredLibraryIds.split(',').filter(id => id.trim());
    } else if (process.env.AUDIOBOOKSHELF_LIBRARY_ID) {
      libraryIds = [process.env.AUDIOBOOKSHELF_LIBRARY_ID];
    }
    
    if (libraryIds.length === 0) {
      throw new Error('No library IDs specified or configured');
    }
    
    // If a specific library is requested and not asking for all, just use that one
    if (specificLibraryId && !allStats) {
      libraryIds = [specificLibraryId];
    }
    
    // Calculate cache key based on our query parameters
    const cacheKey = `${LIBRARY_STATS_CACHE_PREFIX}${allStats ? 'all' : libraryIds.join(',')}`;
    
    // Check for cached data
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // Initialize totals
    const totals = {
      totalItems: 0,
      totalAuthors: 0,
      totalSeries: 0,
      totalDuration: 0,
      recentlyAdded: 0
    };
    
    // Store individual library stats
    const libraryStats = {};
    
    // Fetch stats for each library
    for (const libraryId of libraryIds) {
      try {
        // Try to get library info to include name
        let libraryName = `Library ${libraryId.substring(0, 5)}`;
        try {
          const libraryInfo = await audiobookshelfService.getLibraryInfo(libraryId);
          libraryName = libraryInfo.name || libraryName;
        } catch (infoError) {
          logger.logError(`Error fetching library info for ${libraryId}`, infoError);
        }
        
        // Get stats for this library
        const statsData = await audiobookshelfService.getLibraryStats(libraryId);
        
        // Add to totals
        totals.totalItems += statsData.totalItems || 0;
        totals.totalAuthors += statsData.totalAuthors || 0;
        totals.totalSeries += statsData.totalSeries || 0;
        totals.totalDuration += statsData.totalDuration || 0;
        totals.recentlyAdded += statsData.recentlyAdded || 0;
        
        // Store individual library stats
        libraryStats[libraryId] = {
          id: libraryId,
          name: libraryName,
          stats: {
            totalItems: statsData.totalItems || 0,
            totalAuthors: statsData.totalAuthors || 0,
            totalSeries: statsData.totalSeries || 0,
            totalDuration: audiobookshelfService.formatDuration(statsData.totalDuration || 0),
            recentlyAdded: statsData.recentlyAdded || 0
          }
        };
      } catch (libraryError) {
        logger.logError(`Error fetching stats for library ${libraryId}`, libraryError);
        // Continue with other libraries if one fails
      }
    }
    
    // Format the combined duration
    const formattedTotalDuration = audiobookshelfService.formatDuration(totals.totalDuration || 0);
    
    // Prepare response data
    const responseData = {
      response: {
        result: 'success',
        totals: {
          totalLibraries: libraryIds.length,
          totalItems: totals.totalItems,
          totalAuthors: totals.totalAuthors,
          totalSeries: totals.totalSeries,
          totalDuration: formattedTotalDuration,
          recentlyAdded: totals.recentlyAdded
        },
        libraries: Object.values(libraryStats),
        timestamp: new Date().toISOString()
      }
    };
    
    // Cache the response
    cache.set(cacheKey, responseData, 120); // 2 minutes TTL
    
    res.json(responseData);
  } catch (error) {
    logger.logError('Error fetching library stats:', error);
    res.status(500).json({
      response: {
        result: 'error',
        message: error.message
      }
    });
  }
});

/**
 * Get raw stats data directly from Audiobookshelf API
 * 
 * @route GET /api/audiobooks/stats/raw
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.libraryId - Library ID to fetch stats for
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with unmodified stats from Audiobookshelf
 */
router.get('/stats/raw', async (req, res) => {
  try {
    const { libraryId } = req.query;
    
    if (!libraryId) {
      throw new Error('Library ID is required for raw stats');
    }
    
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (!audiobookshelfService.isConfigured()) {
      throw new Error('Audiobookshelf is not fully configured');
    }
    
    const baseUrl = process.env.AUDIOBOOKSHELF_BASE_URL;
    const apiToken = process.env.AUDIOBOOKSHELF_API_TOKEN;
    
    if (!baseUrl || !apiToken) {
      throw new Error('Audiobookshelf configuration is incomplete');
    }
    
    // Direct request to Audiobookshelf API
    const url = `${baseUrl}/api/libraries/${libraryId}/stats`;
    const queryParams = new URLSearchParams({ token: apiToken }).toString();
    
    const response = await axios.get(`${url}?${queryParams}`);
    
    if (!response.data) {
      throw new Error('Invalid response from Audiobookshelf API');
    }
    
    // Return the unmodified Audiobookshelf response
    res.json(response.data);
  } catch (error) {
    logger.logError('Error fetching raw stats data:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch raw stats data from Audiobookshelf'
    });
  }
});

module.exports = { audiobookRouter: router };