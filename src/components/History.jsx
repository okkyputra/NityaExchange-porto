import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { EXPLORER_URLS, UNISWAP } from '../wagmi';
import { getSwaps, clearHistory } from '../lib/history';

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function History() {
  const { address, isConnected } = useAccount();
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    setEntries(getSwaps());
  }, []);

  const refresh = () => setEntries(getSwaps());

  if (!isConnected || !address) {
    return (
      <div className="panel-card">
        <p className="panel-empty">Connect a wallet to view your swap history.</p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Transaction history</h3>
          <span className="panel-sub">{entries.length} swaps recorded in this browser</span>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clearHistory();
              refresh();
            }}
          >
            Clear
          </button>
        )}
      </div>

      {entries.length === 0 && (
        <p className="panel-empty">
          No swaps yet. Complete a swap and it will appear here with a link to the explorer.
        </p>
      )}

      <div className="history-list">
        {entries.map((e) => {
          const chain = UNISWAP[e.chainId];
          const explorer = EXPLORER_URLS[e.chainId];
          const txHref = explorer ? `${explorer}/tx/${e.txHash}` : null;
          return (
            <div className="history-row" key={e.id}>
              <div className="history-main">
                <strong>
                  {e.amountIn} {e.fromSymbol} → {e.amountOut} {e.toSymbol}
                </strong>
                <span>
                  {chain ? chain.name : `Chain ${e.chainId}`} · {timeAgo(e.timestamp)}
                </span>
              </div>
              <div className="history-side">
                <span className="badge badge-ok">Confirmed</span>
                {txHref ? (
                  <a className="history-link" href={txHref} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
