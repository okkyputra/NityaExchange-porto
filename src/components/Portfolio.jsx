import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { chains, UNISWAP } from '../wagmi';
import { CHAIN_TOKENS } from '../tokens';
import { erc20Abi } from '../abi';
import { getPrices, formatUsd, formatCompactUsd } from '../lib/price';
import { isNative, formatTokenAmount } from '../lib/swap';

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const publicClients = {};
  for (const chain of chains) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    publicClients[chain.id] = usePublicClient({ chainId: chain.id });
  }
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!isConnected || !address) return;
    setLoading(true);
    setError(null);
    try {
      const symbols = new Set();
      const byChain = {};
      for (const chain of chains) {
        const client = publicClients[chain.id];
        if (!client) continue;
        const tokens = CHAIN_TOKENS[chain.id] || [];
        const balances = await Promise.all(
          tokens.map(async (token) => {
            symbols.add(token.symbol);
            if (isNative(token)) {
              const value = await client.getBalance({ address });
              return { token, value };
            }
            try {
              const value = await client.readContract({
                address: token.address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
              });
              return { token, value };
            } catch {
              return { token, value: 0n };
            }
          }),
        );
        byChain[chain.id] = Object.fromEntries(
          balances.map(({ token, value }) => [token.symbol, value]),
        );
      }

      const prices = await getPrices([...symbols]);

      const map = new Map();
      for (const chain of chains) {
        for (const token of CHAIN_TOKENS[chain.id] || []) {
          const value = byChain[chain.id]?.[token.symbol] ?? 0n;
          const amount = Number(formatUnits(value, token.decimals));
          const price = prices[token.symbol];
          let entry = map.get(token.symbol);
          if (!entry) {
            entry = {
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              chains: { [chain.id]: value },
              amount,
              price: price ?? null,
              usd: price != null ? amount * price : null,
            };
            map.set(token.symbol, entry);
          } else {
            entry.chains[chain.id] = value;
            entry.amount += amount;
            if (price != null) entry.usd = price * entry.amount;
          }
        }
      }
      setRows([...map.values()].sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1)));
    } catch {
      setError('Could not load portfolio right now');
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, publicClients]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const totalUsd = rows.reduce((sum, r) => sum + (r.usd ?? 0), 0);
  const holdings = rows.filter((r) => r.amount > 0);

  if (!isConnected || !address) {
    return (
      <div className="panel-card">
        <p className="panel-empty">Connect a wallet to see your cross-chain portfolio.</p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Portfolio</h3>
          <span className="panel-sub">
            {loading ? 'Loading…' : `${holdings.length} assets across ${chains.length} chains`}
          </span>
        </div>
        <div className="panel-total">
          <span>Total value</span>
          <strong>{loading ? '…' : formatCompactUsd(totalUsd)}</strong>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <p className="status-error">{error}</p>}

      <div className="balance-list">
        {!loading && rows.length === 0 && <p className="panel-empty">No assets to show.</p>}
        {rows.map((row) => {
          const pct = totalUsd > 0 && row.usd != null ? (row.usd / totalUsd) * 100 : 0;
          return (
            <div className="portfolio-row" key={row.symbol}>
              <div className="balance-name">
                <strong>{row.symbol}</strong>
                <span>{row.name}</span>
              </div>
              <div className="portfolio-chains">
                {chains.map((chain) => (
                  <span className="portfolio-chain" key={chain.id}>
                    {UNISWAP[chain.id].name.slice(0, 4)}:{' '}
                    {formatTokenAmount(row.chains[chain.id] ?? 0n, row.decimals)}
                  </span>
                ))}
              </div>
              <div className="balance-usd">
                <strong>{row.usd != null ? formatUsd(row.usd) : '—'}</strong>
                <span>{pct > 0 ? `${pct.toFixed(1)}%` : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
