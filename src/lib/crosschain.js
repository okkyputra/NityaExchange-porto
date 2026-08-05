import { CHAIN_TOKENS } from '../tokens';
import { getBestQuote } from './swap';
import { getAvailableRoutes, getSuggestedFees } from './bridge';

const BRIDGE_ASSET_PRIORITY = ['USDC', 'USDT', 'WETH'];

export function findToken(chainId, symbol) {
  return (CHAIN_TOKENS[chainId] || []).find((t) => t.symbol === symbol) || null;
}

export async function planCrossChain({
  publicClientFrom,
  publicClientTo,
  fromChainId,
  toChainId,
  fromToken,
  toToken,
  amountIn,
}) {
  if (!fromToken || !toToken || !amountIn) return null;
  if (fromChainId === toChainId) return { sameChain: true };

  const routes = await getAvailableRoutes(fromChainId, toChainId);
  const routeTokens = new Set(routes.map((r) => r.originToken.toLowerCase()));

  const candidates = [
    fromToken.symbol,
    ...BRIDGE_ASSET_PRIORITY.filter((s) => s !== fromToken.symbol),
  ];
  let chosen = null;
  for (const symbol of candidates) {
    const fromAsset = findToken(fromChainId, symbol);
    const toAsset = findToken(toChainId, symbol);
    if (!fromAsset || !toAsset) continue;
    if (fromAsset.address === null || toAsset.address === null) continue;
    if (!routeTokens.has(fromAsset.address.toLowerCase())) continue;
    chosen = { fromAsset, toAsset, symbol };
    break;
  }
  if (!chosen) return { error: 'No bridge route for this pair' };

  const { fromAsset, toAsset } = chosen;

  let legIn = null;
  let bridgeIn = amountIn;
  if (fromToken.symbol !== chosen.symbol) {
    const quote = await getBestQuote(publicClientFrom, fromChainId, fromToken, fromAsset, amountIn);
    if (!quote) return { error: `No swap route ${fromToken.symbol} → ${chosen.symbol}` };
    legIn = quote;
    bridgeIn = quote.output;
  }

  let bridge;
  try {
    bridge = await getSuggestedFees({
      originChainId: fromChainId,
      destinationChainId: toChainId,
      token: fromAsset.address,
      amount: bridgeIn,
    });
  } catch {
    return { error: 'Could not quote the bridge leg' };
  }
  const bridgeOut = bridge.outputAmount;
  const bridgeOutToken = {
    address: bridge.outputToken.address,
    symbol: bridge.outputToken.symbol,
    name: bridge.outputToken.symbol,
    decimals: bridge.outputToken.decimals,
  };

  let legOut = null;
  let finalOut = bridgeOut;
  if (toToken.address !== bridgeOutToken.address) {
    const quote = await getBestQuote(publicClientTo, toChainId, bridgeOutToken, toToken, bridgeOut);
    if (!quote) return { error: `No swap route ${bridgeOutToken.symbol} → ${toToken.symbol}` };
    legOut = quote;
    finalOut = quote.output;
  }

  return {
    sameChain: false,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    amountIn,
    bridgeAsset: { from: fromAsset, to: bridgeOutToken },
    legIn,
    bridge,
    legOut,
    bridgeIn,
    bridgeOut,
    finalOut,
    relayFeeTotal: bridge.relayFeeTotal,
    estimatedFillTimeSec: bridge.estimatedFillTimeSec,
  };
}

export async function freshBridgeQuote(route) {
  return getSuggestedFees({
    originChainId: route.fromChainId,
    destinationChainId: route.toChainId,
    token: route.bridgeAsset.from.address,
    amount: route.bridgeIn,
  });
}
