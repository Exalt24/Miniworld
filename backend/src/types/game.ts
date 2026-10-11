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
  itemType: ItemType;
  lastModified: bigint;
  x: number;
  y: number;
}

export interface WorldState {
  tiles: Tile[];
  lastUpdated: Date;
}

export type ContractEventType = 'TileClaimed' | 'ItemPlaced' | 'ItemRemoved';

// An event as decoded from the chain by EventListener (ethers returns bigint for uint args).
export interface ContractEvent {
  eventType: ContractEventType;
  tileId: bigint | number;
  owner: string;
  itemType?: bigint | number;
  timestamp: bigint | number;
  blockNumber: number;
  transactionHash: string;
}

export interface ActivityItem {
  id: number;
  eventType: ContractEventType;
  tileId: number;
  playerAddress: string;
  itemType: number | null;
  itemTypeName: string | null;
  timestamp: string;
  transactionHash: string;
  createdAt: Date;
}
