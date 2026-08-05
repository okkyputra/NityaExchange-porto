import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  maxUint256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi, swapRouterAbi, spokePoolAbi } from './src/abi.js';
import { applySlippage, deadlineFromNow, getBestQuote } from './src/lib/swap.js';
import { planCrossChain, freshBridgeQuote } from './src/lib/crosschain.js';
import { findToken } from './src/lib/crosschain.js';

const RPC = 'http://localhost:8545';
const DUMMY_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DUMMY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
const WETH = '0x4200000000000000000000000000000000000006';

const publicClientFrom = createPublicClient({ transport: http(RPC) });
const publicClientTo = createPublicClient({ transport: http('https://arb1.arbitrum.io/rpc') });
const account = privateKeyToAccount(DUMMY_KEY);
const walletClient = createWalletClient({
  account,
  transport: http(RPC),
  chain: { id: 8453, name: 'Base Fork' },
});

async function main() {
  console.log('dummy ETH:', formatUnits(await publicClientFrom.getBalance({ address: DUMMY }), 18));
  console.log('chainId:', (await publicClientFrom.getChainId()).toString());

  const fromChainId = 8453;
  const toChainId = 42161;
  const fromToken = findToken(fromChainId, 'ETH');
  const toToken = findToken(toChainId, 'USDC');
  const amountIn = parseUnits('0.01', 18);

  // 1. plan the route (mirrors CrossChain.jsx effect)
  const route = await planCrossChain({
    publicClientFrom,
    publicClientTo,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    amountIn,
  });
  if (!route || route.error) throw new Error(route?.error || 'no route');
  console.log(
    `\nROUTE: ${formatUnits(amountIn, 18)} ETH (Base) -> ${formatUnits(route.finalOut, 6)} USDC (Arb)`,
  );
  console.log(
    'bridge asset:',
    route.bridgeAsset.from.symbol,
    'legIn:',
    !!route.legIn,
    'legOut:',
    !!route.legOut,
  );

  // 2. executeOrigin: leg 1 swap ETH -> USDC (native in => value)
  if (route.legIn) {
    const swapData = [
      encodeFunctionData({
        abi: swapRouterAbi,
        functionName: 'exactInput',
        args: [
          {
            path: route.legIn.feePath,
            recipient: DUMMY,
            amountIn,
            amountOutMinimum: applySlippage(route.legIn.output, 100),
          },
        ],
      }),
    ];
    const hash = await walletClient.writeContract({
      address: ROUTER,
      abi: swapRouterAbi,
      functionName: 'multicall',
      args: [deadlineFromNow(), swapData],
      value: amountIn,
      gas: 4000000n,
    });
    await publicClientFrom.waitForTransactionReceipt({ hash });
    console.log('STEP1 swap OK tx', hash.slice(0, 12));
  }

  const usdc = findToken(8453, 'USDC');
  const usdcBal = await publicClientFrom.readContract({
    address: usdc.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [DUMMY],
  });
  console.log('dummy USDC after swap:', formatUnits(usdcBal, 6));

  // 3. freshBridgeQuote + align fork clock with quote timestamp
  const quote = await freshBridgeQuote(route);
  await publicClientFrom.request({ method: 'anvil_setTime', params: [quote.quoteTimestamp] });
  await publicClientFrom.request({ method: 'anvil_mine', params: [] });
  console.log(
    'bridge quote input:',
    formatUnits(quote.inputAmount, 6),
    'output:',
    formatUnits(quote.outputAmount, 6),
    'pool:',
    quote.spokePoolAddress.slice(0, 10),
  );

  // 4. approve SpokePool
  const approveHash = await walletClient.writeContract({
    address: usdc.address,
    abi: erc20Abi,
    functionName: 'approve',
    args: [quote.spokePoolAddress, quote.inputAmount],
  });
  await publicClientFrom.waitForTransactionReceipt({ hash: approveHash });
  console.log('STEP2 approve SpokePool OK', approveHash.slice(0, 12));

  const allowance = await publicClientFrom.readContract({
    address: usdc.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [DUMMY, quote.spokePoolAddress],
  });
  console.log('allowance to SpokePool:', formatUnits(allowance, 6));

  // 5. depositV3 (mirrors CrossChain.jsx)
  const depositHash = await walletClient.writeContract({
    address: quote.spokePoolAddress,
    abi: spokePoolAbi,
    functionName: 'depositV3',
    args: [
      DUMMY,
      DUMMY,
      quote.inputToken.address,
      quote.outputToken.address,
      quote.inputAmount,
      quote.outputAmount,
      toChainId,
      quote.exclusiveRelayer,
      quote.quoteTimestamp,
      quote.fillDeadline,
      quote.exclusivityDeadline,
      '0x',
    ],
    value: 0n,
    gas: 4000000n,
  });
  const receipt = await publicClientFrom.waitForTransactionReceipt({ hash: depositHash });
  console.log(
    'STEP3 depositV3 status:',
    receipt.status === 'success' ? 'SUCCESS' : 'FAILED',
    depositHash.slice(0, 12),
  );

  const fundsDeposited = receipt.logs.find(
    (l) => l.topics[0] === '0x0c3ba1924d84dbeee00892ce32f62fbd26e0b9f1c199e4c0b52f8f968f9b6ad3',
  );
  console.log('FundsDeposited event:', fundsDeposited ? 'EMITTED' : 'not found');
  console.log('\nORIGIN EXECUTION DRY-RUN COMPLETE');
}

main().catch((e) => {
  console.error('DRY-RUN FAILED:', e?.shortMessage || e?.message || e);
  process.exit(1);
});
