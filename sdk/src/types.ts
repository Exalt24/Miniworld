/**
 * TypeScript type definitions for MiniWorld SDK
 * 
 * Defines all interfaces, types, and enums used throughout the SDK
 */

// ============================================================================
// GLOBAL WINDOW ETHEREUM EXTENSION
// ============================================================================

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

// ============================================================================
// ENUMS
// ============================================================================

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

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface SDKConfig {
  contractAddress: string;
  apiUrl: string;
  wsUrl: string;
  rpcUrl?: string;
  autoConnectWebSocket?: boolean;
}

// ============================================================================
// GAME STATE
// ============================================================================

export interface Tile {
  tileId: number;
  owner: string;
  itemType: number;
  itemTypeName: string;
  lastModified: string;
  x: number;
  y: number;
}

export interface WorldState {
  tiles: Tile[];
  totalTiles: number;
  lastUpdated: string;
}

export interface PlayerTiles {
  playerAddress: string;
  tiles: Tile[];
  totalTiles: number;
}

// ============================================================================
// EVENTS & ACTIVITY
// ============================================================================

export type EventType = 'TileClaimed' | 'ItemPlaced' | 'ItemRemoved';

export interface ActivityItem {
  id: number;
  eventType: string;
  tileId: number;
  playerAddress: string;
  itemType?: number;
  blockNumber: string;
  transactionHash: string;
  timestamp: string;
  createdAt: string;
}

export interface ActivityFeed {
  events: ActivityItem[];
  count: number;
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface GameStats {
  totalClaims: number;
  uniquePlayers: number;
  totalEvents: number;
  itemsByType: {
    Empty: number;
    Tree: number;
    Rock: number;
    Flag: number;
    Building: number;
    Water: number;
  };
}

export interface PlayerStats {
  playerAddress: string;
  tilesOwned: number;
  itemsPlaced: number;
  firstClaim: string | null;
  lastActivity: string | null;
}

export interface SyncStatus {
  lastSyncedBlock: string;
  lastSyncTime: string;
}

// ============================================================================
// BLOCKCHAIN EVENTS (Raw from contract)
// ============================================================================

export interface ContractEvent {
  tileId: number;
  owner: string;
  itemType?: number;
  timestamp: bigint;
  transactionHash: string;
  blockNumber: number;
}

// ============================================================================
// TRANSACTION
// ============================================================================

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  error?: string;
}

// ============================================================================
// SDK EVENTS (for event emitter)
// ============================================================================

export type SDKEventType =
  | 'connected'
  | 'disconnected'
  | 'accountChanged'
  | 'transactionStarted'
  | 'transactionSubmitted'
  | 'transactionConfirmed'
  | 'transactionFailed'
  | 'tileClaimed'
  | 'itemPlaced'
  | 'itemRemoved'
  | 'worldUpdate'
  | 'wsConnected'
  | 'wsDisconnected'
  | 'error';

export type SDKEventCallback = (data: any) => void;

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SDKError extends Error {
  constructor(
    message: string,
    public code?: string,
    public data?: any
  ) {
    super(message);
    this.name = 'SDKError';
  }
}

export class WalletError extends SDKError {
  constructor(message: string, data?: any) {
    super(message, 'WALLET_ERROR', data);
    this.name = 'WalletError';
  }
}

export class APIError extends SDKError {
  constructor(message: string, public statusCode?: number, data?: any) {
    super(message, 'API_ERROR', data);
    this.name = 'APIError';
  }
}

export class ContractError extends SDKError {
  constructor(message: string, data?: any) {
    super(message, 'CONTRACT_ERROR', data);
    this.name = 'ContractError';
  }
}

export class WebSocketError extends SDKError {
  constructor(message: string, data?: any) {
    super(message, 'WEBSOCKET_ERROR', data);
    this.name = 'WebSocketError';
  }
}