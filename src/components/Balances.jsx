import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { CHAIN_TOKENS } from '../tokens';
import { erc20Abi } from '../abi';
import { getPrices, formatUsd, formatCompactUsd } from '../lib/price';
import { isNative, formatTokenAmount } from '../lib/swap';

export default function Balances() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tokens = useMemo(() => CHAIN_TOKENS[chainId] || [], [chainId]);

  const load = useCallback(async () => {
    if (!isConnected || !address || !publicClient) return;
    setLoading(true);
    setError(null);
    try {
      const balanceResults = await Promise.all(
        tokens.map(async (token) => {
          if (isNative(token)) {
            const value = await publicClient.getBalance({ address });
            return { token, value };
          }
          try {
            const value = await publicClient.readContract({
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

      const prices = await getPrices(tokens.map((t) => t.symbol));
      const withUsd = balanceResults
        .map(({ token, value }) => {
          const amount = Number(formatUnits(value, token.decimals));
          const price = prices[token.symbol];
          return {
            token,
            value,
            amount,
            price: price ?? null,
            usd: price != null ? amount * price : null,
          };
        })
        .sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
      setRows(withUsd);
    } catch (err) {
      setError('Could not load balances right now');
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, publicClient, tokens]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const totalUsd = rows.reduce((sum, r) => sum + (r.usd ?? 0), 0);
  const holdings = rows.filter((r) => r.value > 0n);

  if (!isConnected || !address) {
    return (
      <div className="panel-card">
        <p className="panel-empty">Connect a wallet to see your token balances.</p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Token balances</h3>
          <span className="panel-sub">{loading ? 'Loading…' : `${holdings.length} holdings`}</span>
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
        {!loading && rows.length === 0 && <p className="panel-empty">No balances to show.</p>}
        {rows.map(({ token, value, amount, price, usd }) => (
          <div className="balance-row" key={token.symbol}>
            <div className="balance-name">
              <strong>{token.symbol}</strong>
              <span>{token.name}</span>
            </div>
            <div className="balance-amount">
              <strong>{formatTokenAmount(value, token.decimals)}</strong>
              <span>{price != null ? `@ ${formatUsd(price)}` : 'price n/a'}</span>
            </div>
            <div className="balance-usd">
              <strong>{usd != null ? formatUsd(usd) : '—'}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
