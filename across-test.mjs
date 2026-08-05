import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = 'http://localhost:8545';
const DUMMY_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DUMMY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPOKE = '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64';
const USDC_POOL = '0xb4CB800910B228ED3d0834cF79D697127BBB00e5';
const WETH = '0x4200000000000000000000000000000000000006';

const depositAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      {
        type: 'tuple',
        components: [
          { name: 'inputToken', type: 'address' },
          { name: 'outputToken', type: 'address' },
          { name: 'inputAmount', type: 'uint256' },
          { name: 'outputAmount', type: 'uint256' },
          { name: 'destinationChainId', type: 'uint256' },
          { name: 'depositor', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'exclusiveRelayer', type: 'address' },
          { name: 'quoteTimestamp', type: 'uint32' },
          { name: 'fillDeadline', type: 'uint32' },
          { name: 'exclusivityDeadline', type: 'uint32' },
          { name: 'message', type: 'bytes' },
        ],
        name: 'depositData',
      },
    ],
    outputs: [],
  },
];

const publicClient = createPublicClient({ transport: http(RPC) });
const account = privateKeyToAccount(DUMMY_KEY);
const walletClient = createWalletClient({
  account,
  transport: http(RPC),
  chain: { id: 8453, name: 'Base Fork' },
});

const erc20 = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
];

async function main() {
  // fund dummy with USDC via impersonated pool
  const bal = await publicClient.readContract({
    address: USDC,
    abi: erc20,
    functionName: 'balanceOf',
    args: [USDC_POOL],
  });
  console.log('pool USDC bal', bal.toString());
  await publicClient.request({ method: 'anvil_impersonateAccount', params: [USDC_POOL] });
  await publicClient.request({
    method: 'anvil_setBalance',
    params: [USDC_POOL, '0xDE0B6B3A7640000'],
  });
  const { request } = await publicClient.simulateContract({
    account: USDC_POOL,
    address: USDC,
    abi: erc20,
    functionName: 'transfer',
    args: [DUMMY, parseUnits('5', 6)],
  });
  await walletClient.writeContract({ ...request, account: USDC_POOL });
  await publicClient.request({ method: 'anvil_stopImpersonatingAccount', params: [USDC_POOL] });
  console.log(
    'dummy USDC',
    (
      await publicClient.readContract({
        address: USDC,
        abi: erc20,
        functionName: 'balanceOf',
        args: [DUMMY],
      })
    ).toString(),
  );

  // approve spoke pool
  const approveHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20,
    functionName: 'approve',
    args: [SPOKE, parseUnits('5', 6)],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log('approved');

  // deposit calldata + eth_call simulation
  const data = encodeFunctionData({
    abi: depositAbi,
    functionName: 'deposit',
    args: [
      {
        inputToken: USDC,
        outputToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        inputAmount: parseUnits('1', 6),
        outputAmount: 994565n,
        destinationChainId: 42161,
        depositor: DUMMY,
        recipient: DUMMY,
        exclusiveRelayer: '0xFD03AbCAdaF3F930fA4E37Eb2f6ea3A44a41b7F0',
        quoteTimestamp: 1785918371,
        fillDeadline: 1785925571,
        exclusivityDeadline: 3,
        message: '0x',
      },
    ],
  });
  try {
    const result = await publicClient.call({ account: DUMMY, to: SPOKE, data });
    console.log('DEPOSIT SIMULATED OK, return:', result);
  } catch (e) {
    console.log('DEPOSIT REVERT:', e?.shortMessage || e?.message || e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
