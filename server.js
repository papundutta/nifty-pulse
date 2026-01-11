/**
 * NIFTY Options Chain Backend Server
 * 
 * This Express server fetches live NIFTY option chain data from NSE's public API
 * and exposes it via a REST endpoint for the frontend to consume.
 * 
 * Features:
 * - Session warm-up with proper headers and cookie handling
 * - Auto-retry and cookie refresh on failure
 * - CORS enabled for frontend access
 * - Polls NSE at configurable intervals (default: 5 seconds)
 * 
 * Usage:
 * 1. Install dependencies: npm install express axios cors
 * 2. Run server: node server.js
 * 3. Access API at: http://localhost:3001/chain
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(express.json());

// NSE API Configuration
const NSE_BASE_URL = 'https://www.nseindia.com';
const OPTION_CHAIN_URL = `${NSE_BASE_URL}/api/option-chain-indices?symbol=NIFTY`;

// Session management
let cookies = '';
let lastFetchTime = null;
let cachedData = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const CACHE_DURATION = 3000; // 3 seconds cache

// Common headers to mimic browser requests
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': `${NSE_BASE_URL}/option-chain`,
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  ...(cookies ? { 'Cookie': cookies } : {})
});

/**
 * Initialize session by visiting NSE homepage to get cookies
 */
async function initSession() {
  try {
    console.log('[Session] Initializing NSE session...');
    
    const response = await axios.get(`${NSE_BASE_URL}/option-chain`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    
    // Extract cookies from response
    const setCookies = response.headers['set-cookie'];
    if (setCookies) {
      cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('[Session] Cookies obtained successfully');
    }
    
    retryCount = 0;
    return true;
  } catch (error) {
    console.error('[Session] Failed to initialize:', error.message);
    return false;
  }
}

/**
 * Fetch option chain data from NSE
 */
async function fetchOptionChain() {
  // Return cached data if still fresh
  if (cachedData && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
    return cachedData;
  }

  try {
    // Initialize session if no cookies
    if (!cookies) {
      const sessionOk = await initSession();
      if (!sessionOk) {
        throw new Error('Failed to establish session with NSE');
      }
      // Wait a bit after getting cookies
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[Fetch] Requesting option chain data...');
    
    const response = await axios.get(OPTION_CHAIN_URL, {
      headers: getHeaders(),
      timeout: 15000,
    });

    if (response.data && response.data.records) {
      cachedData = response.data;
      lastFetchTime = Date.now();
      retryCount = 0;
      console.log('[Fetch] Data received successfully. Spot:', response.data.records.underlyingValue);
      return response.data;
    } else {
      throw new Error('Invalid response structure from NSE');
    }

  } catch (error) {
    console.error('[Fetch] Error:', error.message);
    
    // Handle specific errors
    if (error.response) {
      const status = error.response.status;
      console.error('[Fetch] HTTP Status:', status);
      
      if (status === 401 || status === 403) {
        // Session expired, refresh cookies
        console.log('[Fetch] Session expired, refreshing...');
        cookies = '';
        
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`[Fetch] Retry attempt ${retryCount}/${MAX_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return fetchOptionChain();
        }
      }
    }

    // If we have cached data, return it even if stale
    if (cachedData) {
      console.log('[Fetch] Returning stale cached data');
      return { ...cachedData, stale: true };
    }

    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasCache: !!cachedData,
    lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
  });
});

// Main option chain endpoint
app.get('/chain', async (req, res) => {
  try {
    const { expiry } = req.query;
    const data = await fetchOptionChain();
    
    // If specific expiry requested, filter data
    if (expiry && data.filtered) {
      const filteredData = data.records.data.filter(item => 
        item.expiryDate === expiry
      );
      
      return res.json({
        records: {
          ...data.records,
          data: filteredData,
        },
        filtered: {
          data: filteredData,
        },
        stale: data.stale || false,
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('[API] Error serving /chain:', error.message);
    res.status(503).json({
      error: 'Failed to fetch option chain data',
      message: error.message,
      retryAfter: 5,
    });
  }
});

// Get available expiry dates
app.get('/expiries', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json({
      expiryDates: data.records?.expiryDates || [],
    });
  } catch (error) {
    res.status(503).json({
      error: 'Failed to fetch expiry dates',
      message: error.message,
    });
  }
});

// Get spot price only
app.get('/spot', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json({
      underlyingValue: data.records?.underlyingValue,
      timestamp: data.records?.timestamp,
    });
  } catch (error) {
    res.status(503).json({
      error: 'Failed to fetch spot price',
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          NIFTY Options Chain Backend Server               ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                 ║
║                                                           ║
║  Endpoints:                                               ║
║    GET /chain    - Full option chain data                 ║
║    GET /expiries - Available expiry dates                 ║
║    GET /spot     - Current spot price                     ║
║    GET /health   - Server health check                    ║
║                                                           ║
║  Frontend should connect to: http://localhost:${PORT}/chain  ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // Initialize session on startup
  await initSession();
  
  // Pre-fetch data
  try {
    await fetchOptionChain();
    console.log('[Startup] Initial data fetch successful');
  } catch (error) {
    console.error('[Startup] Initial fetch failed:', error.message);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  process.exit(0);
});
