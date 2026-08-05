import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import History from './History.jsx';

vi.mock('../wagmi', () => ({
  EXPLORER_URLS: { 8453: 'https://basescan.org', 42161: 'https://arbiscan.io' },
  UNISWAP: { 8453: { name: 'Base' }, 42161: { name: 'Arbitrum' } },
}));

const historyMock = vi.hoisted(() => ({ getSwaps: vi.fn(), clearHistory: vi.fn() }));
vi.mock('../lib/history', () => historyMock);

describe('History', () => {
  beforeEach(() => {
    historyMock.getSwaps.mockReset();
    historyMock.clearHistory.mockReset();
  });

  it('shows an empty state when there are no swaps', () => {
    historyMock.getSwaps.mockReturnValue([]);
    render(<History />);
    expect(screen.getByText(/No swaps yet/)).toBeInTheDocument();
  });

  it('renders recorded swaps with amounts and a confirmed badge', () => {
    historyMock.getSwaps.mockReturnValue([
      {
        id: '1',
        chainId: 8453,
        txHash: '0xabc',
        fromSymbol: 'ETH',
        toSymbol: 'USDC',
        amountIn: '0.01',
        amountOut: '18.67',
        timestamp: Date.now() - 60_000,
      },
    ]);
    render(<History />);
    expect(screen.getByText('0.01 ETH → 18.67 USDC')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Base ·/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'View' });
    expect(link.getAttribute('href')).toBe('https://basescan.org/tx/0xabc');
  });

  it('clears history when the clear button is pressed', () => {
    historyMock.getSwaps.mockReturnValue([
      {
        id: '1',
        chainId: 8453,
        txHash: '0xabc',
        fromSymbol: 'ETH',
        toSymbol: 'USDC',
        amountIn: '1',
        amountOut: '2',
        timestamp: 1,
      },
    ]);
    historyMock.clearHistory.mockReturnValue([]);
    render(<History />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(historyMock.clearHistory).toHaveBeenCalledTimes(1);
  });
});
