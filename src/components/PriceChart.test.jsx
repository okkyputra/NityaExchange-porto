import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PriceChart from './PriceChart.jsx';

vi.mock('wagmi', () => ({ useChainId: () => 8453 }));

const chartMock = vi.hoisted(() => ({ getMarketChart: vi.fn() }));
vi.mock('../lib/price', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getMarketChart: chartMock.getMarketChart };
});

vi.mock('./TokenIcon', () => ({ default: () => <span data-testid="token-icon" /> }));

function series(from, to, n) {
  const out = [];
  for (let i = 0; i < n; i += 1)
    out.push({ t: 1785900000000 + i * 3600_000, p: from + ((to - from) * i) / (n - 1) });
  return out;
}

describe('PriceChart', () => {
  it('renders the chart headline and SVG after loading price data', async () => {
    chartMock.getMarketChart.mockResolvedValue(series(100, 120, 50));
    render(<PriceChart />);
    await waitFor(() => expect(document.querySelector('.chart-svg')).not.toBeNull());
    expect(screen.getByText('Price chart')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /price chart/i })).toBeInTheDocument();
  });

  it('switches time range when a range tab is clicked', async () => {
    chartMock.getMarketChart.mockResolvedValue(series(100, 120, 50));
    render(<PriceChart />);
    await waitFor(() => expect(document.querySelector('.chart-svg')).not.toBeNull());
    const callsBefore = chartMock.getMarketChart.mock.calls.length;
    const sevenDay = screen.getByRole('button', { name: '7D' });
    fireEvent.click(sevenDay);
    await waitFor(() =>
      expect(chartMock.getMarketChart.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('shows an error message when the price fetch fails', async () => {
    chartMock.getMarketChart.mockRejectedValue(new Error('boom'));
    render(<PriceChart />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load ETH price data/)).toBeInTheDocument(),
    );
  });
});
