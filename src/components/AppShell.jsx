import { useState } from 'react';
import SwapCard from './SwapCard';
import Balances from './Balances';
import PriceChart from './PriceChart';
import History from './History';

const TABS = [
  { id: 'swap', label: 'Swap' },
  { id: 'balances', label: 'Balances' },
  { id: 'charts', label: 'Charts' },
  { id: 'history', label: 'History' },
];

export default function AppShell() {
  const [tab, setTab] = useState('swap');

  return (
    <div className="app-shell">
      <div className="app-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`app-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="app-tab-panel">
        {tab === 'swap' && <SwapCard />}
        {tab === 'balances' && <Balances />}
        {tab === 'charts' && <PriceChart />}
        {tab === 'history' && <History />}
      </div>
    </div>
  );
}
