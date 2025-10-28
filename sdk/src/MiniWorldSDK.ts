/**
 * MiniWorld SDK - Main entry point
 * 
 * Provides a simple, promise-based API for interacting with the MiniWorld game.
 * Abstracts Web3 complexity from game developers.
 */

import { ethers } from 'ethers';
import { io, Socket } from 'socket.io-client';
import type {
  SDKConfig,
  Tile,
  WorldState,
  PlayerTiles,
  ActivityFeed,
  ActivityItem,
  GameStats,
  PlayerStats,
  SyncStatus,
  ItemType,
  TransactionStatus,
  SDKEventType,
  SDKEventCallback,
  ContractEvent,
} from './types.js';
import {
  SDKError,
  WalletError,
  APIError,
  ContractError,
  WebSocketError,
  ItemTypeNames,
} from './types.js';

import { CONTRACT_ABI } from './contractABI.js';


const GRID_SIZE = 10;
const TOTAL_TILES = 100;

export class MiniWorldSDK {
  private config: SDKConfig;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private socket: Socket | null = null;
  private connectedAddress: string | null = null;
  private eventHandlers: Map<SDKEventType, Set<SDKEventCallback>> = new Map();
  private wsConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private pendingTransactions: Set<string> = new Set();

  constructor(config: SDKConfig) {
    this.validateConfig(config);
    this.config = config;

    if (this.config.autoConnectWebSocket !== false) {
      this.initializeWebSocket();
    }
  }

  // ========================================================================
  // CONFIGURATION VALIDATION
  // ========================================================================

  private validateConfig(config: SDKConfig): void {
    if (!config.contractAddress || !config.contractAddress.startsWith('0x')) {
      throw new SDKError('Invalid contract address');
    }
    if (!config.apiUrl || !config.apiUrl.startsWith('http')) {
      throw new SDKError('Invalid API URL');
    }
    if (!config.wsUrl || !config.wsUrl.startsWith('http')) {
      throw new SDKError('Invalid WebSocket URL');
    }
  }

  // ========================================================================
  // WALLET MANAGEMENT (Part 2)
  // ========================================================================

  async connect(): Promise<string> {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new WalletError('MetaMask not detected. Please install MetaMask extension.');
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);

      const accounts = await this.provider.send('eth_requestAccounts', []) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new WalletError('No accounts found. Please unlock MetaMask.');
      }

      const address = accounts[0];
      if (!address) {
        throw new WalletError('No account address returned from MetaMask.');
      }

      this.connectedAddress = address as string;
      this.signer = await this.provider.getSigner();

      await this.initializeContract();

      this.setupAccountChangeListener();

      this.emit('connected', { address: this.connectedAddress });

      return this.connectedAddress;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new WalletError('User rejected connection request');
      }
      if (error instanceof WalletError) {
        throw error;
      }
      throw new WalletError(`Failed to connect wallet: ${error.message}`, error);
    }
  }

  async disconnect(): Promise<void> {
    this.connectedAddress = null;
    this.signer = null;
    this.contract = null;
    this.provider = null;
    
    this.removeAccountChangeListener();
    
    this.emit('disconnected', {});
  }

  getConnectedAddress(): string | null {
    return this.connectedAddress;
  }

  isConnected(): boolean {
    return this.connectedAddress !== null && this.signer !== null;
  }

  private async initializeContract(): Promise<void> {
    if (!this.signer) {
      throw new ContractError('No signer available. Connect wallet first.');
    }

    try {
      const contractABI = await this.loadContractABI();
      
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        contractABI,
        this.signer
      );
    } catch (error: any) {
      throw new ContractError(`Failed to initialize contract: ${error.message}`, error);
    }
  }

private async loadContractABI(): Promise<readonly any[]> {  // Changed to readonly
  // Use bundled ABI (built into SDK at compile time)
  if (CONTRACT_ABI && CONTRACT_ABI.length > 0) {
    console.log('✓ Using bundled contract ABI');
    return CONTRACT_ABI;  // ✅ Now matches type
  }

  // This should never happen if SDK was built correctly
  throw new SDKError(
    'Contract ABI not found in SDK bundle. ' +
    'SDK was not built correctly. Rebuild SDK with: cd sdk && npm run build'
  );
}

  private accountChangeListener: ((accounts: string[]) => void) | null = null;

  private setupAccountChangeListener(): void {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    this.accountChangeListener = (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else if (accounts[0] !== this.connectedAddress) {
        this.connectedAddress = accounts[0];
        this.initializeContract().catch(console.error);
        this.emit('accountChanged', { address: this.connectedAddress });
      }
    };

    window.ethereum.on('accountsChanged', this.accountChangeListener);
  }

  private removeAccountChangeListener(): void {
    if (typeof window !== 'undefined' && window.ethereum && this.accountChangeListener) {
      window.ethereum.removeListener('accountsChanged', this.accountChangeListener);
      this.accountChangeListener = null;
    }
  }

  // ========================================================================
  // READ OPERATIONS - API (Part 3)
  // ========================================================================

  /**
   * Fetch the complete world state (all 100 tiles)
   */
  async getWorldState(): Promise<WorldState> {
    try {
      const response = await fetch(`${this.config.apiUrl}/world`);
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch world state: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      const tiles: Tile[] = data.tiles.map((tile: any) => ({
        tileId: Number(tile.tileId),
        owner: tile.owner,
        itemType: Number(tile.itemType),
        itemTypeName: ItemTypeNames[Number(tile.itemType)],
        lastModified: tile.lastModified,
        x: Number(tile.x),
        y: Number(tile.y),
      }));

      return {
        tiles,
        totalTiles: Number(data.totalTiles),
        lastUpdated: data.lastUpdated,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Network error fetching world state: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch a single tile by ID
   */
  async getTile(tileId: number): Promise<Tile> {
    if (tileId < 0 || tileId > 99) {
      throw new SDKError(`Invalid tile ID: ${tileId}. Must be between 0-99.`);
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/tile/${tileId}`);
      
      if (response.status === 404) {
        throw new APIError(`Tile ${tileId} not found`, 404);
      }

      if (!response.ok) {
        throw new APIError(
          `Failed to fetch tile ${tileId}: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      return {
        tileId: Number(data.tileId),
        owner: data.owner,
        itemType: Number(data.itemType),
        itemTypeName: ItemTypeNames[Number(data.itemType)],
        lastModified: data.lastModified,
        x: Number(data.x),
        y: Number(data.y),
      };
    } catch (error) {
      if (error instanceof APIError || error instanceof SDKError) {
        throw error;
      }
      throw new APIError(`Network error fetching tile ${tileId}: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch all tiles owned by a player
   */
  async getPlayerTiles(address?: string): Promise<PlayerTiles> {
    const playerAddress = address || this.connectedAddress;
    
    if (!playerAddress) {
      throw new WalletError('No address provided and wallet not connected. Call connect() first or provide an address.');
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/player/${playerAddress}`);
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch player tiles: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      const tiles: Tile[] = data.tiles.map((tile: any) => ({
        tileId: Number(tile.tileId),
        owner: tile.owner,
        itemType: Number(tile.itemType),
        itemTypeName: ItemTypeNames[Number(tile.itemType)],
        lastModified: tile.lastModified,
        x: Number(tile.x),
        y: Number(tile.y),
      }));

      return {
        playerAddress: data.playerAddress,
        tiles,
        totalTiles: Number(data.totalTiles),
      };
    } catch (error) {
      if (error instanceof APIError || error instanceof WalletError) {
        throw error;
      }
      throw new APIError(`Network error fetching player tiles: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch recent activity events
   */
  async getActivity(limit: number = 50): Promise<ActivityFeed> {
    if (limit < 1 || limit > 200) {
      throw new SDKError('Activity limit must be between 1-200');
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/activity?limit=${limit}`);
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch activity: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      const events: ActivityItem[] = data.events.map((event: any) => ({
        id: Number(event.id),
        eventType: event.eventType,
        tileId: Number(event.tileId),
        playerAddress: event.playerAddress,
        itemType: event.itemType !== null ? Number(event.itemType) : undefined,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: event.timestamp,
        createdAt: event.createdAt,
      }));

      return {
        events,
        count: Number(data.count),
      };
    } catch (error) {
      if (error instanceof APIError || error instanceof SDKError) {
        throw error;
      }
      throw new APIError(`Network error fetching activity: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch game-wide statistics
   */
  async getStats(): Promise<GameStats> {
    try {
      const response = await fetch(`${this.config.apiUrl}/stats`);
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch statistics: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      return {
        totalClaims: Number(data.total_claims),
        uniquePlayers: Number(data.unique_players),
        totalEvents: Number(data.total_events),
        itemsByType: {
          Empty: Number(data.items_by_type['0']),
          Tree: Number(data.items_by_type['1']),
          Rock: Number(data.items_by_type['2']),
          Flag: Number(data.items_by_type['3']),
          Building: Number(data.items_by_type['4']),
          Water: Number(data.items_by_type['5']),
        },
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Network error fetching statistics: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch player-specific statistics
   */
  async getPlayerStats(address?: string): Promise<PlayerStats> {
    const playerAddress = address || this.connectedAddress;
    
    if (!playerAddress) {
      throw new WalletError('No address provided and wallet not connected. Call connect() first or provide an address.');
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/player/${playerAddress}/stats`);
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch player stats: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      return {
        playerAddress: data.playerAddress,
        tilesOwned: Number(data.tilesOwned),
        itemsPlaced: Number(data.itemsPlaced),
        firstClaim: data.firstClaim || null,
        lastActivity: data.lastActivity || null,
      };
    } catch (error) {
      if (error instanceof APIError || error instanceof WalletError) {
        throw error;
      }
      throw new APIError(`Network error fetching player stats: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch blockchain sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const response = await fetch(`${this.config.apiUrl}/sync-status`);
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch sync status: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      return {
        lastSyncedBlock: String(data.lastSyncedBlock),
        lastSyncTime: data.lastSyncTime,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Network error fetching sync status: ${(error as Error).message}`);
    }
  }

  // ========================================================================
  // WRITE OPERATIONS - BLOCKCHAIN (Part 4)
  // ========================================================================

  /**
   * Claim an unclaimed tile
   */
  async claimTile(tileId: number): Promise<TransactionStatus> {
    if (!this.isConnected() || !this.contract || !this.signer) {
      throw new WalletError('Wallet not connected. Call connect() first.');
    }

    if (tileId < 0 || tileId > 99) {
      throw new SDKError(`Invalid tile ID: ${tileId}. Must be between 0-99.`);
    }

    try {
      this.emit('transactionStarted', { 
        type: 'claimTile', 
        tileId,
        status: 'pending' 
      });

      const tx = await this.contract.claimTile(tileId);
      
      this.trackTransaction(tx.hash);

      this.emit('transactionSubmitted', { 
        hash: tx.hash,
        type: 'claimTile',
        tileId 
      });

      const receipt = await tx.wait();

      if (receipt.status === 0) {
        this.emit('transactionFailed', {
          type: 'claimTile',
          tileId,
          error: 'Transaction failed on blockchain'
        });
        throw new ContractError('Transaction failed on blockchain');
      }

      const status: TransactionStatus = {
        hash: tx.hash,
        status: 'confirmed',
        blockNumber: receipt.blockNumber,
      };

      this.emit('transactionConfirmed', {
        type: 'claimTile',
        tileId,
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      return status;
    } catch (error: any) {
      this.emit('transactionFailed', {
        type: 'claimTile',
        tileId,
        error: this.parseContractError(error)
      });

      if (error.code === 'ACTION_REJECTED') {
        throw new WalletError('User rejected transaction');
      }
      if (error instanceof ContractError) {
        throw error;
      }
      throw new ContractError(`Failed to claim tile: ${this.parseContractError(error)}`, error);
    }
  }

  /**
   * Place an item on an owned tile
   */
  async placeItem(tileId: number, itemType: ItemType): Promise<TransactionStatus> {
    if (!this.isConnected() || !this.contract || !this.signer) {
      throw new WalletError('Wallet not connected. Call connect() first.');
    }

    if (tileId < 0 || tileId > 99) {
      throw new SDKError(`Invalid tile ID: ${tileId}. Must be between 0-99.`);
    }

    if (itemType < 0 || itemType > 5) {
      throw new SDKError(`Invalid item type: ${itemType}. Must be between 0-5.`);
    }

    try {
      this.emit('transactionStarted', { 
        type: 'placeItem', 
        tileId,
        itemType,
        status: 'pending' 
      });

      const tx = await this.contract.placeItem(tileId, itemType);
      
      this.trackTransaction(tx.hash);

      this.emit('transactionSubmitted', {
        hash: tx.hash,
        type: 'placeItem',
        tileId,
        itemType
      });

      const receipt = await tx.wait();

      if (receipt.status === 0) {
        this.emit('transactionFailed', {
          type: 'placeItem',
          tileId,
          itemType,
          error: 'Transaction failed on blockchain'
        });
        throw new ContractError('Transaction failed on blockchain');
      }

      const status: TransactionStatus = {
        hash: tx.hash,
        status: 'confirmed',
        blockNumber: receipt.blockNumber,
      };

      this.emit('transactionConfirmed', {
        type: 'placeItem',
        tileId,
        itemType,
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      return status;
    } catch (error: any) {
      this.emit('transactionFailed', {
        type: 'placeItem',
        tileId,
        itemType,
        error: this.parseContractError(error)
      });

      if (error.code === 'ACTION_REJECTED') {
        throw new WalletError('User rejected transaction');
      }
      if (error instanceof ContractError) {
        throw error;
      }
      throw new ContractError(`Failed to place item: ${this.parseContractError(error)}`, error);
    }
  }

  /**
   * Remove an item from an owned tile
   */
  async removeItem(tileId: number): Promise<TransactionStatus> {
    if (!this.isConnected() || !this.contract || !this.signer) {
      throw new WalletError('Wallet not connected. Call connect() first.');
    }

    if (tileId < 0 || tileId > 99) {
      throw new SDKError(`Invalid tile ID: ${tileId}. Must be between 0-99.`);
    }

    try {
      this.emit('transactionStarted', { 
        type: 'removeItem', 
        tileId,
        status: 'pending' 
      });

      const tx = await this.contract.removeItem(tileId);
      
      this.trackTransaction(tx.hash);

      this.emit('transactionSubmitted', {
        hash: tx.hash,
        type: 'removeItem',
        tileId
      });

      const receipt = await tx.wait();

      if (receipt.status === 0) {
        this.emit('transactionFailed', {
          type: 'removeItem',
          tileId,
          error: 'Transaction failed on blockchain'
        });
        throw new ContractError('Transaction failed on blockchain');
      }

      const status: TransactionStatus = {
        hash: tx.hash,
        status: 'confirmed',
        blockNumber: receipt.blockNumber,
      };

      this.emit('transactionConfirmed', {
        type: 'removeItem',
        tileId,
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      return status;
    } catch (error: any) {
      this.emit('transactionFailed', {
        type: 'removeItem',
        tileId,
        error: this.parseContractError(error)
      });

      if (error.code === 'ACTION_REJECTED') {
        throw new WalletError('User rejected transaction');
      }
      if (error instanceof ContractError) {
        throw error;
      }
      throw new ContractError(`Failed to remove item: ${this.parseContractError(error)}`, error);
    }
  }

  /**
   * Parse contract error to user-friendly message
   */
  private parseContractError(error: any): string {
    if (error.code === 'ACTION_REJECTED') {
      return 'User rejected transaction';
    }

    if (error.code === 'INSUFFICIENT_FUNDS') {
      return 'Insufficient funds for transaction';
    }

    if (error.reason) {
      return error.reason;
    }

    if (error.message) {
      if (error.message.includes('TileAlreadyClaimed')) {
        return 'Tile already claimed';
      }
      if (error.message.includes('NotTileOwner')) {
        return 'You do not own this tile';
      }
      if (error.message.includes('InvalidTileId')) {
        return 'Invalid tile ID';
      }
      return error.message;
    }

    return 'Transaction failed';
  }

  // ========================================================================
  // WEBSOCKET MANAGEMENT (Part 5)
  // ========================================================================

  /**
   * Initialize WebSocket connection to backend for real-time events
   */
  initializeWebSocket(): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.socket = io(this.config.wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        console.log('WebSocket connected');
        this.emit('wsConnected', {});
      });

      this.socket.on('disconnect', (reason: string) => {
        this.wsConnected = false;
        console.log(`WebSocket disconnected: ${reason}`);
        this.emit('wsDisconnected', { reason });
      });

      this.socket.on('connect_error', (error: Error) => {
        this.reconnectAttempts++;
        console.error(`WebSocket connection error (attempt ${this.reconnectAttempts}):`, error.message);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.emit('error', new WebSocketError('Failed to connect to WebSocket server after multiple attempts'));
        }
      });

      this.socket.on('tileClaimed', (data: any) => {
        if (!this.isOwnTransaction(data.transactionHash)) {
          this.emit('tileClaimed', {
            tileId: Number(data.tileId),
            owner: data.owner,
            timestamp: data.timestamp,
            transactionHash: data.transactionHash,
          });
        } else {
          this.pendingTransactions.delete(data.transactionHash);
        }
      });

      this.socket.on('itemPlaced', (data: any) => {
        if (!this.isOwnTransaction(data.transactionHash)) {
          this.emit('itemPlaced', {
            tileId: Number(data.tileId),
            owner: data.owner,
            itemType: Number(data.itemType),
            timestamp: data.timestamp,
            transactionHash: data.transactionHash,
          });
        } else {
          this.pendingTransactions.delete(data.transactionHash);
        }
      });

      this.socket.on('itemRemoved', (data: any) => {
        if (!this.isOwnTransaction(data.transactionHash)) {
          this.emit('itemRemoved', {
            tileId: Number(data.tileId),
            owner: data.owner,
            timestamp: data.timestamp,
            transactionHash: data.transactionHash,
          });
        } else {
          this.pendingTransactions.delete(data.transactionHash);
        }
      });

      this.socket.on('worldUpdate', (data: any) => {
        this.emit('worldUpdate', {
          timestamp: data.timestamp,
        });
      });

    } catch (error: any) {
      throw new WebSocketError(`Failed to initialize WebSocket: ${error.message}`);
    }
  }

  /**
   * Disconnect WebSocket connection
   */
  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.wsConnected = false;
      this.pendingTransactions.clear();
      console.log('WebSocket disconnected');
    }
  }

  /**
   * Check if WebSocket is currently connected
   */
  isWebSocketConnected(): boolean {
    return this.wsConnected;
  }

  /**
   * Check if transaction is from current user (for deduplication)
   */
  private isOwnTransaction(txHash: string): boolean {
    return this.pendingTransactions.has(txHash);
  }

  /**
   * Track transaction to prevent duplicate event processing
   */
  private trackTransaction(txHash: string): void {
    this.pendingTransactions.add(txHash);
    setTimeout(() => {
      this.pendingTransactions.delete(txHash);
    }, 60000);
  }

  // ========================================================================
  // EVENT MANAGEMENT (Simple event emitter)
  // ========================================================================

  on(event: SDKEventType, callback: SDKEventCallback): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback);
  }

  off(event: SDKEventType, callback: SDKEventCallback): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  protected emit(event: SDKEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  static coordsToTileId(x: number, y: number): number {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      throw new SDKError(`Invalid coordinates: (${x}, ${y}). Must be in range [0-${GRID_SIZE - 1}]`);
    }
    return y * GRID_SIZE + x;
  }

  static tileIdToCoords(tileId: number): { x: number; y: number } {
    if (tileId < 0 || tileId >= TOTAL_TILES) {
      throw new SDKError(`Invalid tile ID: ${tileId}. Must be in range [0-${TOTAL_TILES - 1}]`);
    }
    return {
      x: tileId % GRID_SIZE,
      y: Math.floor(tileId / GRID_SIZE),
    };
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  async cleanup(): Promise<void> {
    this.disconnectWebSocket();
    this.removeAccountChangeListener();
    this.eventHandlers.clear();
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.connectedAddress = null;
  }
}