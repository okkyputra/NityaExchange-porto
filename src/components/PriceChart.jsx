import { useEffect, useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { CHAIN_TOKENS } from '../tokens';
import { getMarketChart, formatUsd, formatPercent } from '../lib/price';
import TokenIcon from './TokenIcon';

const RANGES = [
  { days: 1, label: '1D' },
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
  { days: 365, label: '1Y' },
];

const W = 640;
const H = 260;
const PAD = 16;

function buildPath(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${xs[xs.length - 1]},${H - PAD} L${xs[0]},${H - PAD} Z`;
  return { line, area, xs, ys };
}

function layout(points, min, max) {
  const span = max - min || 1;
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  return points.map((p, i) => ({
    x: PAD + i * step,
    y: PAD + (1 - (p.p - min) / span) * (H - PAD * 2),
    t: p.t,
    p: p.p,
  }));
}

export default function PriceChart() {
  const chainId = useChainId();
  const tokens = CHAIN_TOKENS[chainId] || [];
  const [symbol, setSymbol] = useState('ETH');
  const [days, setDays] = useState(7);
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMarketChart(symbol, days)
      .then((raw) => {
        if (cancelled) return;
        const maxPoints = 140;
        const k = Math.max(1, Math.ceil(raw.length / maxPoints));
        const sampled = raw.filter((_, i) => i % k === 0 || i === raw.length - 1);
        setPoints(sampled);
      })
      .catch(() => {
        if (!cancelled) setError(`Could not load ${symbol} price data`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, days]);

  const chart = useMemo(() => {
    if (!points || !points.length) return null;
    const min = Math.min(...points.map((p) => p.p));
    const max = Math.max(...points.map((p) => p.p));
    const laid = layout(points, min, max);
    return {
      laid,
      min,
      max,
      start: points[0].p,
      end: points[points.length - 1].p,
      paths: buildPath(laid),
    };
  }, [points]);

  const change = chart ? ((chart.end - chart.start) / chart.start) * 100 : null;
  const up = change != null && change >= 0;
  const color = up ? 'var(--success)' : 'var(--danger)';
  const selectedToken = tokens.find((t) => t.symbol === symbol);

  const formatTime = (t) =>
    new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Price chart</h3>
          <span className="panel-sub">
            {selectedToken?.name || symbol} · on-chain quote baseline
          </span>
        </div>
        <div className="chart-controls">
          <select
            className="token-select"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            {tokens.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
          <div className="range-tabs">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                className={`range-tab ${days === r.days ? 'active' : ''}`}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chart && (
        <div className="chart-headline">
          <TokenIcon token={{ symbol }} chainId={chainId} size={28} />
          <strong className={up ? 'up' : 'down'}>{formatUsd(chart.end)}</strong>
          <span className={up ? 'up' : 'down'}>{formatPercent(change)}</span>
          <span className="panel-sub">
            {formatTime(chart.laid[0].t)} — {formatTime(chart.laid[chart.laid.length - 1].t)}
          </span>
        </div>
      )}

      {loading && <p className="panel-empty">Loading price data…</p>}
      {error && <p className="status-error">{error}</p>}

      {chart && !loading && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          role="img"
          aria-label={`${symbol} price chart`}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => {
            const y = PAD + f * (H - PAD * 2);
            return <line key={f} x1={PAD} x2={W - PAD} y1={y} y2={y} className="chart-gridline" />;
          })}
          <path d={chart.paths.area} fill="url(#chart-fill)" />
          <path
            d={chart.paths.line}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <text x={PAD} y={PAD - 6} className="chart-label">
            {formatUsd(chart.max)}
          </text>
          <text x={PAD} y={H - PAD + 14} className="chart-label">
            {formatUsd(chart.min)}
          </text>
        </svg>
      )}
    </div>
  );
}
