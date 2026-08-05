import { createPublicClient, createWalletClient, http, parseEther, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { spokePoolAbi } from './src/abi.js';

const RPC = 'http://localhost:8545';
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DUMMY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const WETH_BASE = '0x4200000000000000000000000000000000000006';

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
const block = await pub.getBlock();
const ts = Number(block.timestamp) + 2;

const hash = await wallet.writeContract({
  address: q.spokePoolAddress,
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
    ts,
    Number(q.fillDeadline),
    Number(q.exclusivityDeadline),
    '0x',
  ],
  value: amount,
  gas: 4000000n,
});
const r = await pub.waitForTransactionReceipt({ hash });
console.log(
  'depositV3 (native ETH, msg.value) status:',
  r.status === 'success' ? 'SUCCESS' : 'FAILED',
  hash.slice(0, 12),
);
const deposited = r.logs.find(
  (l) => l.topics[0] === '0x32ed1a409ef04219e4142fae6c908a5f0e49b4bd51f8ff79d9b9c979a494eb4e',
);
console.log('FundsDeposited event:', deposited ? 'EMITTED' : 'not found');
