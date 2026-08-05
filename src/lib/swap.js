import { encodePacked } from 'viem';
import { UNISWAP } from '../wagmi.js';
import { factoryAbi, quoterV2Abi } from '../abi.js';

const FEE_TIERS = [3000, 500, 100, 10000];

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function isNative(token) {
  return token.address === null;
}

export async function findPool(client, factory, tokenA, tokenB, fee) {
  try {
    const pool = await client.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: 'getPool',
      args: [tokenA, tokenB, fee],
    });
    return pool && pool !== ZERO_ADDRESS ? pool : null;
  } catch {
    return null;
  }
}

async function buildCandidates(client, factory, tokenA, tokenB, weth) {
  const candidates = [];
  if (tokenA.toLowerCase() !== tokenB.toLowerCase()) {
    for (const fee of FEE_TIERS) {
      const pool = await findPool(client, factory, tokenA, tokenB, fee);
      if (pool) candidates.push({ addresses: [tokenA, tokenB], fees: [fee], hops: 1 });
    }
  }
  if (tokenA.toLowerCase() !== weth.toLowerCase() && tokenB.toLowerCase() !== weth.toLowerCase()) {
    for (const fee of FEE_TIERS) {
      const [poolA, poolB] = await Promise.all([
        findPool(client, factory, tokenA, weth, fee),
        findPool(client, factory, weth, tokenB, fee),
      ]);
      if (poolA && poolB) {
        candidates.push({ addresses: [tokenA, weth, tokenB], fees: [fee, fee], hops: 2 });
      }
    }
  }
  return candidates;
}

export async function getBestQuote(client, chainId, tokenIn, tokenOut, amountIn) {
  const { factory, quoterV2, weth } = UNISWAP[chainId];
  const inAddr = isNative(tokenIn) ? weth : tokenIn.address;
  const outAddr = isNative(tokenOut) ? weth : tokenOut.address;

  const candidates = await buildCandidates(client, factory, inAddr, outAddr, weth);
  let best = null;

  for (const candidate of candidates) {
    try {
      const feePath = buildFeePath(candidate.addresses, candidate.fees);
      const output = await quoteExactInput(client, quoterV2, feePath, amountIn);
      if (output > 0n && (!best || output > best.output)) {
        best = {
          ...candidate,
          feePath,
          output,
          inIsNative: isNative(tokenIn),
          outIsNative: isNative(tokenOut),
        };
      }
    } catch {
      // Pool exists but the quote reverted — skip this candidate.
    }
  }

  return best;
}

export function buildFeePath(addresses, fees) {
  if (addresses.length === 2) {
    return encodePacked(['address', 'uint24', 'address'], [addresses[0], fees[0], addresses[1]]);
  }
  return encodePacked(
    ['address', 'uint24', 'address', 'uint24', 'address'],
    [addresses[0], fees[0], addresses[1], fees[1], addresses[2]],
  );
}

export async function quoteExactInput(client, quoter, path, amountIn) {
  const result = await client.readContract({
    address: quoter,
    abi: quoterV2Abi,
    functionName: 'quoteExactInput',
    args: [path, amountIn],
  });
  return { output: result[0], gasEstimate: result[3] ?? 0n };
}

export function applySlippage(amountOut, slippageBps) {
  return amountOut - (amountOut * BigInt(slippageBps)) / 10000n;
}

export function deadlineFromNow(seconds = 1200) {
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}

export function formatTokenAmount(value, decimals, maxDigits = 6) {
  const factor = 10n ** BigInt(decimals);
  const whole = value / factor;
  const fraction = value % factor;

  const wholeStr = whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, maxDigits);
  const frac = fractionStr.replace(/0+$/, '');

  return frac ? `${wholeStr}.${frac}` : wholeStr;
}

export function formatRate(amountOut, decimalsOut, amountIn, decimalsIn) {
  const numerator = amountOut * 10n ** BigInt(decimalsIn);
  const denominator = amountIn * 10n ** BigInt(decimalsOut);
  if (denominator === 0n) return '0';

  const SCALE = 18n;
  const scaled = (numerator * 10n ** SCALE) / denominator;
  const str = scaled.toString().padStart(Number(SCALE) + 1, '0');
  const whole = str.slice(0, -Number(SCALE)) || '0';
  let frac = str.slice(-Number(SCALE)).replace(/0+$/, '');

  if (whole !== '0' && frac.length > 6) frac = frac.slice(0, 6);
  else if (whole === '0' && frac.length > 10) frac = frac.slice(0, 10);

  const grouped = Number(whole).toLocaleString('en-US');
  return frac ? `${grouped}.${frac}` : grouped;
}
