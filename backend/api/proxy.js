/**
 * API Proxy Router
 * Provides secure proxy functionality for accessing external APIs
 * @module api/proxy
 */
const express = require('express');
const axios = require('axios');
const logger = require('../../logger');

const router = express.Router();

/**
 * Proxy route to safely fetch data from external APIs
 * 
 * @route POST /api/proxy
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.url - URL to proxy request to
 * @param {Object} res - Express response object
 * @returns {Object} JSON response from proxied API
 */
router.post('/', async (req, res) => {
  try {
    // Validate request
    if (!req.body || !req.body.url) {
      return res.status(400).json({
        response: {
          result: 'error',
          message: 'Missing required URL parameter'
        }
      });
    }

    const targetUrl = req.body.url;
    
    // Log the request for debugging
    logger.log(`Proxy request to: ${targetUrl}`);
    
    // Security check - only allow requests to configured Audiobookshelf server
    // Remove this restriction for more flexibility if needed
    const absBaseUrl = process.env.AUDIOBOOKSHELF_BASE_URL;
    
    if (absBaseUrl && !targetUrl.startsWith(absBaseUrl) && !(absBaseUrl.endsWith('/') && targetUrl.startsWith(absBaseUrl.slice(0, -1)))) {
      logger.logWarn(`Proxy request blocked for non-matching URL: ${targetUrl} vs ${absBaseUrl}`);
      return res.status(403).json({
        response: {
          result: 'error',
          message: 'Proxy requests are only allowed to the configured Audiobookshelf server'
        }
      });
    }
    
    // Prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Make the request to the target URL
    const response = await axios.get(targetUrl, {
      timeout: 15000, // Increased timeout to 15 seconds
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'User-Agent': 'AudiobookshelfManager/1.0'
      }
    });
    
    // Log successful response
    logger.log(`Proxy response status: ${response.status}`);
    
    // Return the proxied response
    res.json(response.data);
    
  } catch (error) {
    logger.logError('Proxy request failed', error);
    
    // Build detailed error response
    let statusCode = 500;
    let message = 'Proxy request failed';
    
    if (error.response) {
      statusCode = error.response.status;
      message = `Server responded with status: ${error.response.status}`;
      
      logger.logError('Error response data:', JSON.stringify(error.response.data));
      
      if (error.response.data && error.response.data.message) {
        message += ` - ${error.response.data.message}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      statusCode = 504;
      message = 'Connection timed out - the server took too long to respond';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 502;
      message = 'Connection refused - server may be unavailable or the URL is incorrect';
    } else if (error.code === 'ENOTFOUND') {
      statusCode = 404;
      message = 'Host not found - please check the URL';
    }
    
    res.status(statusCode).json({
      response: {
        result: 'error',
        message: message
      }
    });
  }
});

module.exports = { proxyRouter: router };