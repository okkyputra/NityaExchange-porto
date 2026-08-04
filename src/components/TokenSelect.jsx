import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { getBalance, readContract } from 'wagmi/actions';
import { config } from '../wagmi';
import { erc20Abi } from '../abi';
import { CHAIN_TOKENS } from '../tokens';
import { formatTokenAmount, isNative } from '../lib/swap';

function formatBalance(value, decimals) {
  const formatted = formatTokenAmount(value, decimals, 4);
  const [whole, frac] = formatted.split('.');
  const grouped = Number(whole).toLocaleString('en-US');
  return frac ? `${grouped}.${frac}` : grouped;
}

export default function TokenSelect({ chainId, value, onChange, refreshKey = 0 }) {
  const { address, isConnected } = useAccount();
  const tokens = useMemo(() => CHAIN_TOKENS[chainId] ?? [], [chainId]);
  const [balances, setBalances] = useState({});

  useEffect(() => {
    let cancelled = false;
    setBalances({});
    if (!address) return;

    async function load() {
      const next = {};
      await Promise.all(
        tokens.map(async (token) => {
          try {
            const balance = isNative(token)
              ? (await getBalance(config, { address, chainId })).value
              : await readContract(config, {
                  chainId,
                  address: token.address,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [address],
                });
            if (!cancelled) next[token.symbol] = balance;
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setBalances(next);
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [address, chainId, tokens, isConnected, refreshKey]);

  const showBalance = isConnected && address;

  return (
    <select
      className="token-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Select token"
    >
      {tokens.map((token) => {
        const balance = showBalance ? balances[token.symbol] : null;
        const label =
          balance != null
            ? `${token.symbol} · ${formatBalance(balance, token.decimals)}`
            : `${token.symbol} · ${token.name}`;
        return (
          <option key={token.symbol} value={token.symbol}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
