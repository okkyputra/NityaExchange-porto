const API = 'https://app.across.to/api';

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Across API ${res.status}`);
  return res.json();
}

export async function getAvailableRoutes(originChainId, destinationChainId) {
  return getJson(
    `${API}/available-routes?originChainId=${originChainId}&destinationChainId=${destinationChainId}`,
  );
}

export async function getSuggestedFees({ originChainId, destinationChainId, token, amount }) {
  const d = await getJson(
    `${API}/suggested-fees?originChainId=${originChainId}&destinationChainId=${destinationChainId}` +
      `&token=${token}&amount=${amount.toString()}`,
  );
  return {
    inputToken: d.inputToken,
    outputToken: d.outputToken,
    inputAmount: amount,
    outputAmount: BigInt(d.outputAmount),
    relayFeeTotal: BigInt(d.relayFeeTotal),
    relayFeePct: BigInt(d.relayFeePct),
    capitalFeePct: BigInt(d.capitalFeePct),
    relayGasFeePct: BigInt(d.relayGasFeePct),
    quoteTimestamp: Number(d.timestamp),
    fillDeadline: Number(d.fillDeadline),
    exclusivityDeadline: Number(d.exclusivityDeadline),
    exclusiveRelayer: d.exclusiveRelayer,
    spokePoolAddress: d.spokePoolAddress,
    destinationSpokePoolAddress: d.destinationSpokePoolAddress,
    estimatedFillTimeSec: Number(d.estimatedFillTimeSec),
    minDeposit: BigInt(d.limits?.minDeposit ?? 0),
    maxDeposit: BigInt(d.limits?.maxDeposit ?? 0),
    isAmountTooLow: Boolean(d.isAmountTooLow),
  };
}
