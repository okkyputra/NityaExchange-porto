import { CHAIN_TOKENS } from '../tokens';

export default function TokenSelect({ chainId, value, onChange }) {
  const tokens = CHAIN_TOKENS[chainId] ?? [];
  return (
    <select
      className="token-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Select token"
    >
      {tokens.map((token) => (
        <option key={token.symbol} value={token.symbol}>
          {token.symbol} · {token.name}
        </option>
      ))}
    </select>
  );
}
