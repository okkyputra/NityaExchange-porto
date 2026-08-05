# NityaExchange · Web3 Portfolio

A Web3 portfolio built around a production-style swap app. Live on-chain swaps on **Base** and **Arbitrum** through Uniswap V3, plus portfolio tracking, price charts, swap history, and **cross-chain routing over the Across bridge**.

## Features

### Phase 1 — Live swap app

- Wallet connect via RainbowKit (WalletConnect, MetaMask, Coinbase, injected)
- Best-quote routing across fee tiers (0.01%–1%) and direct / via-WETH hop candidates
- Live on-chain quotes from the deployed Uniswap V3 QuoterV2
- Swap execution through the deployed V3 SwapRouter (`exactInput` + `multicall` + `unwrapWETH9`)
- Automatic allowance management, slippage controls, native ETH in/out, and network fee estimates

### Phase 2 — Balances, charts, history

- **Portfolio**: aggregate balances across Base + Arbitrum with live USD values and totals
- **Price charts**: dependency-free SVG charts (1D–1Y) from CoinGecko with token + range selectors
- **History**: every completed swap recorded to localStorage with explorer links

### Phase 3 — Portfolio tracking & cross-chain routing

- **Cross-chain route planner**: swap-on-origin → bridge → swap-on-destination, with real quotes for every leg
- Bridge leg quoted live from the **Across Protocol** `suggested-fees` API (fees, output, ETA)
- Real execution: router swap + `SpokePool.depositV3` (ABI bytecode-verified), auto-detect of bridge landing, then destination swap

## Stack

- React 19 + Vite 8
- wagmi 2 + viem 2
- RainbowKit
- Uniswap V3 (custom V3SwapRouter on Base/Arbitrum) + Across Protocol (V3 SpokePools)
- CoinGecko (prices + charts), oxlint, vitest

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173, connect a wallet, and try a swap or a cross-chain route on Base / Arbitrum mainnet.

**Live demo:** https://okkyputra.github.io/NityaExchange-porto/

> Note: WalletConnect's QR modal only works on allowed origins (localhost by default). To enable it on
> the GitHub Pages domain, add `https://okkyputra.github.io` to the project's domain allowlist on
> [cloud.reown.com](https://cloud.reown.com). MetaMask / Coinbase / injected wallets work on any origin.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — run oxlint
- `npm run test` — run the vitest suite (lib logic + React component tests)
- `npm run format` — run Prettier across source files

## Verification

Swaps and cross-chain execution were validated against a local **Anvil mainnet fork** using the app's exact ABI and calldata:

- ETH→USDC and USDC→ETH delivered exactly the quoted amounts (verified via transfer/withdrawal event logs)
- Across `depositV3` executes on the fork and emits `FundsDeposited` (`0x32ed1a409ef0…`)
- 53 unit/component tests, lint and production build all green

## Notes

- Token addresses, router/quoter addresses, and bridge spoke pools are the **live deployed contracts** on Base and Arbitrum.
- The auto-commit watcher (`auto-commit.mjs`) formats, lints, commits, and pushes changes automatically.
