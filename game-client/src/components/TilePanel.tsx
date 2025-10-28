import { useState } from 'react';
import { useSelectedTileContext } from '../contexts/SelectedTileContext';
import { useGameSDK } from '../hooks/useGameSDK';
import { ItemType } from '../types';

export default function TilePanel() {
  const { isConnected } = useGameSDK();
  const {
    selectedTile,
    isOwnedByUser,
    canClaim,
    canPlaceItem,
    canRemoveItem,
    transaction,
    claimTile,
    placeItem,
    removeItem,
  } = useSelectedTileContext();

  const [selectedItemType, setSelectedItemType] = useState<number>(ItemType.Tree);

  if (!selectedTile) {
    return (
      <div className="group relative">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
        <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-2xl">⚙️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Tile Actions</h2>
              <p className="text-sm text-slate-400 mt-1">Interact with Tiles</p>
            </div>
          </div>

          <div className="py-12 text-center space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-2xl rounded-full"></div>
              <div className="relative text-6xl opacity-75 animate-pulse">👆</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-300 mb-2">
                Select a Tile
              </div>
              <div className="text-base text-slate-500">
                Click on the game board to get started
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isUnclaimed = selectedTile.owner === '0x0000000000000000000000000000000000000000';

  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
      <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-2xl">⚙️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Tile Actions</h2>
              <p className="text-sm text-slate-400 mt-1">Interact with Tiles</p>
            </div>
          </div>

          {selectedTile && (
            <div className="px-10 py-5 bg-cyan-500/10 border border-cyan-500/20 rounded-md ">
              <span className="text-sm font-bold text-cyan-300">
                #{selectedTile.tileId}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Tile Info Card */}
          <div className="relative overflow-hidden group/tile">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover/tile:opacity-100 transition-opacity rounded-lg"></div>
            <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-sm border border-slate-700/50 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                    <span className="text-3xl">🗺️</span>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Selected Tile</div>
                    <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      #{selectedTile.tileId}
                    </div>
                  </div>
                </div>
                <div className="px-10 py-5 bg-slate-800/50 rounded-md border border-slate-700/50">
                  <div className="text-sm text-slate-400 mb-1">Position</div>
                  <div className="text-base font-bold text-slate-300">
                    ({selectedTile.x}, {selectedTile.y})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Owner & Item Info */}
          <div className="space-y-4">
            <div className="relative overflow-hidden group/info">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-green-500/10 opacity-0 group-hover/info:opacity-100 transition-opacity rounded-lg"></div>
              <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-md flex items-center justify-center">
                      <span className="text-lg">👤</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-400">Owner</span>
                  </div>
                  <div className="font-mono text-sm">
                    {isUnclaimed ? (
                      <span className="px-10 py-5 bg-slate-700/50 text-slate-400 rounded-md border border-slate-600/50">
                        Unclaimed
                      </span>
                    ) : isOwnedByUser ? (
                      <span className="px-10 py-5 bg-blue-500/20 text-blue-300 rounded-md border border-blue-500/30 font-bold">
                        You
                      </span>
                    ) : (
                      <span className="px-10 py-5 bg-slate-800/50 text-slate-300 rounded-md border border-slate-700/50">
                        {selectedTile.owner.slice(0, 6)}...{selectedTile.owner.slice(-4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden group/item">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover/item:opacity-100 transition-opacity rounded-lg"></div>
              <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-md flex items-center justify-center">
                      <span className="text-lg">📦</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-400">Current Item</span>
                  </div>
                  <span className="px-10 py-5 bg-slate-800/50 text-white text-sm font-semibold rounded-md border border-slate-700/50">
                    {selectedTile.itemTypeName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Error */}
          {transaction.error && (
            <div className="relative overflow-hidden animate-shake">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-lg"></div>
              <div className="relative bg-gradient-to-br from-red-900/50 to-rose-900/50 backdrop-blur-sm border border-red-500/50 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-red-500/20 border border-red-500/30 rounded-md flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">⚠️</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-200 mb-1">Transaction Failed</div>
                    <div className="text-sm text-red-300">{transaction.error}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Pending */}
          {transaction.pending && (
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-lg"></div>
              <div className="relative bg-gradient-to-br from-yellow-900/50 to-amber-900/50 backdrop-blur-sm border border-yellow-500/50 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 border border-yellow-500/30 rounded-md flex items-center justify-center flex-shrink-0">
                    <div className="w-5 h-5 border-2 border-yellow-300/30 border-t-yellow-300 rounded-full animate-spin"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-yellow-200 mb-2">
                      {transaction.type === 'claim' && 'Claiming tile...'}
                      {transaction.type === 'place' && 'Placing item...'}
                      {transaction.type === 'remove' && 'Removing item...'}
                    </div>
                    {transaction.hash && (
                      <div className="mt-2 px-3 py-2 bg-yellow-950/50 rounded-md border border-yellow-800/50">
                        <div className="text-sm text-yellow-300 font-mono break-all">
                          TX: {transaction.hash.slice(0, 10)}...{transaction.hash.slice(-8)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Not Connected State */}
          {!isConnected && (
            <div className="py-12 text-center space-y-4">
              <div className="text-6xl opacity-50">🔐</div>
              <div>
                <div className="text-base font-semibold text-slate-400 mb-2">
                  Wallet Not Connected
                </div>
                <div className="text-sm text-slate-500">
                  Connect your wallet to interact
                </div>
              </div>
            </div>
          )}

          {/* Claim Button */}
          {isConnected && canClaim && (
            <button
              onClick={claimTile}
              disabled={transaction.pending}
              className="group/btn relative w-full overflow-hidden"
            >

              <div className="relative px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-800 rounded-lg font-bold text-base text-white disabled:text-slate-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed shadow-lg shadow-green-500/25 hover:shadow-green-500/40 flex items-center justify-center gap-3">
                {transaction.pending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Claiming...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">🎯</span>
                    <span>Claim Tile</span>
                  </>
                )}
              </div>
            </button>
          )}

          {/* Place Item Section */}
          {isConnected && canPlaceItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 rounded-md border border-slate-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-md flex items-center justify-center">
                  <span className="text-lg">📦</span>
                </div>
                <span className="text-sm font-semibold text-slate-300">Place New Item</span>
              </div>

              <select
                title="Select Item Type"
                value={selectedItemType}
                onChange={(e) => setSelectedItemType(Number(e.target.value))}
                disabled={transaction.pending}
                className="w-full px-4 py-3.5 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 hover:border-slate-600 focus:border-blue-500  rounded-lg text-base font-medium text-slate-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%2394a3b8' d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 1rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px 16px',
                }}
              >
                <option value={ItemType.Empty}>⚪ Empty</option>
                <option value={ItemType.Tree}>🌲 Tree</option>
                <option value={ItemType.Rock}>⚫ Rock</option>
                <option value={ItemType.Flag}>🚩 Flag</option>
                <option value={ItemType.Building}>🏢 Building</option>
                <option value={ItemType.Water}>💧 Water</option>
              </select>

              <button
                onClick={() => placeItem(selectedItemType)}
                disabled={transaction.pending}
                className="group/btn relative w-full overflow-hidden"
              >
                <div className="relative px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-800 rounded-lg font-bold text-base text-white disabled:text-slate-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center justify-center gap-3">
                  {transaction.pending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Placing...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">📦</span>
                      <span>Place Item</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Remove Item Button */}
          {isConnected && canRemoveItem && (
            <button
              onClick={removeItem}
              disabled={transaction.pending}
              className="group/btn relative w-full overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 opacity-0 group-hover/btn:opacity-100 transition-opacity blur-xl"></div>
              <div className="relative px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-slate-700 disabled:to-slate-800 rounded-lg font-bold text-base text-white disabled:text-slate-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 hover:shadow-red-500/40 flex items-center justify-center gap-3">
                {transaction.pending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">🗑️</span>
                    <span>Remove Item</span>
                  </>
                )}
              </div>
            </button>
          )}

          {/* Owned by Others State */}
          {isConnected && !canClaim && !canPlaceItem && !canRemoveItem && !isOwnedByUser && (
            <div className="py-12 text-center space-y-4">
              <div className="text-6xl opacity-50">🔒</div>
              <div>
                <div className="text-base font-semibold text-slate-400 mb-2">
                  Tile Owned by Another Player
                </div>
                <div className="text-sm text-slate-500">
                  You can only interact with tiles you own
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}