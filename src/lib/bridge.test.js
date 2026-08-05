import { describe, expect, it, vi, afterEach } from 'vitest';
import { getAvailableRoutes, getSuggestedFees } from './bridge.js';

describe('bridge.js (Across API)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getAvailableRoutes returns the route list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ originChainId: 8453, originTokenSymbol: 'USDC' }],
      }),
    );
    const routes = await getAvailableRoutes(8453, 42161);
    expect(routes).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toContain('/available-routes');
    expect(fetch.mock.calls[0][0]).toContain('originChainId=8453');
  });

  it('getSuggestedFees normalizes the quote into bigints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          timestamp: '1785918371',
          fillDeadline: '1785925571',
          relayFeeTotal: '5435',
          relayFeePct: '5429000000000000',
          capitalFeePct: '100000000000000',
          relayGasFeePct: '5329000000000000',
          exclusivityDeadline: 3,
          exclusiveRelayer: '0xabc',
          spokePoolAddress: '0xspoke',
          destinationSpokePoolAddress: '0xdspoke',
          estimatedFillTimeSec: 1,
          isAmountTooLow: false,
          outputAmount: '994565',
          inputToken: { address: '0xin', symbol: 'USDC', decimals: 6, chainId: 8453 },
          outputToken: { address: '0xout', symbol: 'USDC', decimals: 6, chainId: 42161 },
          limits: { minDeposit: '500177', maxDeposit: '388906705807' },
        }),
      }),
    );
    const q = await getSuggestedFees({
      originChainId: 8453,
      destinationChainId: 42161,
      token: '0xin',
      amount: 1000000n,
    });
    expect(q.inputAmount).toBe(1000000n);
    expect(q.outputAmount).toBe(994565n);
    expect(q.relayFeeTotal).toBe(5435n);
    expect(q.quoteTimestamp).toBe(1785918371);
    expect(q.fillDeadline).toBe(1785925571);
    expect(q.exclusiveRelayer).toBe('0xabc');
    expect(q.spokePoolAddress).toBe('0xspoke');
    expect(q.estimatedFillTimeSec).toBe(1);
  });

  it('throws on a failed API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      getSuggestedFees({ originChainId: 1, destinationChainId: 2, token: '0x', amount: 1n }),
    ).rejects.toThrow();
  });
});
