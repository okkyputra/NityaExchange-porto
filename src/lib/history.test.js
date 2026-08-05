import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { addSwap, clearHistory, getSwaps, removeSwap } from './history.js';

function storageMock() {
  let store = {};
  return {
    getItem: vi.fn((k) => (k in store ? store[k] : null)),
    setItem: vi.fn((k, v) => {
      store[k] = String(v);
    }),
    removeItem: vi.fn((k) => delete store[k]),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

describe('swap history (localStorage)', () => {
  let original;

  beforeEach(() => {
    original = global.localStorage;
    global.localStorage = storageMock();
  });

  afterEach(() => {
    global.localStorage = original;
  });

  it('starts empty', () => {
    expect(getSwaps()).toEqual([]);
  });

  it('prepends new swaps and caps at 50 entries', () => {
    for (let i = 0; i < 60; i += 1) {
      addSwap({ txHash: `0x${i}`, fromSymbol: 'ETH', toSymbol: 'USDC', timestamp: i });
    }
    const swaps = getSwaps();
    expect(swaps).toHaveLength(50);
    expect(swaps[0].txHash).toBe('0x59');
    expect(swaps[0].id).toBeTruthy();
  });

  it('persists entries across calls', () => {
    addSwap({ txHash: '0xabc', fromSymbol: 'USDC', toSymbol: 'ETH', timestamp: 1 });
    expect(getSwaps()[0].fromSymbol).toBe('USDC');
    expect(getSwaps()[0].toSymbol).toBe('ETH');
  });

  it('removes a single swap by id', () => {
    addSwap({ txHash: '0xa' });
    const latest = addSwap({ txHash: '0xb' })[0];
    expect(getSwaps()).toHaveLength(2);
    removeSwap(latest.id);
    const swaps = getSwaps();
    expect(swaps).toHaveLength(1);
    expect(swaps[0].txHash).toBe('0xb');
  });

  it('clears all history', () => {
    addSwap({ txHash: '0xa' });
    clearHistory();
    expect(getSwaps()).toEqual([]);
  });

  it('tolerates corrupted storage', () => {
    global.localStorage.getItem.mockReturnValue('not json{');
    expect(getSwaps()).toEqual([]);
  });
});
