export const GRID_SIZE = 10;
export const TILE_SIZE = 50;
export const CANVAS_SIZE = GRID_SIZE * TILE_SIZE;

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
  lastModified: string;
  x: number;
  y: number;
}

export interface ActivityItem {
  id: number;
  eventType: 'TileClaimed' | 'ItemPlaced' | 'ItemRemoved';
  tileId: number;
  playerAddress: string;
  itemType?: number | null;
  blockNumber: number;
  transactionHash: string;
  timestamp: string;
  createdAt: string;
}

export interface PlayerInfo {
  address: string;
  tilesOwned: number;
  itemsPlaced: number;
  firstClaim: string | null;
  lastActivity: string | null;
}

export interface TimeSeriesData {
  date: string;
  claims: number;
}

export interface ItemDistribution {
  name: string;
  value: number;
  fill: string;
}

export interface PlayerActivity {
  address: string;
  tilesOwned: number;
  itemsPlaced: number;
}

export interface AnalyticsData {
  stats: any;
  timeSeriesData: TimeSeriesData[];
  itemDistribution: ItemDistribution[];
  topPlayers: PlayerActivity[];
}
