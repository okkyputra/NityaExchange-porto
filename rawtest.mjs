import { createPublicClient, http, encodeFunctionData } from 'viem';
const publicClient = createPublicClient({ transport: http('http://localhost:8545') });
const DUMMY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPOKE = '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64';
const abi = [
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
        name: 'd',
      },
    ],
    outputs: [],
  },
];
const block = await publicClient.getBlock();
const ts = Number(block.timestamp);
const data = encodeFunctionData({
  abi,
  functionName: 'deposit',
  args: [
    {
      inputToken: USDC,
      outputToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      inputAmount: 1000000n,
      outputAmount: 994546n,
      destinationChainId: 42161,
      depositor: DUMMY,
      recipient: DUMMY,
      exclusiveRelayer: '0xFD03AbCAdaF3F930fA4E37Eb2f6ea3A44a41b7F0',
      quoteTimestamp: ts,
      fillDeadline: ts + 7200,
      exclusivityDeadline: 3,
      message: '0x',
    },
  ],
});
try {
  const r = await publicClient.request({
    method: 'eth_call',
    params: [{ from: DUMMY, to: SPOKE, data }, 'latest'],
  });
  console.log('OK', r);
} catch (e) {
  console.log('ERROR');
  console.log(JSON.stringify(e, null, 1).slice(0, 1200));
}
