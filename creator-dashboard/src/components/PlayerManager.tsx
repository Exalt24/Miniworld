import { useState, useEffect } from 'react';
import { useSDKContext } from '../contexts/SDKContext';
import type { PlayerInfo } from '../types';

type SortField = 'address' | 'tilesOwned' | 'itemsPlaced' | 'firstClaim' | 'lastActivity';
type SortOrder = 'asc' | 'desc';

export default function PlayerManager() {
  const { sdk, isInitialized } = useSDKContext();
  
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedPlayerAddress, setSelectedPlayerAddress] = useState<string | null>(null);
  
  const selectedPlayer = selectedPlayerAddress 
    ? players.find(p => p.address === selectedPlayerAddress) || null
    : null;

  useEffect(() => {
    if (selectedPlayerAddress && !selectedPlayer) {
      setSelectedPlayerAddress(null);
    }
  }, [selectedPlayerAddress, selectedPlayer]);

  useEffect(() => {
    if (!sdk || !isInitialized) return;

    const fetchPlayers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const worldResponse = await fetch(`${import.meta.env.VITE_API_URL}/world`);
        if (!worldResponse.ok) throw new Error('Failed to fetch world state');
        const worldData = await worldResponse.json();
        
        const activityResponse = await fetch(`${import.meta.env.VITE_API_URL}/activity`);
        if (!activityResponse.ok) throw new Error('Failed to fetch activity');
        const activityRaw = await activityResponse.json();
        
        console.log('PlayerManager: Received world data:', worldData);
        console.log('PlayerManager: Received activity data:', activityRaw);
        
        // Handle different response formats for world data
        let tiles: any[] = [];
        if (Array.isArray(worldData)) {
          tiles = worldData;
        } else if (worldData && Array.isArray(worldData.tiles)) {
          tiles = worldData.tiles;
        } else {
          console.warn('PlayerManager: Unexpected world data format');
        }
        
        // Handle different response formats for activity data
        let activityData: any[] = [];
        if (Array.isArray(activityRaw)) {
          activityData = activityRaw;
        } else if (activityRaw && Array.isArray(activityRaw.activity)) {
          activityData = activityRaw.activity;
        } else if (activityRaw && Array.isArray(activityRaw.events)) {
          activityData = activityRaw.events;
        } else {
          console.warn('PlayerManager: Unexpected activity data format, expected array');
        }
        
        console.log('PlayerManager: Processed tiles:', tiles.length);
        console.log('PlayerManager: Processed activity:', activityData.length);
        
        const playerMap = new Map<string, PlayerInfo>();
        
        tiles.forEach((tile: any) => {
          if (tile.owner && tile.owner !== '0x0000000000000000000000000000000000000000') {
            if (!playerMap.has(tile.owner)) {
              playerMap.set(tile.owner, {
                address: tile.owner,
                tilesOwned: 0,
                itemsPlaced: 0,
                firstClaim: null,
                lastActivity: null,
              });
            }
            const player = playerMap.get(tile.owner)!;
            player.tilesOwned++;
            if (tile.itemType > 0) {
              player.itemsPlaced++;
            }
          }
        });
        
        activityData.forEach((activity: any) => {
          const address = activity.playerAddress;
          if (!playerMap.has(address)) {
            playerMap.set(address, {
              address,
              tilesOwned: 0,
              itemsPlaced: 0,
              firstClaim: null,
              lastActivity: null,
            });
          }
          
          const player = playerMap.get(address)!;
          const activityTime = activity.timestamp;
          
          if (!player.firstClaim || activityTime < player.firstClaim) {
            player.firstClaim = activityTime;
          }
          
          if (!player.lastActivity || activityTime > player.lastActivity) {
            player.lastActivity = activityTime;
          }
        });
        
        const playerList = Array.from(playerMap.values());
        console.log('PlayerManager: Final player list:', playerList.length, 'players');
        
        setPlayers(playerList);
        setFilteredPlayers(playerList);
      } catch (err) {
        console.error('PlayerManager: Error fetching players:', err);
        setError(err instanceof Error ? err.message : 'Failed to load players');
        setPlayers([]);
        setFilteredPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();

    const handleWorldUpdate = () => {
      fetchPlayers();
    };

    sdk.on('tileClaimed', handleWorldUpdate);
    sdk.on('itemPlaced', handleWorldUpdate);
    sdk.on('itemRemoved', handleWorldUpdate);

    return () => {
      sdk.off('tileClaimed', handleWorldUpdate);
      sdk.off('itemPlaced', handleWorldUpdate);
      sdk.off('itemRemoved', handleWorldUpdate);
    };
  }, [sdk, isInitialized]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [players, searchTerm, sortField, sortOrder]);

  const applyFiltersAndSort = () => {
    let filtered = [...players];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.address.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'firstClaim' || sortField === 'lastActivity') {
        aValue = parseTimestamp(aValue || '0');
        bValue = parseTimestamp(bValue || '0');
      }

      if (aValue === null || aValue === undefined || aValue === 0) return 1;
      if (bValue === null || bValue === undefined || bValue === 0) return -1;

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPlayers(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === '0') return 'N/A';
    
    try {
      let date: Date;
      
      // Handle different timestamp formats
      if (typeof dateString === 'string') {
        date = new Date(dateString);
        
        // If invalid, try as Unix timestamp (seconds)
        if (isNaN(date.getTime())) {
          const numTimestamp = Number(dateString);
          if (!isNaN(numTimestamp)) {
            date = new Date(numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp);
          } else {
            return 'Invalid Date';
          }
        }
      } else {
        return 'N/A';
      }
      
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      console.error('Error formatting date:', dateString, err);
      return 'Invalid Date';
    }
  };

  const parseTimestamp = (timestamp: string | number): number => {
    if (!timestamp || timestamp === '0') return 0;
    
    try {
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) return date.getTime();
        
        const numTimestamp = Number(timestamp);
        if (!isNaN(numTimestamp)) {
          return numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp;
        }
      } else {
        return timestamp < 10000000000 ? timestamp * 1000 : timestamp;
      }
    } catch (err) {
      console.error('Error parsing timestamp:', timestamp, err);
    }
    return 0;
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-6">Player Management</h2>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-6">Player Management</h2>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error loading players: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Player Management</h2>
        <div className="text-sm text-slate-400">
          {filteredPlayers.length} {filteredPlayers.length === 1 ? 'player' : 'players'}
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by address..."
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th 
                onClick={() => handleSort('address')}
                className="text-left py-3 px-4 text-sm font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  Player Address
                  <span className="text-xs">{getSortIcon('address')}</span>
                </div>
              </th>
              <th 
                onClick={() => handleSort('tilesOwned')}
                className="text-left py-3 px-4 text-sm font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  Tiles Owned
                  <span className="text-xs">{getSortIcon('tilesOwned')}</span>
                </div>
              </th>
              <th 
                onClick={() => handleSort('itemsPlaced')}
                className="text-left py-3 px-4 text-sm font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  Items Placed
                  <span className="text-xs">{getSortIcon('itemsPlaced')}</span>
                </div>
              </th>
              <th 
                onClick={() => handleSort('firstClaim')}
                className="text-left py-3 px-4 text-sm font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  First Claim
                  <span className="text-xs">{getSortIcon('firstClaim')}</span>
                </div>
              </th>
              <th 
                onClick={() => handleSort('lastActivity')}
                className="text-left py-3 px-4 text-sm font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  Last Activity
                  <span className="text-xs">{getSortIcon('lastActivity')}</span>
                </div>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="text-slate-400">
                    {searchTerm ? 'No players match your search' : 'No players yet'}
                  </div>
                </td>
              </tr>
            ) : (
              filteredPlayers.map((player) => (
                <tr 
                  key={player.address}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <code className="text-sm text-slate-300 bg-slate-900/50 px-2 py-1 rounded">
                      {formatAddress(player.address)}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{player.tilesOwned}</span>
                      <span className="text-xs text-slate-500">tiles</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{player.itemsPlaced}</span>
                      <span className="text-xs text-slate-500">items</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-400">
                      {formatDate(player.firstClaim)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-400">
                      {formatDate(player.lastActivity)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedPlayerAddress(player.address)}
                      className="text-sm text-blue-400 hover:text-blue-300 underline"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Player Details</h3>
              <button
                onClick={() => setSelectedPlayerAddress(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-400 mb-1">Address</div>
                <code className="text-sm text-white bg-slate-900/50 px-2 py-1 rounded block break-all">
                  {selectedPlayer.address}
                </code>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Tiles Owned</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {selectedPlayer.tilesOwned}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-slate-400 mb-1">Items Placed</div>
                  <div className="text-2xl font-bold text-green-400">
                    {selectedPlayer.itemsPlaced}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400 mb-1">First Claim</div>
                <div className="text-sm text-white">
                  {formatDate(selectedPlayer.firstClaim)}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400 mb-1">Last Activity</div>
                <div className="text-sm text-white">
                  {formatDate(selectedPlayer.lastActivity)}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <button
                  onClick={() => setSelectedPlayerAddress(null)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}