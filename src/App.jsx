import { ConnectButton } from '@rainbow-me/rainbowkit';
import AppShell from './components/AppShell';

export default function App() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#hero">
          NityaExchange
        </a>
        <nav className="nav-links">
          <a href="#about">About</a>
          <a href="#swap">Swap App</a>
          <a href="#roadmap">Roadmap</a>
        </nav>
        <div className="topbar-actions">
          <ConnectButton />
        </div>
      </header>

      <main>
        <section className="hero" id="hero">
          <div className="hero-copy">
            <p className="eyebrow">Web3 portfolio · first app: live swaps</p>
            <h1>Real token swaps, on-chain, from a clean interface.</h1>
            <p className="lead">
              This portfolio kicks off with a production-style swap app powered by Uniswap V3
              routing. Connect a wallet and trade ETH, USDC, and more on Base or Arbitrum.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#swap">
                Open the swap app
              </a>
            </div>
            <ul className="hero-pills">
              <li>Base + Arbitrum</li>
              <li>Uniswap V3 routing</li>
              <li>On-chain quotes</li>
            </ul>
          </div>

          <div className="hero-panel">
            <div className="metric-card">
              <span>Networks live</span>
              <strong>2</strong>
            </div>
            <div className="metric-card">
              <span>Routing engine</span>
              <strong>Uniswap V3</strong>
            </div>
            <div className="metric-card">
              <span>Next milestone</span>
              <strong>Live now</strong>
            </div>
          </div>
        </section>

        <section className="section" id="about">
          <h2>What this portfolio is about</h2>
          <div className="card-grid">
            <article className="info-card">
              <h3>Real, not mocked</h3>
              <p>
                Live quotes come straight from on-chain oracles (QuoterV2), and swaps execute
                through the Uniswap V3 SwapRouter.
              </p>
            </article>
            <article className="info-card">
              <h3>First app: swaps</h3>
              <p>
                Wallet connect, token selection, price impact, approval handling, and a confident
                final action — the full swap journey.
              </p>
            </article>
            <article className="info-card">
              <h3>Growth path</h3>
              <p>
                From swaps to portfolio tracking, cross-chain bridging, and wallet-native tooling —
                each built as its own portfolio piece.
              </p>
            </article>
          </div>
        </section>

        <section className="section" id="swap">
          <div className="swap-shell">
            <div className="swap-copy">
              <p className="eyebrow">Interactive showcase</p>
              <h2>Swap app</h2>
              <p>
                Pick a network, choose your tokens, and preview a live on-chain quote. Swaps run on
                Base and Arbitrum mainnet through Uniswap V3 pools. Track your balances, watch price
                charts, and review your swap history — all in one place.
              </p>
            </div>

            <AppShell />
          </div>
        </section>

        <section className="section" id="roadmap">
          <h2>Roadmap</h2>
          <ol className="roadmap-list">
            <li>
              <strong>Phase 1</strong> — Live swap app: wallet connect, routing, approvals, and
              on-chain execution on Base + Arbitrum. ✓
            </li>
            <li>
              <strong>Phase 2</strong> — Token balances, price charts, and a transaction history
              view. ✓
            </li>
            <li>
              <strong>Phase 3</strong> — Portfolio tracking and cross-chain swap routing.
            </li>
          </ol>
        </section>
      </main>

      <footer className="footer">
        <p>NityaExchange · Web3 portfolio · React + Vite + wagmi + Uniswap V3</p>
      </footer>
    </>
  );
}
