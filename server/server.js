/**
 * NIFTY Options Chain Backend Server (Debug Enhanced)
 * 
 * Features:
 * - Comprehensive logging to diagnose NSE API responses
 * - Multiple fallback strategies for different response formats
 * - Session management with proper cookie handling
 * 
 * Usage:
 * 1. Install dependencies: npm install express axios cors
 * 2. Run server: node server.js
 * 3. Check console output for detailed diagnostics
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

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
const CACHE_DURATION = 3000;

const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.nseindia.com/option-chain',
  'X-Requested-With': 'XMLHttpRequest',
  'Connection': 'keep-alive',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  ...(cookies ? { 'Cookie': cookies } : {})
});

/**
 * Initialize session by visiting NSE homepage
 */
async function initSession() {
  try {
    console.log('\n[Session] 🔄 Initializing NSE session...');
    
    // First, visit the homepage
    const homeResponse = await axios.get(NSE_BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 10000,
    });
    
    let cookieSet = homeResponse.headers['set-cookie'];
    if (cookieSet) {
      cookies = cookieSet.map(c => c.split(';')[0]).join('; ');
    }
    
    console.log('[Session] 📍 Step 1: Visited homepage');
    
    // Then visit option chain page
    const chainPageResponse = await axios.get(`${NSE_BASE_URL}/option-chain`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        ...(cookies ? { 'Cookie': cookies } : {})
      },
      timeout: 10000,
    });
    
    const moreCookies = chainPageResponse.headers['set-cookie'];
    if (moreCookies) {
      const newCookies = moreCookies.map(c => c.split(';')[0]).join('; ');
      cookies = cookies ? `${cookies}; ${newCookies}` : newCookies;
    }
    
    console.log('[Session] 📍 Step 2: Visited option chain page');
    console.log('[Session] 🍪 Cookies obtained:', cookies ? 'YES' : 'NO');
    console.log('[Session] 🍪 Cookie length:', cookies.length);
    
    retryCount = 0;
    return true;
  } catch (error) {
    console.error('[Session] ❌ Failed:', error.message);
    return false;
  }
}

/**
 * Fetch option chain data with comprehensive logging
 */
async function fetchOptionChain() {
  if (cachedData && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
    console.log('[Fetch] ⚡ Returning cached data');
    return cachedData;
  }

  try {
    if (!cookies) {
      console.log('[Fetch] 🔑 No cookies found, initializing session...');
      const sessionOk = await initSession();
      if (!sessionOk) {
        throw new Error('Failed to establish session with NSE');
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log('\n[Fetch] 📡 Requesting option chain data...');
    console.log('[Fetch] 🔗 URL:', OPTION_CHAIN_URL);
    
    const response = await axios.get(OPTION_CHAIN_URL, {
      headers: getHeaders(),
      timeout: 15000,
      validateStatus: () => true, // Accept any status
    });

    console.log('[Fetch] 📊 Response Status:', response.status);
    console.log('[Fetch] 📦 Response Type:', typeof response.data);
    console.log('[Fetch] 📦 Is Array:', Array.isArray(response.data));
    console.log('[Fetch] 📦 Is Object:', response.data && typeof response.data === 'object');

    // Save raw response for inspection
    try {
      fs.writeFileSync('nse_response.json', JSON.stringify(response.data, null, 2));
      console.log('[Fetch] 💾 Raw response saved to nse_response.json');
    } catch (e) {
      // Ignore file write errors
    }

    // Check response status
    if (response.status === 401 || response.status === 403) {
      console.log('[Fetch] 🔒 Authentication failed, clearing cookies...');
      cookies = '';
      throw new Error('Authentication failed - session expired');
    }

    if (response.status !== 200) {
      console.log('[Fetch] ⚠️ Non-200 status code');
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Deep inspection of response structure
    if (response.data) {
      console.log('[Fetch] 🔍 Response structure analysis:');
      console.log('  - Top-level keys:', Object.keys(response.data));
      
      if (response.data.records) {
        console.log('  - records found!');
        console.log('  - records keys:', Object.keys(response.data.records));
        
        if (response.data.records.data) {
          console.log('  - records.data is array:', Array.isArray(response.data.records.data));
          console.log('  - records.data length:', response.data.records.data?.length);
        }
        
        if (response.data.records.underlyingValue) {
          console.log('  - Spot Price:', response.data.records.underlyingValue);
        }
      }
      
      // Log first 500 chars of response
      const preview = JSON.stringify(response.data, null, 2).substring(0, 500);
      console.log('\n[Fetch] 📄 Response preview:\n', preview);
      console.log('  ... (truncated)\n');
    }

    // Validate response - accept multiple formats
    const isValid = response.data && (
      response.data.records || 
      response.data.data || 
      response.data.filtered ||
      (typeof response.data === 'object' && Object.keys(response.data).length > 0)
    );

    if (isValid) {
      cachedData = response.data;
      lastFetchTime = Date.now();
      retryCount = 0;
      
      const spotPrice = response.data.records?.underlyingValue || 
                       response.data.underlyingValue || 
                       'Unknown';
      console.log('[Fetch] ✅ Data received successfully!');
      console.log('[Fetch] 💹 Spot Price:', spotPrice);
      
      return response.data;
    } else {
      console.error('[Fetch] ❌ Response validation failed');
      console.error('[Fetch] Response data:', response.data);
      throw new Error('Invalid response structure from NSE');
    }

  } catch (error) {
    console.error('\n[Fetch] ❌ ERROR:', error.message);
    
    if (error.response) {
      console.error('[Fetch] Status:', error.response.status);
      console.error('[Fetch] Status Text:', error.response.statusText);
      
      if (error.response.status === 401 || error.response.status === 403) {
        cookies = '';
        
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`[Fetch] 🔄 Retry ${retryCount}/${MAX_RETRIES} in ${retryCount * 2}s...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          return fetchOptionChain();
        }
      }
    }

    if (cachedData) {
      console.log('[Fetch] ⚠️ Returning stale cached data');
      return { ...cachedData, stale: true };
    }

    throw error;
  }
}

// Debug endpoint
app.get('/debug', async (req, res) => {
  try {
    console.log('\n[DEBUG] Manual debug request received');
    
    if (!cookies) {
      await initSession();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    const response = await axios.get(OPTION_CHAIN_URL, {
      headers: getHeaders(),
      timeout: 15000,
      validateStatus: () => true,
    });
    
    res.json({
      status: response.status,
      statusText: response.statusText,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      topLevelKeys: response.data ? Object.keys(response.data) : [],
      hasCookies: !!cookies,
      cookieLength: cookies.length,
      dataPreview: JSON.stringify(response.data).substring(0, 2000),
      fullData: response.data,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasCache: !!cachedData,
    hasCookies: !!cookies,
    lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
  });
});

// Main endpoint
app.get('/chain', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json(data);
  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(503).json({
      error: 'Failed to fetch option chain data',
      message: error.message,
      suggestion: 'Check console logs or visit /debug endpoint',
    });
  }
});

// Expiries
app.get('/expiries', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json({
      expiryDates: data.records?.expiryDates || [],
    });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// Spot price
app.get('/spot', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json({
      underlyingValue: data.records?.underlyingValue || data.underlyingValue,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       NIFTY Options Chain Backend (Debug Mode)            ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                            ║
║                                                           ║
║  Endpoints:                                               ║
║    GET /chain    - Option chain data                      ║
║    GET /debug    - Detailed diagnostics                   ║
║    GET /health   - Health check                           ║
║    GET /spot     - Spot price                             ║
║                                                           ║
║  📊 Check console for detailed logging                    ║
║  📁 Raw responses saved to nse_response.json              ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  console.log('\n[Startup] 🚀 Initializing...\n');
  
  await initSession();
  
  try {
    await fetchOptionChain();
    console.log('\n[Startup] ✅ Server ready!\n');
  } catch (error) {
    console.error('\n[Startup] ⚠️ Initial fetch failed:', error.message);
    console.log('[Startup] 💡 Server running - try /debug endpoint\n');
  }
});

process.on('SIGINT', () => {
  console.log('\n[Server] 👋 Shutting down...');
  process.exit(0);
});
