import { SDKProvider } from './contexts/SDKContext';
import { SelectedTileProvider } from './contexts/SelectedTileContext';
import { useGameSDK } from './hooks/useGameSDK';
import GameBoard from './components/GameBoard';
import TilePanel from './components/TilePanel';
import PlayerStats from './components/PlayerStats';
import ActivityFeed from './components/ActivityFeed';

function AppContent() {
  const {
    isInitialized,
    isConnected,
    connectedAddress,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
  } = useGameSDK();

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-12">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-blue-500/20 rounded-full animate-pulse"></div>
            <div className="relative text-7xl animate-bounce">🎮</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Initializing MiniWorld
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
          {error && (
            <div className="mt-6 max-w-md mx-auto px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
      {/* Header - Fixed Height */}
      <header className="flex-shrink-0 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800/50 shadow-2xl">
        <div className="px-6 sm:px-8 lg:px-10 py-6">
          <div className="flex items-center justify-between gap-6">
            {/* Logo Section */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-4 rounded-xl shadow-lg">
                  <span className="text-3xl">🎮</span>
                </div>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  MiniWorld
                </h1>
                <p className="text-sm text-slate-400 font-medium hidden sm:block">
                  On-Chain Gaming Platform
                </p>
              </div>
            </div>

            {/* Wallet Connection Section */}
            <div className="flex items-center gap-3 sm:gap-4">
              {isConnected ? (
                <>
                  <div className="hidden sm:flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg backdrop-blur-sm">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping"></div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-slate-400 font-medium">Connected</span>
                      <span className="text-base font-mono text-green-300 font-semibold">
                        {connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg font-semibold text-base shadow-lg shadow-red-500/25 transition-all duration-200 hover:shadow-red-500/40 hover:scale-105 active:scale-95"
                  >
                    <span className="hidden sm:inline">Disconnect</span>
                    <span className="sm:hidden text-lg">✕</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="relative px-7 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-800 text-white rounded-lg font-bold text-base shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative flex items-center gap-2.5">
                    {isConnecting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">🦊</span>
                        Connect Wallet
                      </>
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 bg-gradient-to-r from-red-500/10 via-red-500/5 to-red-500/10 border-b border-red-500/20 backdrop-blur-sm">
          <div className="px-6 sm:px-8 lg:px-10 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <span className="text-red-400 text-xl">⚠️</span>
              </div>
              <span className="text-red-200 font-medium text-base">{error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable with Fixed Height */}
<main className="flex-1 overflow-hidden px-6 sm:px-8 lg:px-10 my-3">
<div className="h-full flex items-stretch justify-center gap-8">
  {/* Left Column - Game Board */}
  <div className="flex-shrink-0 h-full">
    <GameBoard />
  </div>

  {/* Right Column - Scrollable Components */}
  <div className="flex-1 max-w-3xl h-full flex flex-col gap-6 overflow-y-auto pr-2">
    <TilePanel />
    <PlayerStats />
    <ActivityFeed />
  </div>
</div>
</main>

      {/* Footer - Fixed Height */}
      <footer className="flex-shrink-0 backdrop-blur-xl bg-slate-900/80 border-t border-slate-800/50">
        <div className="px-6 sm:px-8 lg:px-10 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="text-2xl">🎮</div>
              <div className="text-center sm:text-left space-y-1">
                <div className="text-base font-semibold text-white">MiniWorld v1.0.0</div>
                <div className="text-sm text-slate-400">Blockchain Gaming Platform</div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-800/50 border border-slate-700/30 rounded-lg backdrop-blur-sm">
              <div className={`flex items-center gap-3 px-10 py-5 rounded-lg transition-all duration-300 ${
                isConnected 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <div className="relative">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    isConnected ? 'bg-green-400' : 'bg-red-400'
                  } ${isConnected ? 'animate-pulse' : ''}`}></div>
                  {isConnected && (
                    <div className="absolute inset-0 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping"></div>
                  )}
                </div>
                <span className={`text-sm font-semibold ${
                  isConnected ? 'text-green-300' : 'text-red-300'
                }`}>
                  {isConnected ? 'WebSocket Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <SDKProvider>
      <SelectedTileProvider>
        <AppContent />
      </SelectedTileProvider>
    </SDKProvider>
  );
}