import { createPublicClient, http, encodeFunctionData, parseUnits } from 'viem';

const RPC = 'http://localhost:8545';
const DUMMY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPOKE = '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64';

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

async function main() {
  const block = await publicClient.getBlock();
  console.log('fork block number:', block.number, 'timestamp:', block.timestamp.toString());
  console.log('fork chainId:', (await publicClient.getChainId()).toString());

  const quote = await (
    await fetch(
      `https://app.across.to/api/suggested-fees?originChainId=8453&destinationChainId=42161&token=${USDC}&amount=${parseUnits('1', 6).toString()}`,
    )
  ).json();
  console.log('quote quoteTimestamp:', quote.timestamp, 'fillDeadline:', quote.fillDeadline);
  console.log(
    'outputAmount:',
    quote.outputAmount,
    'exclRelayer:',
    quote.exclusiveRelayer,
    'exclDeadline:',
    quote.exclusivityDeadline,
  );
  console.log('spokePool:', quote.spokePoolAddress);

  const data = encodeFunctionData({
    abi: depositAbi,
    functionName: 'deposit',
    args: [
      {
        inputToken: quote.inputToken.address,
        outputToken: quote.outputToken.address,
        inputAmount: BigInt(quote.inputAmount ?? parseUnits('1', 6).toString()),
        outputAmount: BigInt(quote.outputAmount),
        destinationChainId: 42161,
        depositor: DUMMY,
        recipient: DUMMY,
        exclusiveRelayer: quote.exclusiveRelayer,
        quoteTimestamp: Number(quote.timestamp),
        fillDeadline: Number(quote.fillDeadline),
        exclusivityDeadline: Number(quote.exclusivityDeadline),
        message: '0x',
      },
    ],
  });

  try {
    const result = await publicClient.call({ account: DUMMY, to: SPOKE, data });
    console.log('DEPOSIT SIMULATED OK');
    console.log('return:', result);
  } catch (e) {
    const raw = e?.data;
    console.log('DEPOSIT REVERT');
    if (raw && raw.length > 10) {
      try {
        const msg = decodeRevert(raw);
        console.log('revert reason:', msg);
      } catch {
        console.log('raw revert data:', raw);
      }
    } else {
      console.log('err:', e?.shortMessage || e?.message || e);
    }
  }
}

function decodeRevert(data) {
  const hex = data.startsWith('0x08c379a0') ? data.slice(10) : data.slice(2);
  const bytes = Uint8Array.from(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const text = new TextDecoder().decode(bytes);
  return text.replace(/\u0000/g, '');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
