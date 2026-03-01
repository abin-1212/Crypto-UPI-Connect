/**
 * ═══════════════════════════════════════════════════════════
 *  CONVERGEX — Currency Conversion Utility (Live CoinGecko)
 * ═══════════════════════════════════════════════════════════
 *
 *  Fetches LIVE exchange rates from CoinGecko API.
 *  Caches rates for 60 seconds to avoid hitting rate limits.
 *  Falls back to static rates if the API is unreachable.
 *
 *  All monetary results are rounded to 6 decimal places.
 * ═══════════════════════════════════════════════════════════
 */

// ─── CoinGecko token ID mapping ──────────────────────────
const COINGECKO_IDS = {
  USDC: "usd-coin",
  DAI: "dai",
  ETH: "ethereum",
  BTC: "bitcoin",
};

// ─── Fallback rates (used only if CoinGecko is down) ─────
const FALLBACK_RATES = {
  USDC: 90,
  DAI: 90,
  ETH: 200000,
  BTC: 6500000,
};

const SUPPORTED_TOKENS = Object.keys(COINGECKO_IDS);

// ─── In-memory cache ─────────────────────────────────────
let cachedRates = { ...FALLBACK_RATES };
let cachedMarketData = {}; // Full market data with 24h change, volume, etc.
let lastFetchTime = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds
let isFetching = false;

/**
 * Fetch live rates + market data from CoinGecko and update cache.
 */
async function refreshRates() {
  if (isFetching) return;
  isFetching = true;

  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr,usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_last_updated_at=true`;

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);

    const data = await response.json();

    const newRates = {};
    const newMarketData = {};

    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      const d = data[geckoId];
      if (d?.inr) {
        newRates[symbol] = d.inr;
        newMarketData[symbol] = {
          inr: d.inr,
          usd: d.usd || null,
          change24h: d.inr_24h_change ? parseFloat(d.inr_24h_change.toFixed(2)) : 0,
          volume24h: d.inr_24h_vol ? Math.round(d.inr_24h_vol) : 0,
          marketCap: d.inr_market_cap ? Math.round(d.inr_market_cap) : 0,
          lastUpdated: d.last_updated_at ? new Date(d.last_updated_at * 1000).toISOString() : null,
        };
      } else {
        newRates[symbol] = cachedRates[symbol] || FALLBACK_RATES[symbol];
        newMarketData[symbol] = cachedMarketData[symbol] || { inr: FALLBACK_RATES[symbol], change24h: 0, volume24h: 0, marketCap: 0 };
      }
    }

    cachedRates = newRates;
    cachedMarketData = newMarketData;
    lastFetchTime = Date.now();
    console.log("📡 Live rates updated:", cachedRates);
  } catch (error) {
    console.warn("⚠️ CoinGecko fetch failed, using cached/fallback rates:", error.message);
  } finally {
    isFetching = false;
  }
}

/**
 * Ensure rates are fresh (auto-refresh if cache expired).
 */
async function ensureFreshRates() {
  if (Date.now() - lastFetchTime > CACHE_TTL_MS) {
    await refreshRates();
  }
}

// ─── Initial fetch on server start ───────────────────────
refreshRates();

/**
 * Get the current exchange rate for a given token.
 * Returns cached rate (refreshed every 60s from CoinGecko).
 *
 * @param   {string} token  — Token symbol (case-insensitive)
 * @returns {number}        — 1 token in INR (live rate)
 * @throws  {Error}         — If token is not supported
 */
export const getExchangeRate = (token) => {
  const key = token.toUpperCase().trim();

  if (!SUPPORTED_TOKENS.includes(key)) {
    throw new Error(
      `Unsupported token "${token}". Supported: ${SUPPORTED_TOKENS.join(", ")}`
    );
  }

  // Trigger background refresh if stale (non-blocking)
  if (Date.now() - lastFetchTime > CACHE_TTL_MS) {
    refreshRates();
  }

  return cachedRates[key];
};

/**
 * Get the current exchange rate (async version — waits for fresh data).
 */
export const getExchangeRateAsync = async (token) => {
  await ensureFreshRates();
  return getExchangeRate(token);
};

/**
 * Convert a crypto amount to its INR equivalent.
 */
export const cryptoToInr = (token, cryptoAmount) => {
  const amount = Number(cryptoAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("cryptoAmount must be a positive number");
  }

  const rate = getExchangeRate(token);
  return parseFloat((amount * rate).toFixed(6));
};

/**
 * Convert an INR amount to its crypto equivalent.
 */
export const inrToCrypto = (token, inrAmount) => {
  const amount = Number(inrAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("inrAmount must be a positive number");
  }

  const rate = getExchangeRate(token);
  return parseFloat((amount / rate).toFixed(6));
};

/**
 * @returns {string[]} — List of all supported token symbols
 */
export const getSupportedTokens = () => [...SUPPORTED_TOKENS];

/**
 * @returns {Object} — Current rate map { TOKEN: inrRate, ... }
 */
export const getAllRates = () => ({ ...cachedRates });

/**
 * Force-refresh rates from CoinGecko (for the /rates endpoint).
 */
export const forceRefreshRates = async () => {
  await refreshRates();
  return { ...cachedRates };
};

/**
 * Get full market data (rates + 24h change, volume, market cap).
 */
export const getMarketData = () => ({ ...cachedMarketData });

export default {
  getExchangeRate,
  getExchangeRateAsync,
  cryptoToInr,
  inrToCrypto,
  getSupportedTokens,
  getAllRates,
  forceRefreshRates,
  getMarketData,
};
