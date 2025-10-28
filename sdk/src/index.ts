/**
 * MiniWorld SDK - Public API
 * 
 * Main entry point for the SDK package
 */

export { MiniWorldSDK } from './MiniWorldSDK.js';

export type {
  SDKConfig,
  Tile,
  WorldState,
  PlayerTiles,
  ActivityItem,
  ActivityFeed,
  GameStats,
  PlayerStats,
  SyncStatus,
  ContractEvent,
  TransactionStatus,
  SDKEventType,
  SDKEventCallback,
} from './types.js';

export {
  ItemType,
  ItemTypeNames,
  SDKError,
  WalletError,
  APIError,
  ContractError,
  WebSocketError,
} from './types.js';