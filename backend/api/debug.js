/**
 * Debug API endpoint handler
 * Provides endpoints for debugging and monitoring application state
 */
const express = require('express');
const logger = require('../../logger');
const { cache } = require('../services/cacheService');
const { audiobookshelfService } = require('../services/audiobookshelfService');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

/**
 * Debug dashboard route
 */
router.get('/', (req, res) => {
  // Return debug dashboard HTML
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Audiobookshelf Manager - Debug Dashboard</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #121212;
          color: #e1e1e1;
          line-height: 1.5;
          margin: 0;
          padding: 20px;
        }
        h1, h2, h3 {
          color: #ffffff;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .card {
          background-color: #1e1e1e;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .data-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #333;
        }
        .data-row:last-child {
          border-bottom: none;
        }
        .data-label {
          font-weight: 500;
          color: #90caf9;
        }
        .button {
          background-color: #2962ff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .button:hover {
          background-color: #1565c0;
        }
        pre {
          background-color: #282c34;
          padding: 15px;
          border-radius: 6px;
          overflow-x: auto;
          font-family: monospace;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Audiobookshelf Manager Debug Dashboard</h1>
        
        <div class="card">
          <h2>System Information</h2>
          <div class="data-row">
            <span class="data-label">Node Version:</span>
            <span>${process.version}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Platform:</span>
            <span>${process.platform} (${os.release()})</span>
          </div>
          <div class="data-row">
            <span class="data-label">Memory Usage:</span>
            <span>${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB</span>
          </div>
          <div class="data-row">
            <span class="data-label">Uptime:</span>
            <span>${Math.floor(process.uptime() / 60 / 60)} hours, ${Math.floor((process.uptime() / 60) % 60)} minutes</span>
          </div>
        </div>
        
        <div class="grid">
          <div class="card">
            <h2>Audiobookshelf Connection</h2>
            <div class="data-row">
              <span class="data-label">Base URL:</span>
              <span>${process.env.AUDIOBOOKSHELF_BASE_URL || 'Not configured'}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Status:</span>
              <span>${audiobookshelfService.isConfigured() ? 'Configured' : 'Not configured'}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Libraries:</span>
              <span>${process.env.AUDIOBOOKSHELF_LIBRARY_IDS || process.env.AUDIOBOOKSHELF_LIBRARY_ID || 'None'}</span>
            </div>
          </div>
          
          <div class="card">
            <h2>Cache Statistics</h2>
            <div class="data-row">
              <span class="data-label">Cache Hits:</span>
              <span>${cache.getStats().hits}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Cache Misses:</span>
              <span>${cache.getStats().misses}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Hit Rate:</span>
              <span>${cache.getHitRate().hitRate * 100}%</span>
            </div>
            <div class="data-row">
              <span class="data-label">Cache Size:</span>
              <span>${Object.keys(cache.cache || {}).length} items</span>
            </div>
            <div style="margin-top: 15px;">
              <button class="button" onclick="fetch('/api/debug/cache/clear', {method: 'POST'}).then(() => window.location.reload())">Clear Cache</button>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2>Recent Logs</h2>
          <pre id="logs">Loading logs...</pre>
          <div style="margin-top: 15px;">
            <button class="button" onclick="window.location.reload()">Refresh Logs</button>
          </div>
        </div>
      </div>
      
      <script>
        // Fetch logs
        fetch('/api/debug/logs?limit=50')
          .then(response => response.json())
          .then(data => {
            document.getElementById('logs').textContent = data.logs.join('\\n');
          })
          .catch(error => {
            document.getElementById('logs').textContent = 'Error loading logs: ' + error.message;
          });
      </script>
    </body>
    </html>
  `);
});

/**
 * Cache statistics endpoint
 */
router.get('/cache', (req, res) => {
  try {
    const stats = cache.getStats();
    const hitRate = cache.getHitRate();
    
    res.json({
      stats,
      hitRate,
      cacheSize: Object.keys(cache.cache || {}).length,
      cacheItems: cache.cache || {}
    });
  } catch (error) {
    logger.logError('Failed to get cache statistics', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear cache endpoint
 */
router.post('/cache/clear', (req, res) => {
  try {
    cache.clear();
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    logger.logError('Failed to clear cache', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get logs endpoint
 */
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level;
    
    // This assumes logs are in a file, modify as needed
    const LOG_DIR = process.env.LOG_DIRECTORY || path.join(__dirname, '..', '..', 'logs');
    const LOG_FILE = path.join(LOG_DIR, 'audiobookshelf-manager.log');
    
    if (!fs.existsSync(LOG_FILE)) {
      return res.json({ logs: ['No log file found'] });
    }
    
    // Read the log file
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim() !== '');
    
    // Filter by level if specified
    const filteredLines = level 
      ? logLines.filter(line => line.includes(`[${level.toUpperCase()}]`)) 
      : logLines;
    
    // Get the most recent logs
    const recentLogs = filteredLines.slice(-limit);
    
    res.json({ logs: recentLogs });
  } catch (error) {
    logger.logError('Failed to get logs', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { debugRouter: router };