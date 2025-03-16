/**
 * Settings service
 * Manages application settings and configuration
 * @module services/settings
 */
const fs = require('fs');
const path = require('path');
const util = require('util');
const logger = require('../../logger');

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const mkdirAsync = util.promisify(fs.mkdir);

// Settings file path
const CONFIG_DIR = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'config')
  : path.join(__dirname, '..', '..', 'config');

const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');

// Default settings
const DEFAULT_SETTINGS = {
  version: 1,
  env: {
    AUDIOBOOKSHELF_BASE_URL: '',
    AUDIOBOOKSHELF_API_TOKEN: '',
    AUDIOBOOKSHELF_LIBRARY_ID: '',
    HOMEPAGE_IP: ''
  },
  ui: {
    darkMode: true,
    maxItems: 15
  }
};

let cachedSettings = null;

/**
 * Initialize settings
 * Creates settings directory and file if they don't exist
 */
async function initSettings() {
  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      await mkdirAsync(CONFIG_DIR, { recursive: true });
      logger.log(`Created config directory: ${CONFIG_DIR}`);
    }
    
    // Check if settings file exists
    if (!fs.existsSync(SETTINGS_FILE)) {
      await writeFileAsync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      logger.log(`Created default settings file: ${SETTINGS_FILE}`);
    }
    
    // Load settings
    await getSettings(true);
    
  } catch (error) {
    logger.logError('Settings initialization failed', error);
    throw error;
  }
}

/**
 * Get application settings
 * 
 * @param {boolean} forceReload - Force reload from disk
 * @returns {Promise<Object>} Settings object
 */
async function getSettings(forceReload = false) {
  try {
    if (cachedSettings && !forceReload) {
      return cachedSettings;
    }
    
    const data = await readFileAsync(SETTINGS_FILE, 'utf8');
    let settings = JSON.parse(data);
    
    // Update settings with env vars if present
    if (process.env.AUDIOBOOKSHELF_BASE_URL) {
      settings.env.AUDIOBOOKSHELF_BASE_URL = process.env.AUDIOBOOKSHELF_BASE_URL;
    }
    
    if (process.env.AUDIOBOOKSHELF_API_TOKEN) {
      settings.env.AUDIOBOOKSHELF_API_TOKEN = process.env.AUDIOBOOKSHELF_API_TOKEN;
    }
    
    if (process.env.AUDIOBOOKSHELF_LIBRARY_ID) {
      settings.env.AUDIOBOOKSHELF_LIBRARY_ID = process.env.AUDIOBOOKSHELF_LIBRARY_ID;
    }
    
    cachedSettings = settings;
    return settings;
  } catch (error) {
    logger.logError('Failed to load settings', error);
    
    // Return default settings if file can't be read
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save application settings
 * 
 * @param {Object} settings - Settings to save
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  try {
    await writeFileAsync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    
    // Update cached settings
    cachedSettings = settings;
    
    // Update environment variables
    if (settings.env) {
      process.env.AUDIOBOOKSHELF_BASE_URL = settings.env.AUDIOBOOKSHELF_BASE_URL || '';
      process.env.AUDIOBOOKSHELF_API_TOKEN = settings.env.AUDIOBOOKSHELF_API_TOKEN || '';
      process.env.AUDIOBOOKSHELF_LIBRARY_ID = settings.env.AUDIOBOOKSHELF_LIBRARY_ID || '';
    }
    
    logger.log('Settings saved successfully');
  } catch (error) {
    logger.logError('Failed to save settings', error);
    throw error;
  }
}

module.exports = {
  initSettings,
  getSettings,
  saveSettings
};