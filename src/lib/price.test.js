import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  COINGECKO_IDS,
  formatPercent,
  formatUsd,
  getCoinGeckoId,
  getMarketChart,
  getPrices,
} from './price.js';

describe('getCoinGeckoId', () => {
  it('maps known symbols', () => {
    expect(getCoinGeckoId('ETH')).toBe('ethereum');
    expect(getCoinGeckoId('USDC')).toBe('usd-coin');
    expect(getCoinGeckoId('cbBTC')).toBe('coinbase-wrapped-btc');
  });

  it('returns null for unknown symbols', () => {
    expect(getCoinGeckoId('NOPE')).toBeNull();
  });
});

describe('getPrices', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches prices in a single batch and maps by symbol', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: 1900.5 }, 'usd-coin': { usd: 1 } }),
      }),
    );
    const prices = await getPrices(['ETH', 'USDC']);
    expect(prices.ETH).toBe(1900.5);
    expect(prices.USDC).toBe(1);
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('ethereum');
    expect(calledUrl).toContain('usd-coin');
  });

  it('skips symbols without a CoinGecko id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const prices = await getPrices(['UNKNOWN', 'MISSING']);
    expect(prices).toEqual({});
  });

  it('throws when the API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(getPrices(['ETH'])).rejects.toThrow();
  });
});

describe('getMarketChart', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns normalized {t,p} points', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prices: [
            [1000, 1.5],
            [2000, 1.6],
          ],
        }),
      }),
    );
    const points = await getMarketChart('ETH', 7);
    expect(points).toEqual([
      { t: 1000, p: 1.5 },
      { t: 2000, p: 1.6 },
    ]);
  });

  it('rejects unknown symbols', async () => {
    await expect(getMarketChart('NOPE', 7)).rejects.toThrow();
  });

  it('throws on empty chart data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ prices: [] }) }),
    );
    await expect(getMarketChart('ETH', 30)).rejects.toThrow();
  });
});

describe('formatUsd', () => {
  it('formats large values with two decimals', () => {
    expect(formatUsd(64174)).toBe('$64,174.00');
  });

  it('formats very large values without decimals', () => {
    expect(formatUsd(2500000)).toBe('$2,500,000');
  });

  it('formats typical prices with two decimals', () => {
    expect(formatUsd(1869.95)).toBe('$1,869.95');
  });

  it('shows tiny prices precisely', () => {
    expect(formatUsd(0.00000285)).toBe('$0.00000285');
  });

  it('handles missing values', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('adds a plus sign for gains', () => {
    expect(formatPercent(2.5)).toBe('+2.50%');
  });

  it('keeps a minus for losses', () => {
    expect(formatPercent(-3.14)).toBe('-3.14%');
  });
});

describe('COINGECKO_IDS coverage', () => {
  it('covers every token symbol used in the app', () => {
    const needed = [
      'ETH',
      'WETH',
      'USDC',
      'USDT',
      'DAI',
      'cbBTC',
      'AERO',
      'BRETT',
      'DEGEN',
      'WBTC',
      'ARB',
      'UNI',
      'PEPE',
      'GMX',
      'MAGIC',
      'PENDLE',
      'USDe',
    ];
    for (const s of needed) {
      expect(COINGECKO_IDS[s], `missing id for ${s}`).toBeTruthy();
    }
  });
});
