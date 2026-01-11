/**
 * NIFTY Options Chain Backend Server (Puppeteer Solution)
 * 
 * This version uses Puppeteer to bypass NSE's bot detection by using a real
 * Chrome browser instance. This is the most reliable method for scraping NSE data.
 * 
 * Features:
 * - Uses headless Chrome to appear as a real browser
 * - Automatic session management and cookie handling
 * - Page reuse to minimize resource usage
 * - Configurable polling interval
 * - Graceful error recovery
 * 
 * Installation:
 * 1. npm install express cors puppeteer
 * 2. node server.js
 * 
 * Note: First run will download Chromium (~170MB), please be patient
 */

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(express.json());

// Configuration
const NSE_OPTION_CHAIN_URL = 'https://www.nseindia.com/option-chain';
const CACHE_DURATION = 5000; // 5 seconds cache
const PAGE_TIMEOUT = 30000; // 30 seconds timeout

// State management
let browser = null;
let page = null;
let cachedData = null;
let lastFetchTime = null;
let isInitializing = false;
let browserReady = false;

/**
 * Initialize Puppeteer browser and page
 */
async function initBrowser() {
  if (isInitializing) {
    console.log('[Browser] ⏳ Already initializing, waiting...');
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return browserReady;
  }

  isInitializing = true;

  try {
    console.log('[Browser] 🚀 Launching Puppeteer browser...');
    
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    console.log('[Browser] ✅ Browser launched successfully');
    console.log('[Browser] 📄 Creating new page...');

    page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    });

    // Hide automation indicators
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    console.log('[Browser] 🌐 Navigating to NSE option chain page...');
    
    await page.goto(NSE_OPTION_CHAIN_URL, {
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT,
    });

    console.log('[Browser] ⏳ Waiting for page to fully load...');
    await page.waitForTimeout(3000);

    console.log('[Browser] ✅ Browser ready!');
    browserReady = true;
    isInitializing = false;
    return true;

  } catch (error) {
    console.error('[Browser] ❌ Failed to initialize:', error.message);
    isInitializing = false;
    browserReady = false;
    
    // Cleanup on failure
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    page = null;
    browser = null;
    
    return false;
  }
}

/**
 * Fetch option chain data using Puppeteer
 */
async function fetchOptionChain() {
  // Return cached data if fresh
  if (cachedData && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
    console.log('[Fetch] ⚡ Returning cached data');
    return cachedData;
  }

  try {
    // Initialize browser if needed
    if (!browserReady || !page) {
      console.log('[Fetch] 🔧 Browser not ready, initializing...');
      const success = await initBrowser();
      if (!success) {
        throw new Error('Failed to initialize browser');
      }
    }

    console.log('\n[Fetch] 📡 Fetching option chain data from NSE...');

    // Navigate to option chain page if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('option-chain')) {
      console.log('[Fetch] 🔄 Navigating to option chain page...');
      await page.goto(NSE_OPTION_CHAIN_URL, {
        waitUntil: 'networkidle2',
        timeout: PAGE_TIMEOUT,
      });
      await page.waitForTimeout(2000);
    }

    // Intercept the API call
    console.log('[Fetch] 🎣 Intercepting API response...');
    
    const data = await page.evaluate(async () => {
      try {
        // Fetch the API directly from the page context
        const response = await fetch(
          'https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY',
          {
            headers: {
              'Accept': '*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              'X-Requested-With': 'XMLHttpRequest',
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        throw new Error('Failed to fetch from page context: ' + error.message);
      }
    });

    // Validate data
    if (!data || (!data.records && !data.data)) {
      throw new Error('Invalid response structure');
    }

    cachedData = data;
    lastFetchTime = Date.now();

    const spot = data.records?.underlyingValue || 'N/A';
    const dataCount = data.records?.data?.length || 0;
    
    console.log('[Fetch] ✅ Success!');
    console.log('[Fetch] 💹 Spot Price:', spot);
    console.log('[Fetch] 📊 Data Points:', dataCount);

    return data;

  } catch (error) {
    console.error('[Fetch] ❌ Error:', error.message);

    // Try to recover by reinitializing browser
    if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
      console.log('[Fetch] 🔄 Browser session lost, reinitializing...');
      browserReady = false;
      await closeBrowser();
      
      // Retry once
      if (!isInitializing) {
        console.log('[Fetch] 🔄 Retrying after browser restart...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchOptionChain();
      }
    }

    // Return stale cache if available
    if (cachedData) {
      console.log('[Fetch] 📦 Returning stale cache');
      return { ...cachedData, stale: true };
    }

    throw error;
  }
}

/**
 * Close browser gracefully
 */
async function closeBrowser() {
  console.log('[Browser] 🔒 Closing browser...');
  browserReady = false;
  
  try {
    if (page) {
      await page.close();
      page = null;
    }
    if (browser) {
      await browser.close();
      browser = null;
    }
    console.log('[Browser] ✅ Browser closed');
  } catch (error) {
    console.error('[Browser] ⚠️ Error closing browser:', error.message);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    browserReady,
    hasCache: !!cachedData,
    lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    cacheAge: lastFetchTime ? Date.now() - lastFetchTime : null,
    uptime: process.uptime(),
  });
});

// Main option chain endpoint
app.get('/chain', async (req, res) => {
  try {
    const { expiry } = req.query;
    const data = await fetchOptionChain();
    
    // Filter by expiry if requested
    if (expiry && data.records?.data) {
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
      browserReady,
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
      timestamp: data.records?.timestamp || new Date().toISOString(),
      change: data.records?.change || 0,
      pChange: data.records?.pChange || 0,
    });
  } catch (error) {
    res.status(503).json({
      error: 'Failed to fetch spot price',
      message: error.message,
    });
  }
});

// Refresh browser endpoint (useful for debugging)
app.post('/refresh-browser', async (req, res) => {
  try {
    console.log('[API] Manual browser refresh requested');
    await closeBrowser();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const success = await initBrowser();
    res.json({
      success,
      message: success ? 'Browser refreshed successfully' : 'Failed to refresh browser',
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     NIFTY Options Chain Backend (Puppeteer Edition)       ║
╠═══════════════════════════════════════════════════════════╣
║  🌐 Server: http://localhost:${PORT}                         ║
║                                                           ║
║  📌 Endpoints:                                            ║
║     GET  /chain             - Full option chain data      ║
║     GET  /chain?expiry=...  - Filter by expiry date       ║
║     GET  /expiries          - Available expiry dates      ║
║     GET  /spot              - Current spot price          ║
║     GET  /health            - Server health status        ║
║     POST /refresh-browser   - Restart browser session     ║
║                                                           ║
║  🤖 Using Puppeteer with headless Chrome                  ║
║  ⚡ Auto-caching with 5s refresh interval                 ║
╚═══════════════════════════════════════════════════════════╝
  `);

  console.log('\n[Startup] 🚀 Initializing Puppeteer...\n');
  
  // Initialize browser on startup
  try {
    await initBrowser();
    console.log('\n[Startup] 📊 Fetching initial data...\n');
    await fetchOptionChain();
    console.log('\n[Startup] ✅ Server fully initialized and ready!\n');
  } catch (error) {
    console.error('\n[Startup] ⚠️ Initial setup failed:', error.message);
    console.log('[Startup] 💡 Server is running - browser will initialize on first request\n');
  }
});

// Graceful shutdown
async function shutdown() {
  console.log('\n[Server] 👋 Shutting down gracefully...');
  await closeBrowser();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('[Server] ⚠️ Unhandled rejection:', error.message);
});

process.on('uncaughtException', (error) => {
  console.error('[Server] ⚠️ Uncaught exception:', error.message);
});
