# NityaExchange · Web3 Portfolio

A Web3 portfolio whose first app is a live, on-chain token swap. Built with React + Vite + wagmi + RainbowKit and powered by Uniswap V3 routing on Base and Arbitrum.

## Features

- Live on-chain quotes via Uniswap V3 QuoterV2
- Swap execution through the Uniswap V3 SwapRouter
- Multi-network support: Base and Arbitrum
- Wallet connect via RainbowKit (MetaMask, Coinbase Wallet, injected)
- Allowance management and slippage controls
- Best-quote routing across multiple fee tiers and WETH hop candidates

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173, connect a wallet, and try a swap on Base or Arbitrum mainnet.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — run oxlint
- `npm run preview` — preview the production build
