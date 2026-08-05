import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseUnits } from 'viem';

vi.mock('./bridge.js', () => ({
  getAvailableRoutes: vi.fn(),
  getSuggestedFees: vi.fn(),
}));

vi.mock('./swap.js', () => ({
  getBestQuote: vi.fn(),
}));

import { planCrossChain, findToken } from './crosschain.js';
import { getAvailableRoutes, getSuggestedFees } from './bridge.js';
import { getBestQuote } from './swap.js';

const client = {};
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const WETH_BASE = '0x4200000000000000000000000000000000000006';

function usdcRoutes() {
  return [
    { originChainId: 8453, originToken: USDC_BASE, originTokenSymbol: 'USDC' },
    { originChainId: 8453, originToken: WETH_BASE, originTokenSymbol: 'WETH' },
  ];
}

function fakeQuote(input) {
  return {
    addresses: [input.address],
    fees: [3000],
    feePath: '0x',
    output: 10000000n,
    hops: 1,
    inIsNative: false,
    outIsNative: false,
  };
}

function fakeBridgeQuote() {
  return {
    inputAmount: 10000000n,
    outputAmount: 9990000n,
    relayFeeTotal: 10000n,
    estimatedFillTimeSec: 60,
    quoteTimestamp: 1785918371,
    fillDeadline: 1785925571,
    exclusivityDeadline: 3,
    exclusiveRelayer: '0xrelayer',
    spokePoolAddress: '0xspoke',
    destinationSpokePoolAddress: '0xdspoke',
    inputToken: { address: USDC_BASE, symbol: 'USDC', decimals: 6, chainId: 8453 },
    outputToken: { address: USDC_ARB, symbol: 'USDC', decimals: 6, chainId: 42161 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAvailableRoutes.mockResolvedValue(usdcRoutes());
  getSuggestedFees.mockImplementation(fakeBridgeQuote);
});

describe('findToken', () => {
  it('looks up a token on a chain', () => {
    expect(findToken(8453, 'USDC').address).toBe(USDC_BASE);
    expect(findToken(42161, 'USDC').address).toBe(USDC_ARB);
    expect(findToken(8453, 'MISSING')).toBeNull();
  });
});

describe('planCrossChain', () => {
  it('returns sameChain for a single network', async () => {
    const route = await planCrossChain({
      publicClientFrom: client,
      publicClientTo: client,
      fromChainId: 8453,
      toChainId: 8453,
      fromToken: findToken(8453, 'ETH'),
      toToken: findToken(8453, 'USDC'),
      amountIn: parseUnits('0.01', 18),
    });
    expect(route.sameChain).toBe(true);
  });

  it('returns an error when no bridge asset is available', async () => {
    getAvailableRoutes.mockResolvedValue([]);
    const route = await planCrossChain({
      publicClientFrom: client,
      publicClientTo: client,
      fromChainId: 8453,
      toChainId: 42161,
      fromToken: findToken(8453, 'ETH'),
      toToken: findToken(42161, 'UNI'),
      amountIn: parseUnits('0.01', 18),
    });
    expect(route.error).toContain('No bridge route');
  });

  it('builds a full swap -> bridge -> swap route', async () => {
    getBestQuote.mockImplementation((_c, chainId, inTok, outTok) => fakeQuote(outTok));
    const route = await planCrossChain({
      publicClientFrom: client,
      publicClientTo: client,
      fromChainId: 8453,
      toChainId: 42161,
      fromToken: findToken(8453, 'ETH'),
      toToken: findToken(42161, 'UNI'),
      amountIn: parseUnits('0.01', 18),
    });
    expect(route.sameChain).toBeFalsy();
    expect(route.bridgeAsset.from.symbol).toBe('USDC');
    expect(route.bridgeAsset.to.symbol).toBe('USDC');
    expect(route.legIn).toBeTruthy();
    expect(route.legOut).toBeTruthy();
    expect(route.bridgeIn).toBe(10000000n);
    expect(route.bridgeOut).toBe(9990000n);
    expect(route.finalOut).toBe(10000000n);
    expect(route.relayFeeTotal).toBe(10000n);
    expect(route.estimatedFillTimeSec).toBe(60);
  });

  it('bridges directly when the source token is the bridge asset', async () => {
    const route = await planCrossChain({
      publicClientFrom: client,
      publicClientTo: client,
      fromChainId: 8453,
      toChainId: 42161,
      fromToken: findToken(8453, 'USDC'),
      toToken: findToken(42161, 'USDC'),
      amountIn: parseUnits('100', 6),
    });
    expect(route.legIn).toBeNull();
    expect(route.legOut).toBeNull();
    expect(route.bridgeIn).toBe(parseUnits('100', 6));
    expect(route.finalOut).toBe(9990000n);
  });

  it('swaps on the destination only when the target differs from the bridge asset', async () => {
    getBestQuote.mockImplementation((_c, chainId, inTok, outTok) => fakeQuote(outTok));
    const route = await planCrossChain({
      publicClientFrom: client,
      publicClientTo: client,
      fromChainId: 8453,
      toChainId: 42161,
      fromToken: findToken(8453, 'USDC'),
      toToken: findToken(42161, 'ETH'),
      amountIn: parseUnits('100', 6),
    });
    expect(route.legIn).toBeNull();
    expect(route.legOut).toBeTruthy();
    expect(route.legOut.symbol).toBe('USDC');
  });
});
