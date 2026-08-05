export const COINGECKO_IDS = {
  ETH: 'ethereum',
  WETH: 'weth',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  cbBTC: 'coinbase-wrapped-btc',
  AERO: 'aerodrome-finance',
  BRETT: 'based-brett',
  DEGEN: 'degen-base',
  WBTC: 'wrapped-bitcoin',
  ARB: 'arbitrum',
  UNI: 'uniswap',
  PEPE: 'pepe',
  GMX: 'gmx',
  MAGIC: 'magic',
  PENDLE: 'pendle',
  USDe: 'ethena-usde',
};

const CACHE_TTL_MS = 60_000;
const pricesCache = new Map();
const chartCache = new Map();

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`price API ${res.status}`);
  return res.json();
}

export function getCoinGeckoId(symbol) {
  return COINGECKO_IDS[symbol] || null;
}

export async function getPrices(symbols) {
  const unique = [...new Set(symbols)].filter((s) => COINGECKO_IDS[s]);
  if (!unique.length) return {};
  const ids = unique.map((s) => COINGECKO_IDS[s]);
  const key = ids.sort().join(',');
  const cached = pricesCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`,
  );
  const bySymbol = {};
  for (const symbol of unique) {
    const usd = data[COINGECKO_IDS[symbol]]?.usd;
    if (usd != null) bySymbol[symbol] = usd;
  }
  pricesCache.set(key, { at: Date.now(), value: bySymbol });
  return bySymbol;
}

export async function getMarketChart(symbol, days = 7) {
  const id = COINGECKO_IDS[symbol];
  if (!id) throw new Error(`no CoinGecko id for ${symbol}`);
  const key = `${symbol}:${days}`;
  const cached = chartCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
  );
  const points = (data.prices || []).map(([t, p]) => ({ t, p }));
  if (!points.length) throw new Error('empty chart data');
  chartCache.set(key, { at: Date.now(), value: points });
  return points;
}

export function formatUsd(value) {
  if (value == null || Number.isNaN(value)) return '—';
  if (value >= 1000) return `$${Math.round(value).toLocaleString('en-US')}`;
  if (value >= 1) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 8 })}`;
}

export function formatCompactUsd(value) {
  if (value == null || Number.isNaN(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return formatUsd(value);
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
