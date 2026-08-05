import { describe, expect, it, vi } from 'vitest';
import { encodePacked } from 'viem';

vi.mock('../wagmi.js', () => ({
  UNISWAP: {
    1: {
      name: 'Test',
      factory: '0x00000000000000000000000000000000000000F1',
      swapRouter: '0x00000000000000000000000000000000000000F2',
      quoterV2: '0x00000000000000000000000000000000000000F3',
      weth: '0x00000000000000000000000000000000000000F4',
    },
  },
}));

import {
  applySlippage,
  buildFeePath,
  deadlineFromNow,
  formatRate,
  formatTokenAmount,
  getBestQuote,
  isNative,
} from './swap.js';

const ONE_ETH = 1000000000000000000n;
const ONE_USDC = 1000000n;

describe('isNative', () => {
  it('returns true for native tokens (address null)', () => {
    expect(isNative({ address: null })).toBe(true);
  });

  it('returns false for wrapped/erc20 tokens', () => {
    expect(isNative({ address: '0x4200' })).toBe(false);
  });
});

describe('formatTokenAmount', () => {
  it('formats whole amounts', () => {
    expect(formatTokenAmount(ONE_ETH, 18)).toBe('1');
    expect(formatTokenAmount(25n * ONE_USDC, 6)).toBe('25');
  });

  it('trims trailing zeros in the fraction', () => {
    expect(formatTokenAmount(25000100n, 6)).toBe('25.0001');
    expect(formatTokenAmount(25000000n, 6)).toBe('25');
  });

  it('caps the fraction at maxDigits', () => {
    expect(formatTokenAmount(123456789n, 9, 6)).toBe('0.123456');
  });

  it('shows zero when the fraction is below maxDigits precision', () => {
    expect(formatTokenAmount(123456789n, 18, 6)).toBe('0');
  });

  it('handles zero', () => {
    expect(formatTokenAmount(0n, 18)).toBe('0');
  });
});

describe('formatRate', () => {
  it('computes 1 ETH = 3,412.35 USDC', () => {
    const amountOut = 3412350000n; // 3412.35 USDC (6 decimals)
    const rate = formatRate(amountOut, 6, ONE_ETH, 18);
    expect(rate).toBe('3,412.35');
  });

  it('computes tiny rates without rounding to zero', () => {
    const amountOut = 293000000000000n; // 0.000293 ETH (18 decimals)
    const rate = formatRate(amountOut, 18, ONE_USDC, 6);
    expect(rate.startsWith('0.000293')).toBe(true);
  });

  it('returns zero when input amount is zero', () => {
    expect(formatRate(1000000n, 6, 0n, 6)).toBe('0');
  });
});

describe('applySlippage', () => {
  it('reduces the output by the configured basis points', () => {
    expect(applySlippage(1000000n, 50)).toBe(995000n);
    expect(applySlippage(1000000n, 10)).toBe(999000n);
    expect(applySlippage(1000000n, 100)).toBe(990000n);
  });
});

describe('deadlineFromNow', () => {
  it('returns a timestamp roughly now plus the given seconds', () => {
    const before = BigInt(Math.floor(Date.now() / 1000)) + 1199n;
    const deadline = deadlineFromNow(1200);
    const after = BigInt(Math.floor(Date.now() / 1000)) + 1201n;
    expect(deadline >= before && deadline <= after).toBe(true);
  });
});

describe('buildFeePath', () => {
  const A = '0x1111111111111111111111111111111111111111';
  const B = '0x2222222222222222222222222222222222222222';
  const W = '0x3333333333333333333333333333333333333333';

  it('encodes a direct pool path (address + fee + address)', () => {
    const path = buildFeePath([A, B], [3000]);
    expect(path).toBe(encodePacked(['address', 'uint24', 'address'], [A, 3000, B]));
  });

  it('encodes a two-hop path (address + fee + address + fee + address)', () => {
    const path = buildFeePath([A, W, B], [500, 500]);
    expect(path).toBe(
      encodePacked(['address', 'uint24', 'address', 'uint24', 'address'], [A, 500, W, 500, B]),
    );
  });
});

describe('getBestQuote', () => {
  const weth = '0x00000000000000000000000000000000000000F4';
  const usdc = '0x4444444444444444444444444444444444444444';

  it('quotes through existing pools and picks the best output', async () => {
    const quoteMultiplier = 3n;
    const client = {
      readContract: vi.fn(async ({ functionName }) => {
        if (functionName === 'getPool') {
          return '0x00000000000000000000000000000000000000AA';
        }
        if (functionName === 'quoteExactInput') {
          return [ONE_ETH * quoteMultiplier];
        }
        return null;
      }),
    };

    const tokenIn = { symbol: 'ETH', address: null, decimals: 18 };
    const tokenOut = { symbol: 'USDC', address: usdc, decimals: 6 };

    const result = await getBestQuote(client, 1, tokenIn, tokenOut, ONE_ETH);

    expect(result).not.toBeNull();
    expect(result.output).toBe(ONE_ETH * quoteMultiplier);
    expect(result.hops).toBe(1);
    expect(result.inIsNative).toBe(true);
    expect(result.outIsNative).toBe(false);
    expect(result.addresses[0]).toBe(weth);
  });

  it('returns null when no pools exist', async () => {
    const client = {
      readContract: vi.fn(async () => '0x0000000000000000000000000000000000000000'),
    };
    const tokenIn = { symbol: 'USDC', address: usdc, decimals: 6 };
    const tokenOut = { symbol: 'WETH', address: weth, decimals: 18 };

    const result = await getBestQuote(client, 1, tokenIn, tokenOut, ONE_USDC);
    expect(result).toBeNull();
  });
});
