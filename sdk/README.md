# MiniWorld SDK

A TypeScript SDK that abstracts Web3 complexity for the MiniWorld blockchain game. Provides a simple, promise-based API for wallet management, blockchain transactions, real-time events, and game state queries.

## Features

✅ **Simple API** - Promise-based methods that hide Web3 complexity  
✅ **Wallet Management** - Easy MetaMask connection and account handling  
✅ **Real-Time Events** - WebSocket integration for multiplayer synchronization  
✅ **Type-Safe** - Full TypeScript support with comprehensive type definitions  
✅ **Error Handling** - Custom error classes with descriptive messages  
✅ **Event Deduplication** - Prevents duplicate processing of own transactions  
✅ **Automatic Reconnection** - WebSocket auto-reconnect with exponential backoff  

---

## Installation

### Option 1: Local Development (Current Setup)

```bash
cd miniworld/sdk
npm install
npm run build
```

### Option 2: NPM Package (Future)

```bash
npm install miniworld-sdk
```

---

## Quick Start

```typescript
import { MiniWorldSDK, ItemType } from 'miniworld-sdk';

// Initialize SDK
const game = new MiniWorldSDK({
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  apiUrl: 'http://localhost:4000/api',
  wsUrl: 'http://localhost:4000',
  autoConnectWebSocket: true // Optional, defaults to true
});

// Connect wallet
await game.connect();

// Get world state (fast - from API)
const world = await game.getWorldState();
console.log(`World has ${world.totalTiles} tiles`);

// Claim a tile (blockchain transaction)
const result = await game.claimTile(42);
console.log(`Claimed! TX: ${result.hash}`);

// Listen for real-time events from other players
game.on('tileClaimed', (event) => {
  console.log(`Player ${event.owner} claimed tile ${event.tileId}!`);
});
```

---

## Configuration

### SDKConfig Interface

```typescript
interface SDKConfig {
  contractAddress: string;        // Deployed MiniWorld contract address
  apiUrl: string;                 // Backend API URL (e.g., http://localhost:4000/api)
  wsUrl: string;                  // WebSocket URL (e.g., http://localhost:4000)
  rpcUrl?: string;                // Optional: Custom RPC URL
  autoConnectWebSocket?: boolean; // Optional: Auto-connect WebSocket (default: true)
}
```

### Example Configurations

**Local Development:**
```typescript
const sdk = new MiniWorldSDK({
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  apiUrl: 'http://localhost:4000/api',
  wsUrl: 'http://localhost:4000'
});
```

**Production:**
```typescript
const sdk = new MiniWorldSDK({
  contractAddress: '0x...',
  apiUrl: 'https://api.miniworld.game/api',
  wsUrl: 'https://api.miniworld.game',
  autoConnectWebSocket: true
});
```

**Disable Auto-Connect WebSocket:**
```typescript
const sdk = new MiniWorldSDK({
  contractAddress: '0x...',
  apiUrl: 'http://localhost:4000/api',
  wsUrl: 'http://localhost:4000',
  autoConnectWebSocket: false // Manual control
});

// Connect manually later
sdk.initializeWebSocket();
```

---

## API Reference

### Wallet Management

#### `connect(): Promise<string>`

Connects to MetaMask wallet and returns the connected address.

```typescript
const address = await sdk.connect();
console.log(`Connected: ${address}`);
```

**Events Emitted:**
- `connected` - When wallet successfully connects

**Errors:**
- `WalletError` - MetaMask not detected, user rejected, or no accounts

---

#### `disconnect(): Promise<void>`

Disconnects the wallet and cleans up listeners.

```typescript
await sdk.disconnect();
```

**Events Emitted:**
- `disconnected` - When wallet disconnects

---

#### `getConnectedAddress(): string | null`

Returns the currently connected wallet address, or `null` if not connected.

```typescript
const address = sdk.getConnectedAddress();
if (address) {
  console.log(`Wallet: ${address}`);
}
```

---

#### `isConnected(): boolean`

Checks if wallet is currently connected.

```typescript
if (sdk.isConnected()) {
  console.log('Wallet is connected');
}
```

---

### Read Operations (API)

All read operations fetch data from the backend API for fast response times.

#### `getWorldState(): Promise<WorldState>`

Fetches the complete world state (all 100 tiles).

```typescript
const world = await sdk.getWorldState();

console.log(`Total tiles: ${world.totalTiles}`);
console.log(`Last updated: ${world.lastUpdated}`);

world.tiles.forEach(tile => {
  if (tile.owner !== '0x0000000000000000000000000000000000000000') {
    console.log(`Tile ${tile.tileId}: ${tile.itemTypeName} at (${tile.x}, ${tile.y})`);
  }
});
```

**Returns:**
```typescript
interface WorldState {
  tiles: Tile[];
  totalTiles: number;
  lastUpdated: string;
}
```

---

#### `getTile(tileId: number): Promise<Tile>`

Fetches a single tile by ID (0-99).

```typescript
const tile = await sdk.getTile(42);

console.log(`Owner: ${tile.owner}`);
console.log(`Item: ${tile.itemTypeName}`);
console.log(`Position: (${tile.x}, ${tile.y})`);
console.log(`Last modified: ${tile.lastModified}`);
```

**Parameters:**
- `tileId` (number) - Tile ID between 0-99

**Returns:**
```typescript
interface Tile {
  tileId: number;
  owner: string;
  itemType: number;
  itemTypeName: string;
  lastModified: string;
  x: number;
  y: number;
}
```

**Errors:**
- `SDKError` - Invalid tile ID (not 0-99)
- `APIError` - Tile not found (404) or network error

---

#### `getPlayerTiles(address?: string): Promise<PlayerTiles>`

Fetches all tiles owned by a player. If no address provided, uses connected wallet.

```typescript
// Get your tiles
const myTiles = await sdk.getPlayerTiles();
console.log(`You own ${myTiles.totalTiles} tiles`);

// Get another player's tiles
const theirTiles = await sdk.getPlayerTiles('0xABC...');
console.log(`They own ${theirTiles.totalTiles} tiles`);
```

**Parameters:**
- `address` (string, optional) - Player address. If omitted, uses connected wallet.

**Returns:**
```typescript
interface PlayerTiles {
  playerAddress: string;
  tiles: Tile[];
  totalTiles: number;
}
```

**Errors:**
- `WalletError` - No address provided and wallet not connected

---

#### `getActivity(limit?: number): Promise<ActivityFeed>`

Fetches recent game events.

```typescript
// Get last 50 events (default)
const activity = await sdk.getActivity();

// Get last 10 events
const recentActivity = await sdk.getActivity(10);

activity.events.forEach(event => {
  console.log(`${event.eventType} - Tile ${event.tileId} by ${event.playerAddress}`);
});
```

**Parameters:**
- `limit` (number, optional) - Number of events to fetch (1-200, default: 50)

**Returns:**
```typescript
interface ActivityFeed {
  events: ActivityItem[];
  count: number;
}

interface ActivityItem {
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
```

**Errors:**
- `SDKError` - Invalid limit (not 1-200)

---

#### `getStats(): Promise<GameStats>`

Fetches game-wide statistics.

```typescript
const stats = await sdk.getStats();

console.log(`Total claims: ${stats.totalClaims}`);
console.log(`Unique players: ${stats.uniquePlayers}`);
console.log(`Total events: ${stats.totalEvents}`);
console.log(`Trees: ${stats.itemsByType.Tree}`);
console.log(`Rocks: ${stats.itemsByType.Rock}`);
```

**Returns:**
```typescript
interface GameStats {
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
```

---

#### `getPlayerStats(address?: string): Promise<PlayerStats>`

Fetches player-specific statistics.

```typescript
const stats = await sdk.getPlayerStats();

console.log(`Tiles owned: ${stats.tilesOwned}`);
console.log(`Items placed: ${stats.itemsPlaced}`);
console.log(`First claim: ${stats.firstClaim}`);
console.log(`Last activity: ${stats.lastActivity}`);
```

**Parameters:**
- `address` (string, optional) - Player address. If omitted, uses connected wallet.

**Returns:**
```typescript
interface PlayerStats {
  playerAddress: string;
  tilesOwned: number;
  itemsPlaced: number;
  firstClaim: string | null;
  lastActivity: string | null;
}
```

**Errors:**
- `WalletError` - No address provided and wallet not connected

---

#### `getSyncStatus(): Promise<SyncStatus>`

Fetches blockchain sync status from backend.

```typescript
const sync = await sdk.getSyncStatus();

console.log(`Last synced block: ${sync.lastSyncedBlock}`);
console.log(`Last sync time: ${sync.lastSyncTime}`);
```

**Returns:**
```typescript
interface SyncStatus {
  lastSyncedBlock: string;
  lastSyncTime: string;
}
```

---

### Write Operations (Blockchain)

All write operations send transactions to the blockchain via MetaMask.

#### `claimTile(tileId: number): Promise<TransactionStatus>`

Claims an unclaimed tile.

```typescript
const result = await sdk.claimTile(5);

console.log(`Transaction hash: ${result.hash}`);
console.log(`Status: ${result.status}`);
console.log(`Block: ${result.blockNumber}`);
```

**Parameters:**
- `tileId` (number) - Tile ID to claim (0-99)

**Returns:**
```typescript
interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  error?: string;
}
```

**Events Emitted:**
1. `transactionStarted` - When transaction is initiated
2. `transactionSubmitted` - When sent to blockchain
3. `transactionConfirmed` - When mined successfully
4. `transactionFailed` - If transaction fails

**Errors:**
- `WalletError` - Wallet not connected or user rejected
- `SDKError` - Invalid tile ID (not 0-99)
- `ContractError` - Tile already claimed, invalid tile, etc.

---

#### `placeItem(tileId: number, itemType: ItemType): Promise<TransactionStatus>`

Places an item on an owned tile.

```typescript
import { ItemType } from 'miniworld-sdk';

// Place a tree on tile 5
const result = await sdk.placeItem(5, ItemType.Tree);

console.log(`Item placed! TX: ${result.hash}`);
```

**Parameters:**
- `tileId` (number) - Tile ID to place item on (0-99)
- `itemType` (ItemType) - Item type to place (0-5)

**ItemType Enum:**
```typescript
enum ItemType {
  Empty = 0,
  Tree = 1,
  Rock = 2,
  Flag = 3,
  Building = 4,
  Water = 5
}
```

**Returns:** `TransactionStatus`

**Events Emitted:** Same as `claimTile()`

**Errors:**
- `WalletError` - Wallet not connected or user rejected
- `SDKError` - Invalid tile ID or item type
- `ContractError` - Not tile owner, invalid tile, etc.

---

#### `removeItem(tileId: number): Promise<TransactionStatus>`

Removes an item from an owned tile.

```typescript
const result = await sdk.removeItem(5);

console.log(`Item removed! TX: ${result.hash}`);
```

**Parameters:**
- `tileId` (number) - Tile ID to remove item from (0-99)

**Returns:** `TransactionStatus`

**Events Emitted:** Same as `claimTile()`

**Errors:**
- `WalletError` - Wallet not connected or user rejected
- `SDKError` - Invalid tile ID
- `ContractError` - Not tile owner, invalid tile, etc.

---

### WebSocket Management

#### `initializeWebSocket(): void`

Manually initializes WebSocket connection (if `autoConnectWebSocket` was `false`).

```typescript
sdk.initializeWebSocket();
```

**Events Emitted:**
- `wsConnected` - When connection established

---

#### `disconnectWebSocket(): void`

Disconnects WebSocket connection.

```typescript
sdk.disconnectWebSocket();
```

**Events Emitted:**
- `wsDisconnected` - When connection closed

---

#### `isWebSocketConnected(): boolean`

Checks if WebSocket is currently connected.

```typescript
if (sdk.isWebSocketConnected()) {
  console.log('WebSocket is connected');
}
```

---

### Utility Methods

Static utility methods for coordinate conversion.

#### `MiniWorldSDK.coordsToTileId(x: number, y: number): number`

Converts (x, y) coordinates to tile ID.

```typescript
const tileId = MiniWorldSDK.coordsToTileId(4, 2);
console.log(tileId); // 24
```

**Parameters:**
- `x` (number) - X coordinate (0-9)
- `y` (number) - Y coordinate (0-9)

**Returns:** Tile ID (0-99)

**Formula:** `tileId = y * 10 + x`

**Errors:**
- `SDKError` - Invalid coordinates (not 0-9)

---

#### `MiniWorldSDK.tileIdToCoords(tileId: number): { x: number; y: number }`

Converts tile ID to (x, y) coordinates.

```typescript
const coords = MiniWorldSDK.tileIdToCoords(42);
console.log(coords); // { x: 2, y: 4 }
```

**Parameters:**
- `tileId` (number) - Tile ID (0-99)

**Returns:** `{ x: number, y: number }`

**Errors:**
- `SDKError` - Invalid tile ID (not 0-99)

---

### Event System

Subscribe to SDK events using the `on()` method.

#### `on(event: SDKEventType, callback: (data: any) => void): void`

Subscribes to an event.

```typescript
sdk.on('connected', (data) => {
  console.log(`Connected: ${data.address}`);
});

sdk.on('tileClaimed', (event) => {
  console.log(`Tile ${event.tileId} claimed by ${event.owner}`);
});
```

---

#### `off(event: SDKEventType, callback: (data: any) => void): void`

Unsubscribes from an event.

```typescript
const handler = (data) => console.log(data);
sdk.on('connected', handler);

// Later...
sdk.off('connected', handler);
```

---

### Event Types

#### Wallet Events

**`connected`** - Wallet successfully connected
```typescript
sdk.on('connected', (data: { address: string }) => {
  console.log(`Wallet connected: ${data.address}`);
});
```

**`disconnected`** - Wallet disconnected
```typescript
sdk.on('disconnected', () => {
  console.log('Wallet disconnected');
});
```

**`accountChanged`** - User switched accounts in MetaMask
```typescript
sdk.on('accountChanged', (data: { address: string }) => {
  console.log(`Account changed to: ${data.address}`);
});
```

---

#### Transaction Events

**`transactionStarted`** - Transaction initiated (before MetaMask popup)
```typescript
sdk.on('transactionStarted', (data) => {
  console.log(`Starting ${data.type} for tile ${data.tileId}`);
});
```

**`transactionSubmitted`** - Transaction sent to blockchain
```typescript
sdk.on('transactionSubmitted', (data) => {
  console.log(`TX submitted: ${data.hash}`);
});
```

**`transactionConfirmed`** - Transaction mined successfully
```typescript
sdk.on('transactionConfirmed', (data) => {
  console.log(`TX confirmed in block ${data.blockNumber}`);
  console.log(`Gas used: ${data.gasUsed}`);
});
```

**`transactionFailed`** - Transaction failed
```typescript
sdk.on('transactionFailed', (data) => {
  console.error(`TX failed: ${data.error}`);
});
```

---

#### WebSocket Events

**`wsConnected`** - WebSocket connection established
```typescript
sdk.on('wsConnected', () => {
  console.log('WebSocket connected');
});
```

**`wsDisconnected`** - WebSocket connection closed
```typescript
sdk.on('wsDisconnected', (data: { reason: string }) => {
  console.log(`WebSocket disconnected: ${data.reason}`);
});
```

---

#### Real-Time Game Events

These events are broadcast when OTHER players perform actions.

**`tileClaimed`** - Another player claimed a tile
```typescript
sdk.on('tileClaimed', (event) => {
  console.log(`Player ${event.owner} claimed tile ${event.tileId}`);
});
```

**`itemPlaced`** - Another player placed an item
```typescript
sdk.on('itemPlaced', (event) => {
  console.log(`Player ${event.owner} placed ${event.itemType} on tile ${event.tileId}`);
});
```

**`itemRemoved`** - Another player removed an item
```typescript
sdk.on('itemRemoved', (event) => {
  console.log(`Player ${event.owner} removed item from tile ${event.tileId}`);
});
```

**`worldUpdate`** - General world state update
```typescript
sdk.on('worldUpdate', (data) => {
  console.log('World state updated');
});
```

---

#### Error Events

**`error`** - General SDK error
```typescript
sdk.on('error', (error) => {
  console.error(`SDK Error: ${error.message}`);
});
```

---

## Error Handling

The SDK uses custom error classes for clear error handling.

### Error Classes

```typescript
class SDKError extends Error {
  name: 'SDKError'
  code?: string
  data?: any
}

class WalletError extends SDKError {
  name: 'WalletError'
  code: 'WALLET_ERROR'
}

class APIError extends SDKError {
  name: 'APIError'
  code: 'API_ERROR'
  statusCode?: number
}

class ContractError extends SDKError {
  name: 'ContractError'
  code: 'CONTRACT_ERROR'
}

class WebSocketError extends SDKError {
  name: 'WebSocketError'
  code: 'WEBSOCKET_ERROR'
}
```

### Error Handling Example

```typescript
try {
  await sdk.claimTile(5);
} catch (error) {
  if (error instanceof WalletError) {
    console.error('Wallet issue:', error.message);
    // Show "Connect Wallet" button
  } else if (error instanceof ContractError) {
    console.error('Contract error:', error.message);
    // Show error message to user
  } else if (error instanceof APIError) {
    console.error('API error:', error.message, error.statusCode);
    // Retry or show error
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Usage Examples

### Example 1: Basic Game Client

```typescript
import { MiniWorldSDK, ItemType } from 'miniworld-sdk';

const sdk = new MiniWorldSDK({
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  apiUrl: 'http://localhost:4000/api',
  wsUrl: 'http://localhost:4000'
});

// Connect wallet
document.getElementById('connect').onclick = async () => {
  try {
    const address = await sdk.connect();
    console.log(`Connected: ${address}`);
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
};

// Claim tile
document.getElementById('claim').onclick = async () => {
  try {
    const tileId = parseInt(prompt('Enter tile ID:'));
    await sdk.claimTile(tileId);
    alert('Tile claimed!');
  } catch (error) {
    alert(`Failed: ${error.message}`);
  }
};

// Listen for real-time events
sdk.on('tileClaimed', (event) => {
  console.log(`🔔 Tile ${event.tileId} claimed by ${event.owner}`);
  updateGameBoard(); // Refresh UI
});
```

---

### Example 2: Display World State

```typescript
async function displayWorld() {
  const world = await sdk.getWorldState();
  
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  
  world.tiles.forEach(tile => {
    const cell = document.createElement('div');
    cell.className = 'tile';
    cell.textContent = tile.itemTypeName;
    
    if (tile.owner !== '0x0000000000000000000000000000000000000000') {
      cell.classList.add('claimed');
    }
    
    cell.onclick = () => showTileDetails(tile);
    grid.appendChild(cell);
  });
}
```

---

### Example 3: Player Dashboard

```typescript
async function loadPlayerDashboard() {
  const address = sdk.getConnectedAddress();
  if (!address) {
    alert('Please connect wallet');
    return;
  }
  
  const [tiles, stats] = await Promise.all([
    sdk.getPlayerTiles(),
    sdk.getPlayerStats()
  ]);
  
  console.log(`You own ${tiles.totalTiles} tiles`);
  console.log(`You've placed ${stats.itemsPlaced} items`);
  console.log(`First claim: ${stats.firstClaim}`);
  
  tiles.tiles.forEach(tile => {
    console.log(`Tile ${tile.tileId} at (${tile.x}, ${tile.y}): ${tile.itemTypeName}`);
  });
}
```

---

### Example 4: Real-Time Activity Feed

```typescript
const activityLog = document.getElementById('activity-log');

sdk.on('tileClaimed', (event) => {
  addActivity(`Tile ${event.tileId} claimed by ${shortenAddress(event.owner)}`);
});

sdk.on('itemPlaced', (event) => {
  const itemName = ['Empty', 'Tree', 'Rock', 'Flag', 'Building', 'Water'][event.itemType];
  addActivity(`${itemName} placed on tile ${event.tileId}`);
});

function addActivity(message) {
  const entry = document.createElement('div');
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  activityLog.prepend(entry);
}

function shortenAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
```

---

### Example 5: Transaction Status Tracking

```typescript
async function claimTileWithStatus(tileId) {
  const statusEl = document.getElementById('tx-status');
  
  sdk.on('transactionStarted', () => {
    statusEl.textContent = '⏳ Preparing transaction...';
  });
  
  sdk.on('transactionSubmitted', (data) => {
    statusEl.textContent = `⏳ Waiting for confirmation... TX: ${data.hash.slice(0, 10)}...`;
  });
  
  sdk.on('transactionConfirmed', (data) => {
    statusEl.textContent = `✅ Confirmed in block ${data.blockNumber}!`;
  });
  
  sdk.on('transactionFailed', (data) => {
    statusEl.textContent = `❌ Failed: ${data.error}`;
  });
  
  try {
    await sdk.claimTile(tileId);
  } catch (error) {
    console.error('Transaction error:', error);
  }
}
```

---

## TypeScript Support

The SDK is fully typed with comprehensive TypeScript definitions.

### Import Types

```typescript
import { 
  MiniWorldSDK,
  ItemType,
  ItemTypeNames,
  Tile,
  WorldState,
  PlayerTiles,
  ActivityFeed,
  GameStats,
  PlayerStats,
  TransactionStatus,
  SDKConfig,
  SDKError,
  WalletError,
  APIError,
  ContractError,
  WebSocketError
} from 'miniworld-sdk';
```

---

## Best Practices

### 1. Error Handling

Always wrap SDK calls in try-catch blocks:

```typescript
try {
  await sdk.claimTile(5);
} catch (error) {
  // Handle specific error types
}
```

### 2. Check Connection Status

Check wallet connection before write operations:

```typescript
if (!sdk.isConnected()) {
  alert('Please connect wallet first');
  return;
}

await sdk.claimTile(5);
```

### 3. Event Cleanup

Remove event listeners when components unmount:

```typescript
const handler = (event) => console.log(event);
sdk.on('tileClaimed', handler);

// Later (e.g., React useEffect cleanup)
return () => {
  sdk.off('tileClaimed', handler);
};
```

### 4. WebSocket Reconnection

The SDK handles reconnection automatically, but you can monitor status:

```typescript
sdk.on('wsDisconnected', (data) => {
  console.log(`WebSocket disconnected: ${data.reason}`);
  // Show "Reconnecting..." UI
});

sdk.on('wsConnected', () => {
  console.log('WebSocket reconnected');
  // Hide reconnection UI
});
```

### 5. Use Utility Functions

Use coordinate conversion utilities for cleaner code:

```typescript
// Instead of manually calculating
const tileId = y * 10 + x;

// Use the utility
const tileId = MiniWorldSDK.coordsToTileId(x, y);
```

---

## Browser Compatibility

- **Chrome/Edge**: ✅ Fully supported
- **Firefox**: ✅ Fully supported
- **Safari**: ✅ Fully supported (with MetaMask extension)
- **Mobile**: ⚠️ Requires MetaMask mobile browser or WalletConnect

---

## Testing

### Node.js Tests

```bash
cd miniworld/sdk
npm run build
node test/test-node.mjs
```

**Expected:** 78 tests passing

### Browser Tests

```bash
cd miniworld/sdk
npx http-server -p 8080 -c-1
```

Open: http://localhost:8080/test/test-browser.html

**Test Features:**
- Wallet connection
- API read operations
- Blockchain transactions
- Real-time WebSocket events
- Multi-player synchronization

---

## Troubleshooting

### MetaMask Not Detected

**Problem:** `WalletError: MetaMask not detected`

**Solution:** Install MetaMask browser extension from https://metamask.io

---

### Network Errors

**Problem:** `APIError: Failed to fetch...`

**Solution:** 
1. Verify backend is running: `cd miniworld/backend && npm run dev`
2. Check API URL in SDK config
3. Ensure CORS is configured correctly

---

### Transaction Rejected

**Problem:** `WalletError: User rejected transaction`

**Solution:** This is expected behavior when user clicks "Reject" in MetaMask. Handle gracefully in your UI.

---

### WebSocket Connection Failed

**Problem:** WebSocket not connecting

**Solution:**
1. Verify backend WebSocket server is running
2. Check `wsUrl` in SDK config
3. Ensure firewall allows WebSocket connections
4. Check browser console for CORS errors

---

### Tile Already Claimed

**Problem:** `ContractError: Tile already claimed`

**Solution:** This tile is owned by another player. Use `getTile()` to check ownership before claiming.

---

## License

MIT

---

## Support

For issues, questions, or contributions, please refer to the main MiniWorld repository documentation.

---

## Version History

**v1.0.0** - Initial release
- Wallet management with MetaMask
- API read operations (7 methods)
- Blockchain write operations (3 methods)
- WebSocket real-time events
- Full TypeScript support
- Comprehensive error handling
- Event deduplication
- Automatic reconnection