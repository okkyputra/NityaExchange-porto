import { useState } from 'react';
import { tokenLogoUrl } from '../lib/logos';

export default function TokenIcon({ token, chainId, size = 22 }) {
  const [failed, setFailed] = useState(false);
  const url = tokenLogoUrl(token, chainId);
  const style = { width: size, height: size };

  if (url && !failed) {
    return (
      <img
        className="token-icon"
        src={url}
        alt=""
        style={style}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="token-icon-fallback" style={{ ...style, fontSize: Math.round(size * 0.45) }}>
      {token.symbol[0]}
    </span>
  );
}
