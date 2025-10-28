import { useState, useEffect, useCallback } from 'react';
import { useGameSDK } from '../hooks/useGameSDK';
import type { PlayerStats as PlayerStatsType } from '../types';

export default function PlayerStats() {
  const { sdk, isConnected, connectedAddress } = useGameSDK();
  const [stats, setStats] = useState<PlayerStatsType | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchStats = useCallback(async () => {
    if (!sdk || !isConnected || !connectedAddress) return;

    setLoading(true);
    try {
      const playerStats = await sdk.getPlayerStats(connectedAddress);
      setStats(playerStats);
      console.log('PlayerStats: Fetched stats', playerStats);
    } catch (err) {
      console.error('Failed to fetch player stats:', err);
    } finally {
      setLoading(false);
    }
  }, [sdk, isConnected, connectedAddress]);

  useEffect(() => {
    fetchStats();
  }, [sdk, isConnected, connectedAddress]);

  useEffect(() => {
    if (!sdk) return;

    const handleWorldUpdate = () => {
      console.log('PlayerStats: World updated (backend processed event), fetching stats...');
      fetchStats();
    };

    sdk.on('worldUpdate', handleWorldUpdate);

    return () => {
      sdk.off('worldUpdate', handleWorldUpdate);
    };
  }, [sdk, isConnected, connectedAddress]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('PlayerStats: Manual refresh triggered');
      fetchStats();
    }
  }, [refreshTrigger, sdk, isConnected, connectedAddress]);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isConnected) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Player Stats</h2>
            <p className="text-sm text-slate-400 mt-1">Your Performance</p>
          </div>
        </div>
        
        <div className="py-12 text-center space-y-4">
          <div className="text-6xl opacity-60">👛</div>
          <div>
            <div className="text-lg font-semibold text-slate-300 mb-2">
              Connect Your Wallet
            </div>
            <div className="text-base text-slate-500">
              View your game statistics
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Player Stats</h2>
            <p className="text-sm text-slate-400 mt-1">Your Performance</p>
          </div>
        </div>
        
        <div className="py-12 text-center space-y-4">
          <div className="w-16 h-16 border-3 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto"></div>
          <div className="text-base text-slate-400">Loading stats...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Player Stats</h2>
            <p className="text-sm text-slate-400 mt-1">Your Performance</p>
          </div>
        </div>
        
        {stats && (
          <div className="flex items-center gap-2 px-10 py-5 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-green-300">Active</span>
          </div>
        )}
      </div>

      {stats && (
        <div className="space-y-5">
          {/* Wallet Address Card */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-md flex items-center justify-center">
                <span className="text-lg">🔑</span>
              </div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Wallet Address
              </div>
            </div>
            <div className="text-sm font-mono break-all text-blue-300 bg-slate-900/70 px-4 py-3 rounded-md border border-slate-800">
              {connectedAddress}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tiles Owned */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-5 hover:border-green-500/30 transition-colors">
              <div className="w-10 h-10 bg-green-600/20 rounded-md flex items-center justify-center mb-3">
                <span className="text-xl">🗺️</span>
              </div>
              <div className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                {stats.tilesOwned}
              </div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Tiles Owned
              </div>
            </div>

            {/* Items Placed */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-5 hover:border-blue-500/30 transition-colors">
              <div className="w-10 h-10 bg-blue-600/20 rounded-md flex items-center justify-center mb-3">
                <span className="text-xl">📦</span>
              </div>
              <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                {stats.itemsPlaced}
              </div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Items Placed
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-purple-600/20 rounded-md flex items-center justify-center">
                <span className="text-lg">📅</span>
              </div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Timeline
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-600/20 border border-amber-500/30 rounded-md flex items-center justify-center">
                    <span className="text-base">🎯</span>
                  </div>
                  <span className="text-sm font-medium text-slate-400">First Claim</span>
                </div>
                <span className="text-sm font-semibold text-slate-300 bg-slate-800/50 px-10 py-5 rounded">
                  {formatDate(stats.firstClaim)}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-600/20 border border-green-500/30 rounded-md flex items-center justify-center">
                    <span className="text-base">⚡</span>
                  </div>
                  <span className="text-sm font-medium text-slate-400">Last Activity</span>
                </div>
                <span className="text-sm font-semibold text-slate-300 bg-slate-800/50 px-10 py-5 rounded">
                  {formatDate(stats.lastActivity)}
                </span>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            disabled={loading}
            className="w-full px-5 py-3.5 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 hover:border-yellow-500/50 disabled:bg-slate-800 disabled:border-slate-700 rounded-lg text-sm font-bold text-yellow-300 hover:text-yellow-200 disabled:text-slate-500 transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-yellow-300/30 border-t-yellow-300 rounded-full animate-spin"></div>
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <span className="text-lg">↻</span>
                <span>Refresh Stats</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}