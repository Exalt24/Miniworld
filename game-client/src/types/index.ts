export const GRID_SIZE = 10;
export const TILE_SIZE = 50;
export const CANVAS_SIZE = GRID_SIZE * TILE_SIZE;

export enum ItemType {
  Empty = 0,
  Tree = 1,
  Rock = 2,
  Flag = 3,
  Building = 4,
  Water = 5,
}

export const ItemTypeNames: Record<number, string> = {
  0: 'Empty',
  1: 'Tree',
  2: 'Rock',
  3: 'Flag',
  4: 'Building',
  5: 'Water',
};

export interface Tile {
  tileId: number;
  owner: string;
  itemType: number;
  itemTypeName?: string | null;
  lastModified: string;
  x: number;
  y: number;
}

export interface WorldState {
  tiles: Tile[];
  totalTiles: number;
  lastUpdated: string;
}

export interface ActivityItem {
  id: number;
  eventType: 'TileClaimed' | 'ItemPlaced' | 'ItemRemoved';
  tileId: number;
  playerAddress: string;
  itemType: number | null;
  blockNumber: number;
  transactionHash: string;
  timestamp: string;
  createdAt: string;
}

export interface PlayerStats {
  playerAddress: string;
  tilesOwned: number;
  itemsPlaced: number;
  firstClaim: string | null;
  lastActivity: string | null;
}
