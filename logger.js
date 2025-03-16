/**
 * Application logging utility
 * Provides consistent logging format across the application
 * @module logger
 */
const fs = require('fs');
const path = require('path');
const util = require('util');

// Log levels
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Configuration
const LOG_DIRECTORY = process.env.LOG_DIRECTORY || path.join(__dirname, 'logs');
const MAX_LOG_FILES = 5;
const MAX_LOG_SIZE = 1024 * 1024 * 5; // 5MB

// Ensure log directory exists
if (!fs.existsSync(LOG_DIRECTORY)) {
  fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
}

/**
 * Format a log message with timestamp
 * 
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
function formatLogMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * Log a message to the console and log file
 * 
 * @param {string} message - Message to log
 * @param {string} level - Log level
 */
function logMessage(message, level = LOG_LEVELS.INFO) {
  const formattedMessage = formatLogMessage(level, message);
  
  // Log to console
  console.log(formattedMessage);
  
  // Log to file
  const logFile = path.join(LOG_DIRECTORY, 'audiobookshelf-manager.log');
  fs.appendFileSync(logFile, formattedMessage + '\n');
  
  // Rotate logs if needed
  try {
    const stats = fs.statSync(logFile);
    if (stats.size > MAX_LOG_SIZE) {
      rotateLogFiles();
    }
  } catch (error) {
    console.error('Error checking log file size:', error);
  }
}

/**
 * Rotate log files
 */
function rotateLogFiles() {
  for (let i = MAX_LOG_FILES - 1; i > 0; i--) {
    const oldPath = path.join(LOG_DIRECTORY, `audiobookshelf-manager.log.${i - 1}`);
    const newPath = path.join(LOG_DIRECTORY, `audiobookshelf-manager.log.${i}`);
    
    if (fs.existsSync(oldPath)) {
      try {
        fs.renameSync(oldPath, newPath);
      } catch (error) {
        console.error(`Error rotating log files from ${oldPath} to ${newPath}:`, error);
      }
    }
  }
  
  try {
    fs.renameSync(
      path.join(LOG_DIRECTORY, 'audiobookshelf-manager.log'),
      path.join(LOG_DIRECTORY, 'audiobookshelf-manager.log.0')
    );
  } catch (error) {
    console.error('Error rotating main log file:', error);
  }
}

/**
 * Log an error with context
 * 
 * @param {string} context - Error context
 * @param {Error} error - Error object
 */
function logError(context, error) {
  const errorMessage = `${context}: ${error.message}`;
  const stackTrace = error.stack ? `\n${error.stack}` : '';
  logMessage(errorMessage + stackTrace, LOG_LEVELS.ERROR);
}

/**
 * Log server start information
 * 
 * @param {number} port - Server port
 * @param {Object} config - Server configuration
 */
function logServerStart(port, config = {}) {
  const configured = config.baseUrl && config.libraryId;
  
  logMessage(`Server started on port ${port}`, LOG_LEVELS.INFO);
  logMessage(`Node.js version: ${process.version}`, LOG_LEVELS.INFO);
  logMessage(`Environment: ${process.env.NODE_ENV || 'development'}`, LOG_LEVELS.INFO);
  
  if (configured) {
    logMessage('Audiobookshelf configuration: Valid', LOG_LEVELS.INFO);
  } else {
    logMessage('Audiobookshelf configuration: Missing or incomplete', LOG_LEVELS.WARN);
  }
}

module.exports = {
  log: (message) => logMessage(message, LOG_LEVELS.INFO),
  logWarn: (message) => logMessage(message, LOG_LEVELS.WARN),
  logError,
  logServerStart,
  LOG_LEVELS
};