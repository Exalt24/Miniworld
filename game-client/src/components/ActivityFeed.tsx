import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameSDK } from '../hooks/useGameSDK';
import { ItemTypeNames } from '../types';
import type { ActivityItem } from '../types';

export default function ActivityFeed() {
  const { sdk, connectedAddress } = useGameSDK();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const fetchActivities = useCallback(async () => {
    if (!sdk) return;

    try {
      const response = await sdk.getActivity(20);
      setActivities(response.events);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (!sdk) return;

    const handleTileClaimed = (data: any) => {
      const newActivity: ActivityItem = {
        id: Date.now(),
        eventType: 'TileClaimed',
        tileId: data.tileId,
        playerAddress: data.owner,
        itemType: null,
        blockNumber: 0,
        transactionHash: data.transactionHash || '',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setActivities((prev) => [newActivity, ...prev].slice(0, 20));
      scrollToTop();
    };

    const handleItemPlaced = (data: any) => {
      const newActivity: ActivityItem = {
        id: Date.now(),
        eventType: 'ItemPlaced',
        tileId: data.tileId,
        playerAddress: data.owner,
        itemType: data.itemType,
        blockNumber: 0,
        transactionHash: data.transactionHash || '',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setActivities((prev) => [newActivity, ...prev].slice(0, 20));
      scrollToTop();
    };

    const handleItemRemoved = (data: any) => {
      const newActivity: ActivityItem = {
        id: Date.now(),
        eventType: 'ItemRemoved',
        tileId: data.tileId,
        playerAddress: data.owner,
        itemType: null,
        blockNumber: 0,
        transactionHash: data.transactionHash || '',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setActivities((prev) => [newActivity, ...prev].slice(0, 20));
      scrollToTop();
    };

    const handleTransactionConfirmed = (data: any) => {
      console.log('ActivityFeed: Transaction confirmed', data);
      
      let eventType = '';
      let itemType = null;

      if (data.type === 'claimTile') {
        eventType = 'TileClaimed';
      } else if (data.type === 'placeItem') {
        eventType = 'ItemPlaced';
        itemType = data.itemType;
      } else if (data.type === 'removeItem') {
        eventType = 'ItemRemoved';
      }

      if (eventType) {
        const newActivity: ActivityItem = {
          id: Date.now(),
          eventType,
          tileId: data.tileId,
          playerAddress: data.owner || connectedAddress || '',
          itemType,
          blockNumber: data.blockNumber || 0,
          transactionHash: data.hash || '',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        setActivities((prev) => [newActivity, ...prev].slice(0, 20));
        scrollToTop();
      }
    };

    sdk.on('tileClaimed', handleTileClaimed);
    sdk.on('itemPlaced', handleItemPlaced);
    sdk.on('itemRemoved', handleItemRemoved);
    sdk.on('transactionConfirmed', handleTransactionConfirmed);

    return () => {
      sdk.off('tileClaimed', handleTileClaimed);
      sdk.off('itemPlaced', handleItemPlaced);
      sdk.off('itemRemoved', handleItemRemoved);
      sdk.off('transactionConfirmed', handleTransactionConfirmed);
    };
  }, [sdk, connectedAddress]);

  const scrollToTop = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, []);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getEventIcon = (eventType: string): string => {
    switch (eventType) {
      case 'TileClaimed':
        return '🎯';
      case 'ItemPlaced':
        return '📦';
      case 'ItemRemoved':
        return '🗑️';
      default:
        return '📝';
    }
  };

  const getEventColor = (eventType: string): string => {
    switch (eventType) {
      case 'TileClaimed':
        return 'from-blue-500/10 to-blue-600/10 border-blue-500/20';
      case 'ItemPlaced':
        return 'from-green-500/10 to-green-600/10 border-green-500/20';
      case 'ItemRemoved':
        return 'from-red-500/10 to-red-600/10 border-red-500/20';
      default:
        return 'from-slate-500/10 to-slate-600/10 border-slate-500/20';
    }
  };

  const getEventDescription = (activity: ActivityItem): string => {
    const isOwnAction =
      connectedAddress &&
      activity.playerAddress.toLowerCase() === connectedAddress.toLowerCase();

    const actor = isOwnAction ? 'You' : `${activity.playerAddress.slice(0, 6)}...${activity.playerAddress.slice(-4)}`;

    switch (activity.eventType) {
      case 'TileClaimed':
        return `${actor} claimed tile #${activity.tileId}`;
      case 'ItemPlaced':
        return `${actor} placed ${ItemTypeNames[activity.itemType || 0]} on tile #${activity.tileId}`;
      case 'ItemRemoved':
        return `${actor} removed item from tile #${activity.tileId}`;
      default:
        return `${actor} performed action on tile #${activity.tileId}`;
    }
  };

  const isOwnActivity = (activity: ActivityItem): boolean => {
    return (
      connectedAddress !== null &&
      activity.playerAddress.toLowerCase() === connectedAddress.toLowerCase()
    );
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📡</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Activity Feed</h2>
              <p className="text-sm text-slate-400 mt-1">Live Event Stream</p>
            </div>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
            <div className="text-base text-slate-400">Loading activity...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📡</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Activity Feed</h2>
            <p className="text-sm text-slate-400 mt-1">Live Event Stream</p>
          </div>
        </div>
        <button
          onClick={fetchActivities}
          className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm font-semibold text-purple-300 transition-all flex items-center gap-2"
        >
          <span className="text-lg">↻</span>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-6xl opacity-40">📭</div>
            <div>
              <div className="text-lg font-semibold text-slate-300 mb-2">No activity yet</div>
              <div className="text-base text-slate-500">Be the first to claim a tile!</div>
            </div>
            <div className="inline-flex items-center gap-2.5 px-10 py-5 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-400">Listening for events...</span>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={feedRef}
          className="space-y-4 h-80 overflow-y-auto pr-3"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#8b5cf6 #1e293b',
          }}
        >
          {activities.map((activity, index) => (
            <div
              key={`${activity.id}-${activity.transactionHash}-${activity.createdAt}`}
              className={`transition-all duration-200 ${index === 0 ? 'animate-fade-in' : ''}`}
            >
              <div
                className={`relative p-5 rounded-lg border backdrop-blur-sm transition-all ${
                  isOwnActivity(activity)
                    ? 'bg-gradient-to-r from-blue-600/15 to-purple-600/15 border-blue-500/30'
                    : `bg-gradient-to-r ${getEventColor(activity.eventType)}`
                }`}
              >
                {isOwnActivity(activity) && (
                  <div className="absolute top-3 right-3">
                    <div className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded">
                      <span className="text-xs font-bold text-blue-300">YOU</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                      activity.eventType === 'TileClaimed' ? 'bg-blue-500/20 border border-blue-500/30' :
                      activity.eventType === 'ItemPlaced' ? 'bg-green-500/20 border border-green-500/30' :
                      'bg-red-500/20 border border-red-500/30'
                    }`}>
                      <span className="text-2xl">{getEventIcon(activity.eventType)}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-slate-100 mb-3">
                      {getEventDescription(activity)}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                        <span className="text-slate-400">
                          {formatTimestamp(activity.createdAt)}
                        </span>
                      </div>
                      
                      {activity.transactionHash && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded border border-slate-600/30">
                          <span className="text-slate-500">TX:</span>
                          <span className="text-slate-400 font-mono">
                            {activity.transactionHash.slice(0, 6)}...
                            {activity.transactionHash.slice(-4)}
                          </span>
                        </div>
                      )}
                      
                      {activity.eventType === 'ItemPlaced' && activity.itemType !== null && (
                        <div className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded">
                          <span className="text-green-300 font-semibold">
                            {ItemTypeNames[activity.itemType]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-slate-700/50">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></div>
            <span>Showing last 20 events</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-10 py-5 bg-blue-500/10 border border-blue-500/20 rounded">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-blue-300 font-semibold">Your actions</span>
            </div>
            <div className="px-10 py-5 bg-slate-700/30 border border-slate-600/30 rounded">
              <span className="text-slate-400">{activities.length} events</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}