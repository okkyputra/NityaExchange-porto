import { createPublicClient, http, encodeFunctionData } from 'viem';
const publicClient = createPublicClient({ transport: http('http://localhost:8545') });
const DUMMY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPOKE = '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64';
const abi = [
  {
    type: 'function',
    name: 'depositV3',
    stateMutability: 'payable',
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'inputToken', type: 'address' },
      { name: 'outputToken', type: 'address' },
      { name: 'inputAmount', type: 'uint256' },
      { name: 'outputAmount', type: 'uint256' },
      { name: 'destinationChainId', type: 'uint256' },
      { name: 'exclusiveRelayer', type: 'address' },
      { name: 'quoteTimestamp', type: 'uint32' },
      { name: 'fillDeadline', type: 'uint32' },
      { name: 'exclusivityDeadline', type: 'uint32' },
      { name: 'message', type: 'bytes' },
    ],
    outputs: [],
  },
];
const block = await publicClient.getBlock();
const ts = Number(block.timestamp);
console.log('fork ts', ts);
const data = encodeFunctionData({
  abi,
  functionName: 'depositV3',
  args: [
    DUMMY,
    DUMMY,
    USDC,
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    1000000n,
    994546n,
    42161,
    '0xFD03AbCAdaF3F930fA4E37Eb2f6ea3A44a41b7F0',
    ts,
    ts + 7200,
    3,
    '0x',
  ],
});
console.log('calldata:', data.slice(0, 14));
try {
  const r = await publicClient.request({
    method: 'eth_call',
    params: [{ from: DUMMY, to: SPOKE, data }, 'latest'],
  });
  console.log('DEPOSITV3 SIMULATED OK:', r);
} catch (e) {
  console.log('REVERT:', JSON.stringify(e.details || e.shortMessage || e.message).slice(0, 200));
}
