import { useEffect, useRef, useState } from 'react';
import { useGameSDK } from '../hooks/useGameSDK';
import { GRID_SIZE, TILE_SIZE, CANVAS_SIZE, ItemTypeNames } from '../types';
import type { Tile } from '../types';

export default function WorldOverview() {
  const { sdk, isInitialized } = useGameSDK();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [worldState, setWorldState] = useState<Tile[]>([]);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;

    fetchWorldState();
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    const handleUpdate = () => {
      fetchWorldState();
    };

    sdk.on('tileClaimed', handleUpdate);
    sdk.on('itemPlaced', handleUpdate);
    sdk.on('itemRemoved', handleUpdate);
    sdk.on('worldUpdate', handleUpdate);

    return () => {
      sdk.off('tileClaimed', handleUpdate);
      sdk.off('itemPlaced', handleUpdate);
      sdk.off('itemRemoved', handleUpdate);
      sdk.off('worldUpdate', handleUpdate);
    };
  }, [sdk, isInitialized]);

  useEffect(() => {
    if (worldState.length > 0) {
      renderCanvas();
    }
  }, [worldState, selectedTile]);

  const fetchWorldState = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sdk.getWorldState();
      setWorldState(data.tiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch world state';
      setError(message);
      console.error('World state fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const tileId = y * GRID_SIZE + x;
        const tile = worldState.find(t => t.tileId === tileId);

        if (tile) {
          const isSelected = selectedTile?.tileId === tileId;
          drawTile(ctx, x, y, tile, isSelected);
          drawItem(ctx, x, y, tile.itemType);
        }
      }
    }
  };

  const drawTile = (ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, isSelected: boolean) => {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;

    if (tile.owner === '0x0000000000000000000000000000000000000000') {
      ctx.fillStyle = '#475569';
    } else {
      ctx.fillStyle = '#22c55e';
    }

    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    if (isSelected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
  };

  const drawItem = (ctx: CanvasRenderingContext2D, x: number, y: number, itemType: number) => {
    if (itemType === 0) return;

    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;
    const size = TILE_SIZE * 0.5;

    ctx.save();

    switch (itemType) {
      case 1:
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(px, py - size * 0.6);
        ctx.lineTo(px - size * 0.4, py + size * 0.2);
        ctx.lineTo(px + size * 0.4, py + size * 0.2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#92400e';
        ctx.fillRect(px - size * 0.1, py + size * 0.2, size * 0.2, size * 0.3);
        break;

      case 2:
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.arc(px, py, size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.arc(px - size * 0.15, py - size * 0.15, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 3:
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py - size * 0.5);
        ctx.lineTo(px, py + size * 0.5);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(px, py - size * 0.5);
        ctx.lineTo(px + size * 0.4, py - size * 0.2);
        ctx.lineTo(px, py);
        ctx.closePath();
        ctx.fill();
        break;

      case 4:
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(px - size * 0.4, py - size * 0.4, size * 0.8, size * 0.8);

        ctx.fillStyle = '#1e293b';
        const windowSize = size * 0.15;
        const windowGap = size * 0.25;
        ctx.fillRect(px - windowGap, py - windowGap, windowSize, windowSize);
        ctx.fillRect(px + windowGap - windowSize, py - windowGap, windowSize, windowSize);
        ctx.fillRect(px - windowGap, py + windowGap - windowSize, windowSize, windowSize);
        ctx.fillRect(px + windowGap - windowSize, py + windowGap - windowSize, windowSize, windowSize);
        break;

      case 5:
        ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.beginPath();
        ctx.arc(px, py, size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(165, 243, 252, 0.5)';
        ctx.beginPath();
        ctx.arc(px - size * 0.15, py - size * 0.15, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      const tileId = y * GRID_SIZE + x;
      const tile = worldState.find(t => t.tileId === tileId);
      if (tile) {
        setSelectedTile(tile);
      }
    }
  };

  if (loading && worldState.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">🗺️ World Overview</h2>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <div className="text-slate-400">Loading world state...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">🗺️ World Overview</h2>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
          <div className="text-red-400 font-semibold mb-2">Failed to load world state</div>
          <div className="text-sm text-slate-300 mb-4">{error}</div>
          <button
            onClick={fetchWorldState}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const claimedTiles = worldState.filter(t => t.owner !== '0x0000000000000000000000000000000000000000').length;
  const unclaimedTiles = 100 - claimedTiles;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🗺️ World Overview</h2>
        <button
          onClick={fetchWorldState}
          disabled={loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? '⏳ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Interactive Minimap</h3>
            <div className="text-xs text-slate-400">Click any tile for details</div>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                onClick={handleCanvasClick}
                className="border-2 border-slate-700 rounded-lg cursor-pointer"
                style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              />
            </div>

            <div className="flex-1 space-y-4">
              <div className="bg-slate-900 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-3">Legend</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#475569] border border-slate-700 rounded"></div>
                    <span>Unclaimed ({unclaimedTiles})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#22c55e] border border-slate-700 rounded"></div>
                    <span>Claimed ({claimedTiles})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#fbbf24] rounded"></div>
                    <span>Selected Tile</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-3">Item Types</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span>🌲</span>
                    <span>Tree</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>⚫</span>
                    <span>Rock</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🚩</span>
                    <span>Flag</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🏢</span>
                    <span>Building</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>💧</span>
                    <span>Water</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {selectedTile ? 'Tile Details' : 'World Statistics'}
          </h3>

          {selectedTile ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-400 mb-1">Tile ID</div>
                <div className="text-lg font-semibold">#{selectedTile.tileId}</div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Position</div>
                <div className="text-sm font-mono">({selectedTile.x}, {selectedTile.y})</div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Owner</div>
                <div className="text-sm font-mono break-all">
                  {selectedTile.owner === '0x0000000000000000000000000000000000000000' 
                    ? 'Unclaimed' 
                    : selectedTile.owner}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Item</div>
                <div className="text-sm">{ItemTypeNames[selectedTile.itemType]}</div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Last Modified</div>
                <div className="text-sm">
                  {selectedTile.lastModified === '0' 
                    ? 'Never' 
                    : new Date(Number(selectedTile.lastModified) * 1000).toLocaleString()}
                </div>
              </div>

              <button
                onClick={() => setSelectedTile(null)}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="text-2xl font-bold mb-1">{claimedTiles}</div>
                <div className="text-xs text-slate-400">Tiles Claimed</div>
              </div>

              <div className="bg-slate-900 rounded-lg p-4">
                <div className="text-2xl font-bold mb-1">{unclaimedTiles}</div>
                <div className="text-xs text-slate-400">Tiles Available</div>
              </div>

              <div className="bg-slate-900 rounded-lg p-4">
                <div className="text-2xl font-bold mb-1">{Math.round(claimedTiles)}%</div>
                <div className="text-xs text-slate-400">World Claimed</div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <div className="text-xs text-slate-400 text-center">
                  Click any tile on the map to view details
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}