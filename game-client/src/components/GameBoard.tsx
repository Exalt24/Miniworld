import { useEffect, useRef, useState } from 'react';
import { useWorldState } from '../hooks/useWorldState';
import { useSelectedTileContext } from '../contexts/SelectedTileContext';
import { useGameSDK } from '../hooks/useGameSDK';
import { GRID_SIZE, TILE_SIZE, CANVAS_SIZE } from '../types';

export default function GameBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { worldState, loading } = useWorldState();
  const { selectedTileId, selectTile } = useSelectedTileContext();
  const { connectedAddress } = useGameSDK();
  const [hoveredTileId, setHoveredTileId] = useState<number | null>(null);

  const getTileColor = (tileId: number): string => {
    if (!worldState) return '#475569';

    const tile = worldState.tiles.find((t) => t.tileId === tileId);
    if (!tile) return '#475569';

    if (tile.owner === '0x0000000000000000000000000000000000000000') {
      return '#475569';
    }

    if (connectedAddress && tile.owner.toLowerCase() === connectedAddress.toLowerCase()) {
      return '#3b82f6';
    }

    return '#22c55e';
  };

  const drawTile = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tileId: number
  ) => {
    const pixelX = x * TILE_SIZE;
    const pixelY = y * TILE_SIZE;

    ctx.fillStyle = getTileColor(tileId);
    ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);

    if (tileId === selectedTileId) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.strokeRect(pixelX + 1.5, pixelY + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    } else if (tileId === hoveredTileId) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(pixelX + 1, pixelY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    } else {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    }

    if (worldState) {
      const tile = worldState.tiles.find((t) => t.tileId === tileId);
      if (tile && tile.itemType !== 0) {
        drawItem(ctx, pixelX, pixelY, tile.itemType);
      }
    }
  };

  const drawItem = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    itemType: number
  ) => {
    const centerX = x + TILE_SIZE / 2;
    const centerY = y + TILE_SIZE / 2;

    ctx.save();

    switch (itemType) {
      case 1: {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 12);
        ctx.lineTo(centerX - 8, centerY + 4);
        ctx.lineTo(centerX + 8, centerY + 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.fillRect(centerX - 2, centerY + 4, 4, 8);
        break;
      }

      case 2: {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 3: {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(centerX - 1, centerY - 12, 2, 12);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 12);
        ctx.lineTo(centerX + 10, centerY - 7);
        ctx.lineTo(centerX, centerY - 2);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 4: {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(centerX - 10, centerY - 8, 20, 16);

        ctx.fillStyle = '#64748b';
        ctx.fillRect(centerX - 8, centerY - 6, 6, 6);
        ctx.fillRect(centerX + 2, centerY - 6, 6, 6);
        ctx.fillRect(centerX - 8, centerY + 2, 6, 6);
        ctx.fillRect(centerX + 2, centerY + 2, 6, 6);
        break;
      }

      case 5: {
        ctx.fillStyle = '#06b6d4';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const tileId = y * GRID_SIZE + x;
        drawTile(ctx, x, y, tileId);
      }
    }
  };

  useEffect(() => {
    render();
  }, [worldState, selectedTileId, hoveredTileId, connectedAddress]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      const tileId = y * GRID_SIZE + x;
      selectTile(tileId);
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      const tileId = y * GRID_SIZE + x;
      setHoveredTileId(tileId);
    } else {
      setHoveredTileId(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredTileId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
          <div>
            <div className="text-slate-300 font-semibold text-sm">Loading world state...</div>
            <div className="text-xs text-slate-500 mt-1">Fetching 100 tiles</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Canvas Container */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="border-2 border-slate-700/50 rounded-lg cursor-pointer shadow-xl bg-slate-950 transition-all hover:border-slate-600/50"
          style={{
            imageRendering: 'pixelated',
          }}
        />
        {hoveredTileId !== null && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-lg">
            <div className="text-sm font-semibold text-slate-300 whitespace-nowrap">
              Tile #{hoveredTileId} • ({hoveredTileId % GRID_SIZE}, {Math.floor(hoveredTileId / GRID_SIZE)})
            </div>
          </div>
        )}
      </div>

      {/* Legends */}
      <div className="flex-1 w-full flex flex-col gap-2">
        {/* Tile Status Legend */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-700/50 rounded-md flex items-center justify-center">
              <span className="text-base">🎨</span>
            </div>
            <h3 className="text-sm font-bold text-slate-300">Tile Status</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-slate-600/50 transition-colors">
              <div className="w-5 h-5 bg-[#475569] border border-slate-600 rounded-sm shadow-sm flex-shrink-0"></div>
              <span className="text-sm font-medium text-slate-300">Unclaimed</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-green-500/30 transition-colors">
              <div className="w-5 h-5 bg-[#22c55e] border border-green-600 rounded-sm shadow-sm flex-shrink-0"></div>
              <span className="text-sm font-medium text-slate-300">Others</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-blue-500/30 transition-colors">
              <div className="w-5 h-5 bg-[#3b82f6] border border-blue-600 rounded-sm shadow-sm flex-shrink-0"></div>
              <span className="text-sm font-medium text-slate-300">Your Tiles</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-yellow-500/30 transition-colors">
              <div className="w-5 h-5 border-2 border-[#fbbf24] rounded-sm shadow-sm bg-slate-800 flex-shrink-0"></div>
              <span className="text-sm font-medium text-slate-300">Selected</span>
            </div>
          </div>
        </div>

        {/* Item Types Legend */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-emerald-700/50 rounded-md flex items-center justify-center">
              <span className="text-base">📦</span>
            </div>
            <h3 className="text-sm font-bold text-slate-300">Item Types</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-green-500/30 transition-colors">
              <span className="text-lg flex-shrink-0">🌲</span>
              <span className="text-sm font-medium text-slate-300">Tree</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-slate-500/30 transition-colors">
              <span className="text-lg flex-shrink-0">⚫</span>
              <span className="text-sm font-medium text-slate-300">Rock</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-red-500/30 transition-colors">
              <span className="text-lg flex-shrink-0">🚩</span>
              <span className="text-sm font-medium text-slate-300">Flag</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-gray-500/30 transition-colors">
              <span className="text-lg flex-shrink-0">🏢</span>
              <span className="text-sm font-medium text-slate-300">Building</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 rounded-md border border-slate-700/30 hover:border-cyan-500/30 transition-colors">
              <span className="text-lg flex-shrink-0">💧</span>
              <span className="text-sm font-medium text-slate-300">Water</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-slate-400">Real-time sync active</span>
          </div>
          {selectedTileId !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <span className="text-sm font-semibold text-yellow-300">
                Tile #{selectedTileId}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}