import { useState } from 'react';
import { useGameSDK } from './hooks/useGameSDK';
import Analytics from './components/Analytics';
import WorldOverview from './components/WorldOverview';
import EventLog from './components/EventLog';
import PlayerManager from './components/PlayerManager';

export default function App() {
  const { isInitialized, error: sdkError } = useGameSDK();
  const [activeTab, setActiveTab] = useState<'analytics' | 'overview' | 'events' | 'players'>('analytics');

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-xl font-semibold mb-2">Initializing Creator Dashboard...</div>
          <div className="text-sm text-slate-400">Loading SDK and WebSocket connection</div>
        </div>
      </div>
    );
  }

  if (sdkError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <div className="text-xl font-semibold mb-2 text-red-400">SDK Error</div>
          <div className="text-sm text-slate-300 mb-4">{sdkError}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium"
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">🎮 MiniWorld Creator Dashboard</h1>
              <p className="text-sm text-slate-400">Analytics and management for your on-chain game</p>
            </div>
            <div className="flex items-center gap-3">
              <WebSocketStatus />
              <ContractInfo />
            </div>
          </div>

          <nav className="flex gap-2">
            <TabButton
              active={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
              icon="📊"
              label="Analytics"
            />
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon="🗺️"
              label="World Overview"
            />
            <TabButton
              active={activeTab === 'events'}
              onClick={() => setActiveTab('events')}
              icon="📝"
              label="Event Log"
            />
            <TabButton
              active={activeTab === 'players'}
              onClick={() => setActiveTab('players')}
              icon="👥"
              label="Player Manager"
            />
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'overview' && <WorldOverview />}
        {activeTab === 'events' && <EventLog />}
        {activeTab === 'players' && <PlayerManager />}
      </main>

      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          <div>MiniWorld Creator Dashboard v1.0.0 • Phase 5 Complete</div>
          <div className="mt-1">Contract: {import.meta.env.VITE_CONTRACT_ADDRESS.slice(0, 10)}...</div>
        </div>
      </footer>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: string;
}

function TabButton({ active, onClick, icon, label, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2
        ${active 
          ? 'bg-blue-600 text-white' 
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }
      `}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span className="text-xs bg-slate-900/50 px-2 py-0.5 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

function WebSocketStatus() {
  const { sdk } = useGameSDK();
  const isConnected = sdk.isWebSocketConnected();

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
      <span className="text-slate-400">
        {isConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
      </span>
    </div>
  );
}

function ContractInfo() {
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
  const displayAddress = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`;

  return (
    <div className="bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
      {displayAddress}
    </div>
  );
}