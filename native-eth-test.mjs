import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEther,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { spokePoolAbi } from './src/abi.js';

const RPC = 'http://localhost:8545';
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DUMMY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const WETH_ARB = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';

const pub = createPublicClient({ transport: http(RPC) });
const wallet = createWalletClient({
  account: privateKeyToAccount(KEY),
  transport: http(RPC),
  chain: { id: 8453, name: 'Base Fork' },
});

const amount = parseEther('1');
const q = await (
  await fetch(
    `https://app.across.to/api/suggested-fees?originChainId=8453&destinationChainId=42161&token=${WETH_BASE}&amount=${amount.toString()}`,
  )
).json();
console.log(
  'quote outputAmount:',
  formatUnits(BigInt(q.outputAmount), 18),
  'WETH | spoke:',
  q.spokePoolAddress.slice(0, 10),
);

// align fork time
const block = await pub.getBlock();
await pub.request({ method: 'anvil_setTime', params: [Number(block.timestamp) + 1] });

const data = encodeFunctionData({
  abi: spokePoolAbi,
  functionName: 'depositV3',
  args: [
    DUMMY,
    DUMMY,
    q.inputToken.address,
    q.outputToken.address,
    amount,
    BigInt(q.outputAmount),
    42161,
    q.exclusiveRelayer,
    Number(block.timestamp) + 1,
    Number(q.fillDeadline),
    Number(q.exclusivityDeadline),
    '0x',
  ],
});
try {
  const sim = await pub.call({ account: DUMMY, to: q.spokePoolAddress, value: amount, data });
  console.log('SIMULATED OK (native ETH msg.value accepted)');
} catch (e) {
  console.log('SIMULATE REVERT:', e?.shortMessage || e?.details || '?');
  process.exit(1);
}
