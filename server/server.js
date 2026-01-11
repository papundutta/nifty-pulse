/**
 * NIFTY Options Chain Backend Server (Anti-Bot Enhanced)
 * 
 * This version uses better techniques to bypass NSE's bot detection:
 * - Proper session flow with delays
 * - Complete browser-like headers
 * - Cookie persistence
 * - Retry with exponential backoff
 * 
 * Alternative: If this still fails, consider using Puppeteer or a proxy service
 * 
 * Usage:
 * 1. Install: npm install express axios cors tough-cookie
 * 2. Run: node server.js
 * 3. If still getting 403, you may need to use a headless browser approach
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(express.json());

// Create axios instance with cookie jar
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const NSE_BASE_URL = 'https://www.nseindia.com';
const OPTION_CHAIN_URL = `${NSE_BASE_URL}/api/option-chain-indices?symbol=NIFTY`;

let cachedData = null;
let lastFetchTime = null;
let sessionInitialized = false;
let retryCount = 0;
const MAX_RETRIES = 3;
const CACHE_DURATION = 5000;

// More complete browser headers
const getBrowserHeaders = (isAPI = false) => {
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': isAPI ? 'empty' : 'document',
    'Sec-Fetch-Mode': isAPI ? 'cors' : 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };

  if (isAPI) {
    return {
      ...baseHeaders,
      'Accept': '*/*',
      'Referer': 'https://www.nseindia.com/option-chain',
      'X-Requested-With': 'XMLHttpRequest',
    };
  } else {
    return {
      ...baseHeaders,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };
  }
};

/**
 * Initialize session with proper browser flow
 */
async function initSession() {
  try {
    console.log('\n[Session] 🌐 Starting browser-like session initialization...');
    
    // Step 1: Visit homepage
    console.log('[Session] 📍 Step 1/3: Visiting NSE homepage...');
    await client.get(NSE_BASE_URL, {
      headers: getBrowserHeaders(false),
      timeout: 15000,
      maxRedirects: 5,
    });
    
    console.log('[Session] ⏳ Waiting 2 seconds (simulating human behavior)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Visit option chain page
    console.log('[Session] 📍 Step 2/3: Visiting option chain page...');
    await client.get(`${NSE_BASE_URL}/option-chain`, {
      headers: getBrowserHeaders(false),
      timeout: 15000,
    });
    
    console.log('[Session] ⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Visit get quotes (sometimes needed)
    console.log('[Session] 📍 Step 3/3: Additional page visit...');
    await client.get(`${NSE_BASE_URL}/get-quotes/equity?symbol=SBIN`, {
      headers: getBrowserHeaders(false),
      timeout: 15000,
    }).catch(() => {}); // Ignore errors on this one
    
    console.log('[Session] ⏳ Waiting 1 second...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const cookies = jar.getCookiesSync(NSE_BASE_URL);
    console.log('[Session] 🍪 Cookies obtained:', cookies.length, 'cookies');
    
    if (cookies.length > 0) {
      console.log('[Session] ✅ Session initialized successfully!');
      sessionInitialized = true;
      retryCount = 0;
      return true;
    } else {
      console.log('[Session] ⚠️ No cookies received');
      return false;
    }
    
  } catch (error) {
    console.error('[Session] ❌ Failed:', error.message);
    if (error.response) {
      console.error('[Session] Status:', error.response.status);
      console.error('[Session] Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return false;
  }
}

/**
 * Fetch option chain data
 */
async function fetchOptionChain() {
  // Return cached data if fresh
  if (cachedData && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
    console.log('[Fetch] ⚡ Returning cached data');
    return cachedData;
  }

  try {
    // Initialize session if needed
    if (!sessionInitialized) {
      console.log('[Fetch] 🔐 Session not initialized, initializing...');
      const success = await initSession();
      if (!success) {
        throw new Error('Failed to initialize session with NSE');
      }
    }

    console.log('\n[Fetch] 📡 Fetching option chain data...');
    
    const response = await client.get(OPTION_CHAIN_URL, {
      headers: getBrowserHeaders(true),
      timeout: 20000,
      validateStatus: () => true,
    });

    console.log('[Fetch] 📊 Response Status:', response.status);

    // Handle different status codes
    if (response.status === 403 || response.status === 401) {
      console.log('[Fetch] 🔒 Access denied, resetting session...');
      sessionInitialized = false;
      
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(retryCount * 3000, 10000);
        console.log(`[Fetch] 🔄 Retry ${retryCount}/${MAX_RETRIES} in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchOptionChain();
      }
      
      throw new Error('Access denied by NSE - possible IP block or bot detection');
    }

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Validate response
    if (!response.data) {
      throw new Error('Empty response from NSE');
    }

    console.log('[Fetch] 🔍 Data keys:', Object.keys(response.data));

    // Check for valid data structure
    if (response.data.records || response.data.data) {
      cachedData = response.data;
      lastFetchTime = Date.now();
      retryCount = 0;
      
      const spot = response.data.records?.underlyingValue || 'N/A';
      console.log('[Fetch] ✅ Success! Spot:', spot);
      
      return response.data;
    } else {
      console.error('[Fetch] ⚠️ Unexpected structure:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Invalid response structure');
    }

  } catch (error) {
    console.error('[Fetch] ❌ Error:', error.message);
    
    if (cachedData) {
      console.log('[Fetch] 📦 Returning stale cache');
      return { ...cachedData, stale: true };
    }
    
    throw error;
  }
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessionInitialized,
    hasCache: !!cachedData,
    lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    cookies: jar.getCookiesSync(NSE_BASE_URL).length,
  });
});

// Debug endpoint
app.get('/debug', async (req, res) => {
  try {
    if (!sessionInitialized) {
      await initSession();
    }
    
    const response = await client.get(OPTION_CHAIN_URL, {
      headers: getBrowserHeaders(true),
      timeout: 20000,
      validateStatus: () => true,
    });
    
    res.json({
      status: response.status,
      cookies: jar.getCookiesSync(NSE_BASE_URL).length,
      dataKeys: response.data ? Object.keys(response.data) : [],
      preview: JSON.stringify(response.data).substring(0, 1000),
      fullData: response.data,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

// Main endpoint
app.get('/chain', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json(data);
  } catch (error) {
    res.status(503).json({
      error: error.message,
      suggestion: 'NSE may be blocking automated requests. Consider using a proxy or Puppeteer.',
    });
  }
});

// Expiries
app.get('/expiries', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json({ expiryDates: data.records?.expiryDates || [] });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// Spot
app.get('/spot', async (req, res) => {
  try {
    const data = await fetchOptionChain();
    res.json({
      underlyingValue: data.records?.underlyingValue,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       NIFTY Options Chain Backend Server                  ║
╠═══════════════════════════════════════════════════════════╣
║  🌐 Server: http://localhost:${PORT}                         ║
║                                                           ║
║  📌 Endpoints:                                            ║
║     GET /chain    - Option chain data                     ║
║     GET /health   - Server status                         ║
║     GET /debug    - Diagnostics                           ║
║                                                           ║
║  ⚠️  NOTE: NSE has strong bot protection                  ║
║     If you get 403 errors, you may need:                  ║
║     - VPN/Proxy from India                                ║
║     - Puppeteer-based solution                            ║
║     - Official NSE data provider                          ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  console.log('[Startup] 🚀 Attempting initial fetch...\n');
  
  try {
    await fetchOptionChain();
    console.log('\n[Startup] ✅ Server ready and working!\n');
  } catch (error) {
    console.error('\n[Startup] ❌ Initial fetch failed');
    console.error('[Startup] 💡 This is common with NSE\'s bot protection');
    console.error('[Startup] 💡 The server is running - API calls may still work\n');
  }
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});
