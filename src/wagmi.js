import { createConfig, http } from 'wagmi';
import { fallback } from 'viem';
import { base, arbitrum } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, coinbaseWallet, injectedWallet } from '@rainbow-me/rainbowkit/wallets';

const projectId = '1e09f811b3be47d44b5e75c43caeae60';

export const chains = [base, arbitrum];

export const RPC_URLS = {
  [base.id]: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
  [arbitrum.id]: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.drpc.org'],
};

export const EXPLORER_URLS = {
  [base.id]: 'https://basescan.org',
  [arbitrum.id]: 'https://arbiscan.io',
};

export const UNISWAP = {
  [base.id]: {
    name: 'Base',
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    swapRouter: '0x2626664c2603336E57B271c5C0b26F421741e481',
    quoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    weth: '0x4200000000000000000000000000000000000006',
  },
  [arbitrum.id]: {
    name: 'Arbitrum',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    swapRouter: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
};

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, coinbaseWallet, injectedWallet],
    },
  ],
  { appName: 'NityaExchange', projectId },
);

export const config = createConfig({
  connectors,
  chains,
  transports: {
    [base.id]: fallback([http(RPC_URLS[base.id][0]), http(RPC_URLS[base.id][1])], { rank: false }),
    [arbitrum.id]: fallback(
      [http(RPC_URLS[arbitrum.id][0]), http(RPC_URLS[arbitrum.id][1])],
      { rank: false },
    ),
  },
});
