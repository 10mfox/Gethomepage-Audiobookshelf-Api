/**
 * Formats API endpoint handler
 * Manages display format settings for the application
 * @module api/formats
 */
const express = require('express');
const { getSettings, saveSettings } = require('../services/settings');
const { audiobookshelfService } = require('../services/audiobookshelfService');
const logger = require('../../logger');
const { cache } = require('../services/cacheService');

const router = express.Router();

// Cache TTL
const FORMATS_CACHE_TTL = 120; // 2 minutes
const COMBINED_FORMATS_CACHE_KEY = 'combinedFormats';
const LIBRARY_FORMATS_CACHE_PREFIX = 'libraryFormats:';

/**
 * Apply format template to an item
 * Replaces all variables in the template with actual values from the item
 * 
 * @param {string} template - Format template
 * @param {Object} item - Media item
 * @returns {string} Formatted string with replaced variables
 */
function applyTemplate(template, item) {
  if (!template || !item) {
    return '';
  }

  // Map of variable names to item properties
  const variableMap = {
    'title': item.title || '',
    'year': item.year || '',
    'duration': item.duration || '',
    'author_name': item.authorName || '',
    'narrator_name': item.narratorName || '',
    'series_name': item.seriesName || '',
    'added_at_relative': item.addedAtRelative || '',
    'added_at_short': new Date(item.addedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  };

  // Replace all variables in the template
  return template.replace(/\$\{([a-z_]+)\}/g, (match, variable) => {
    return variableMap[variable] !== undefined ? variableMap[variable] : match;
  });
}

/**
 * Get formatted media items for a specific library
 * 
 * @param {string} libraryId - Library ID to fetch items for
 * @param {Object} formats - Format templates to apply
 * @param {string} libraryName - Name of the library
 * @returns {Promise<Array>} Formatted media items
 */
async function getFormattedItemsForLibrary(libraryId, formats, libraryName) {
  try {
    // Fetch recent items from this library
    const items = await audiobookshelfService.getRecentAudiobooks(15, libraryId);
    
    // Format each item
    return items.map(book => {
      const metadata = book.media?.metadata || {};
      const item = {
        id: book.id,
        title: metadata.title || 'Unknown Title',
        subtitle: metadata.subtitle,
        authorName: metadata.authorName || 'Unknown Author',
        seriesName: metadata.seriesName || '',
        narratorName: metadata.narratorName || '',
        duration: audiobookshelfService.formatDuration(book.media?.duration || 0),
        addedAt: book.addedAt,
        addedAtRelative: audiobookshelfService.formatRelativeTime(book.addedAt),
        numChapters: book.media?.numChapters || 0,
        mediaType: book.media?.mediaType || 'audiobook',
        libraryId: libraryId,
        libraryName: libraryName || `Library ${libraryId.substring(0, 5)}`,
        year: metadata.publishYear || '',
        coverPath: book.media?.coverPath || ''
      };
      
      return {
        id: book.id,
        title: metadata.title,
        authorName: metadata.authorName,
        libraryId: libraryId,
        libraryName: libraryName || `Library ${libraryId.substring(0, 5)}`,
        addedAt: book.addedAt,
        formattedPrimary: applyTemplate(formats.primaryFormat, item),
        formattedAdditional: formats.additionalFormat ? applyTemplate(formats.additionalFormat, item) : null,
        coverPath: book.media?.coverPath
      };
    });
  } catch (error) {
    logger.logError(`Error getting formatted items for library ${libraryId}`, error);
    return [];
  }
}

/**
 * Get combined formatted media from all libraries
 * 
 * @route GET /api/formats/combined
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.limit=50] - Maximum number of items to return
 * @returns {Object} JSON response with combined formatted items sorted by add date
 */
router.get('/combined', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // Check for cached data
    const cachedData = cache.get(COMBINED_FORMATS_CACHE_KEY);
    if (cachedData) {
      const limitedData = {...cachedData};
      if (limitedData.items && limitedData.items.length > limit) {
        limitedData.items = limitedData.items.slice(0, limit);
        limitedData.count = limitedData.items.length;
      }
      return res.json(limitedData);
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
    
    // Get settings
    const settings = await getSettings();
    if (!settings.formats) {
      settings.formats = {
        global: {
          primaryFormat: '${title} - by ${author_name}',
          additionalFormat: '${added_at_relative}'
        },
        libraries: {}
      };
    }
    
    // Initialize array for combined formatted items
    let combinedItems = [];
    const libraryFormats = {};
    
    // Fetch data from each library
    for (const libraryId of libraryIds) {
      try {
        // Get library information
        let libraryInfo;
        try {
          libraryInfo = await audiobookshelfService.getLibraryInfo(libraryId);
        } catch (libInfoError) {
          logger.logError(`Error fetching library info for ${libraryId}`, libInfoError);
          libraryInfo = { name: `Library ${libraryId.substring(0, 5)}` };
        }
        
        // Get library-specific formats
        const formats = settings.formats.libraries[libraryId] || settings.formats.global;
        libraryFormats[libraryId] = {
          name: libraryInfo.name,
          formats: formats
        };
        
        // Get formatted items for this library
        const formattedItems = await getFormattedItemsForLibrary(libraryId, formats, libraryInfo.name);
        
        // Add formatted items to combined array
        combinedItems = combinedItems.concat(formattedItems);
      } catch (error) {
        logger.logError(`Error processing library ${libraryId} for combined formats`, error);
      }
    }
    
    // Sort by addedAt date (newest first)
    combinedItems.sort((a, b) => {
      return new Date(b.addedAt) - new Date(a.addedAt);
    });
    
    // Prepare response data
    const responseData = {
      success: true,
      formats: settings.formats.global, // Include global format settings
      libraryFormats: libraryFormats, // Include library-specific format settings
      count: combinedItems.length,
      timestamp: new Date().toISOString(),
      items: combinedItems
    };
    
    // Cache the data
    cache.set(COMBINED_FORMATS_CACHE_KEY, responseData, FORMATS_CACHE_TTL);
    
    // Apply limit if needed
    if (combinedItems.length > limit) {
      responseData.items = combinedItems.slice(0, limit);
      responseData.count = responseData.items.length;
    }
    
    res.json(responseData);
  } catch (error) {
    logger.logError('Failed to get combined formats', error);
    res.status(500).json({ error: 'Failed to get combined formats' });
  }
});

/**
 * Get formats for a specific library with formatted items
 * 
 * @route GET /api/formats
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.libraryId] - Specific library ID to fetch formats for
 * @returns {Object} JSON response with format settings and formatted items
 */
router.get('/', async (req, res) => {
  try {
    const libraryId = req.query.libraryId;
    
    // If no libraryId is provided, redirect to combined endpoint
    if (!libraryId) {
      return res.redirect('/api/formats/combined');
    }
    
    // Check for cached data
    const cacheKey = `${LIBRARY_FORMATS_CACHE_PREFIX}${libraryId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    const settings = await getSettings();
    
    // Initialize formats object if not exists
    if (!settings.formats) {
      settings.formats = {
        global: {
          primaryFormat: '${title} - by ${author_name}',
          additionalFormat: '${added_at_relative}'
        },
        libraries: {}
      };
    }
    
    // Ensure libraries object exists
    if (!settings.formats.libraries) {
      settings.formats.libraries = {};
    }
    
    // Get formats - first check library-specific, then fall back to global
    let formats;
    if (libraryId && settings.formats.libraries[libraryId]) {
      formats = settings.formats.libraries[libraryId];
    } else {
      formats = settings.formats.global;
    }
    
    // Get library information
    let libraryName;
    try {
      const libraryInfo = await audiobookshelfService.getLibraryInfo(libraryId);
      libraryName = libraryInfo.name;
    } catch (error) {
      logger.logError(`Error fetching library info for ${libraryId}`, error);
      libraryName = `Library ${libraryId.substring(0, 5)}`;
    }
    
    // Get formatted items for this library
    const formattedItems = await getFormattedItemsForLibrary(libraryId, formats, libraryName);
    
    // Sort by addedAt date (newest first)
    formattedItems.sort((a, b) => {
      return new Date(b.addedAt) - new Date(a.addedAt);
    });
    
    // Prepare response data
    const responseData = {
      success: true,
      formats: formats,
      libraryId: libraryId,
      libraryName: libraryName,
      count: formattedItems.length,
      timestamp: new Date().toISOString(),
      items: formattedItems
    };
    
    // Cache the data
    cache.set(cacheKey, responseData, FORMATS_CACHE_TTL);
    
    res.json(responseData);
  } catch (error) {
    logger.logError('Failed to load format settings', error);
    res.status(500).json({ error: 'Failed to load format settings' });
  }
});

/**
 * Update formats configuration
 * 
 * @route POST /api/formats
 * @param {Object} req.body - Format settings to save
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.libraryId] - Specific library ID to update settings for
 * @returns {Object} JSON response indicating success
 */
router.post('/', async (req, res) => {
  try {
    const { primaryFormat, additionalFormat } = req.body;
    const libraryId = req.query.libraryId;
    
    if (!primaryFormat) {
      return res.status(400).json({ error: 'Primary format is required' });
    }
    
    const settings = await getSettings();
    
    // Initialize formats structure if needed
    if (!settings.formats) {
      settings.formats = {
        global: {
          primaryFormat: '${title} - by ${author_name}',
          additionalFormat: '${added_at_relative}'
        },
        libraries: {}
      };
    }
    
    if (!settings.formats.libraries) {
      settings.formats.libraries = {};
    }
    
    const formatSettings = {
      primaryFormat,
      additionalFormat: additionalFormat || ''
    };
    
    if (libraryId) {
      // Update library-specific format
      settings.formats.libraries[libraryId] = formatSettings;
      
      // Clear library-specific cache
      cache.delete(`${LIBRARY_FORMATS_CACHE_PREFIX}${libraryId}`);
    } else {
      // Update global format
      settings.formats.global = formatSettings;
      
      // Clear all library caches since global format changed
      Object.keys(settings.formats.libraries).forEach(id => {
        cache.delete(`${LIBRARY_FORMATS_CACHE_PREFIX}${id}`);
      });
    }
    
    await saveSettings(settings);
    
    // Clear the combined formats cache to ensure fresh data
    cache.delete(COMBINED_FORMATS_CACHE_KEY);
    
    logger.log(`Format settings updated for ${libraryId ? `library ${libraryId}` : 'global'}`);
    res.json({ success: true });
  } catch (error) {
    logger.logError('Failed to save format settings', error);
    res.status(500).json({ error: 'Failed to save format settings' });
  }
});

module.exports = { formatsRouter: router };