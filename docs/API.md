# MiniWorld API Documentation

Complete REST API reference for the MiniWorld backend service.

**Base URL**: `http://localhost:4000/api`

## Table of Contents

- [MiniWorld API Documentation](#miniworld-api-documentation)
  - [Table of Contents](#table-of-contents)
  - [Authentication](#authentication)
  - [Endpoints](#endpoints)
    - [GET /world](#get-world)
    - [GET /tile/:id](#get-tileid)
    - [GET /player/:address](#get-playeraddress)
    - [GET /player/:address/stats](#get-playeraddressstats)
    - [GET /activity](#get-activity)
    - [GET /stats](#get-stats)
    - [GET /sync-status](#get-sync-status)
    - [GET /health](#get-health)
  - [Data Types](#data-types)
    - [ItemType Enum](#itemtype-enum)
    - [Coordinate System](#coordinate-system)
  - [Error Handling](#error-handling)
    - [Error Response Format](#error-response-format)
    - [HTTP Status Codes](#http-status-codes)
    - [Common Errors](#common-errors)
  - [Rate Limiting](#rate-limiting)
  - [CORS Policy](#cors-policy)
  - [WebSocket Events](#websocket-events)
  - [Examples](#examples)
    - [Complete Workflow](#complete-workflow)
    - [Using with SDK](#using-with-sdk)
  - [Response Times](#response-times)
  - [Changelog](#changelog)
    - [v1.0.0 (Current)](#v100-current)

---

## Authentication

Currently, the API is **public** and does not require authentication. All endpoints are accessible without API keys or tokens.

For production deployments, consider adding:
- API key authentication
- Rate limiting
- CORS restrictions

---

## Endpoints

### GET /world

Retrieve the complete world state (all 100 tiles).

**Response**:
```json
{
  "tiles": [
    {
      "tileId": 0,
      "owner": "0x0000000000000000000000000000000000000000",
      "itemType": 0,
      "lastModified": "0",
      "x": 0,
      "y": 0
    },
    ...
  ],
  "totalTiles": 100,
  "lastUpdated": "2025-10-20T10:30:00.000Z"
}
```

**Fields**:
- `tiles`: Array of all tile objects
- `totalTiles`: Total number of tiles (always 100)
- `lastUpdated`: Timestamp of last cache update

**Example**:
```bash
curl http://localhost:4000/api/world
```

---

### GET /tile/:id

Get detailed information about a specific tile.

**Parameters**:
- `id` (path): Tile ID (0-99)

**Response**:
```json
{
  "tileId": 42,
  "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "itemType": 1,
  "lastModified": "1729411234",
  "x": 2,
  "y": 4
}
```

**Fields**:
- `tileId`: Unique tile identifier (0-99)
- `owner`: Ethereum address of tile owner (0x0...0 if unclaimed)
- `itemType`: Item placed on tile (0=Empty, 1=Tree, 2=Rock, 3=Flag, 4=Building, 5=Water)
- `lastModified`: Unix timestamp of last modification
- `x`: X coordinate (0-9)
- `y`: Y coordinate (0-9)

**Errors**:
- `404 Not Found`: Tile does not exist
- `400 Bad Request`: Invalid tile ID

**Example**:
```bash
curl http://localhost:4000/api/tile/42
```

---

### GET /player/:address

Get all tiles owned by a specific player.

**Parameters**:
- `address` (path): Ethereum address (0x...)

**Response**:
```json
{
  "playerAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "tiles": [
    {
      "tileId": 0,
      "itemType": 1,
      "lastModified": "1729411234",
      "x": 0,
      "y": 0
    },
    {
      "tileId": 15,
      "itemType": 0,
      "lastModified": "1729411240",
      "x": 5,
      "y": 1
    }
  ],
  "totalTiles": 2
}
```

**Fields**:
- `playerAddress`: The queried address
- `tiles`: Array of owned tiles
- `totalTiles`: Number of tiles owned

**Errors**:
- `400 Bad Request`: Invalid Ethereum address format

**Example**:
```bash
curl http://localhost:4000/api/player/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

---

### GET /player/:address/stats

Get detailed statistics for a specific player.

**Parameters**:
- `address` (path): Ethereum address

**Response**:
```json
{
  "playerAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "totalTiles": 5,
  "totalTransactions": 12,
  "itemsPlaced": {
    "Tree": 2,
    "Rock": 1,
    "Flag": 2
  },
  "firstClaim": "2025-10-20T08:15:00.000Z",
  "lastActivity": "2025-10-20T10:30:00.000Z"
}
```

**Fields**:
- `totalTiles`: Number of tiles owned
- `totalTransactions`: Total on-chain transactions
- `itemsPlaced`: Breakdown of items by type
- `firstClaim`: Timestamp of first tile claim
- `lastActivity`: Timestamp of most recent action

**Example**:
```bash
curl http://localhost:4000/api/player/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266/stats
```

---

### GET /activity

Retrieve recent game events (tile claims, item placements).

**Query Parameters**:
- `limit` (optional): Number of events to return (default: 50, max: 200)

**Response**:
```json
{
  "events": [
    {
      "eventType": "TileClaimed",
      "tileId": 42,
      "player": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "timestamp": "2025-10-20T10:30:00.000Z",
      "blockNumber": "12345"
    },
    {
      "eventType": "ItemPlaced",
      "tileId": 42,
      "player": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "itemType": 1,
      "timestamp": "2025-10-20T10:31:00.000Z",
      "blockNumber": "12346"
    }
  ],
  "count": 2
}
```

**Event Types**:
- `TileClaimed`: Player claimed an unclaimed tile
- `ItemPlaced`: Player placed an item on their tile
- `ItemRemoved`: Player removed an item from their tile

**Errors**:
- `400 Bad Request`: Invalid limit value

**Example**:
```bash
# Get last 50 events
curl http://localhost:4000/api/activity

# Get last 10 events
curl http://localhost:4000/api/activity?limit=10
```

---

### GET /stats

Get overall game statistics.

**Response**:
```json
{
  "totalClaims": 42,
  "uniquePlayers": 7,
  "totalEvents": 125,
  "claimedTiles": 42,
  "unclaimedTiles": 58,
  "itemDistribution": {
    "Empty": 28,
    "Tree": 5,
    "Rock": 3,
    "Flag": 4,
    "Building": 2,
    "Water": 0
  },
  "topPlayers": [
    {
      "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "tilesOwned": 8
    },
    {
      "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "tilesOwned": 5
    }
  ]
}
```

**Fields**:
- `totalClaims`: Number of tiles claimed
- `uniquePlayers`: Number of unique addresses
- `totalEvents`: All blockchain events processed
- `itemDistribution`: Count of each item type
- `topPlayers`: Players ranked by tiles owned

**Example**:
```bash
curl http://localhost:4000/api/stats
```

---

### GET /sync-status

Get blockchain synchronization status.

**Response**:
```json
{
  "lastSyncedBlock": "12500",
  "lastSyncTime": "2025-10-20T10:30:00.000Z"
}
```

**Fields**:
- `lastSyncedBlock`: Latest block number processed
- `lastSyncTime`: Timestamp of last sync

**Example**:
```bash
curl http://localhost:4000/api/sync-status
```

---

### GET /health

Health check endpoint for monitoring.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-20T10:30:00.000Z",
  "database": "connected",
  "blockchain": {
    "connected": true,
    "blockNumber": 12500
  }
}
```

**Status Codes**:
- `200 OK`: All systems operational
- `503 Service Unavailable`: Database or blockchain connection issue

**Example**:
```bash
curl http://localhost:4000/api/health
```

---

## Data Types

### ItemType Enum

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

### Coordinate System

Tiles use a 10x10 grid with coordinates:
- **X axis**: 0-9 (left to right)
- **Y axis**: 0-9 (top to bottom)
- **Tile ID**: `tileId = y * 10 + x`

Example:
- Tile (0,0) = ID 0 (top-left)
- Tile (9,0) = ID 9 (top-right)
- Tile (0,9) = ID 90 (bottom-left)
- Tile (9,9) = ID 99 (bottom-right)

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "message": "Detailed explanation",
  "path": "/api/endpoint"
}
```

### HTTP Status Codes

- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters or validation error
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error
- `503 Service Unavailable`: Service dependency unavailable

### Common Errors

**Invalid Tile ID**:
```json
{
  "error": "Invalid tile ID",
  "message": "Tile ID must be between 0 and 99",
  "tileId": 150
}
```

**Invalid Ethereum Address**:
```json
{
  "error": "Invalid address",
  "message": "Address must be a valid Ethereum address"
}
```

**Invalid Limit**:
```json
{
  "error": "Invalid limit",
  "message": "Limit must be between 1 and 200"
}
```

---

## Rate Limiting

Currently, there is **no rate limiting** implemented. For production:

**Recommended limits**:
- 100 requests per minute per IP
- 1000 requests per hour per IP
- Burst allowance: 20 requests

**Implementation**: Use middleware like `express-rate-limit`

---

## CORS Policy

Current CORS configuration:
```javascript
{
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false
}
```

For production, restrict origins:
```javascript
{
  origin: ['https://yourdomain.com'],
  credentials: true
}
```

---

## WebSocket Events

While not REST endpoints, the backend also broadcasts WebSocket events:

**Connection**: `ws://localhost:4000`

**Events**:
- `tileClaimed`: Emitted when a tile is claimed
- `itemPlaced`: Emitted when an item is placed
- `itemRemoved`: Emitted when an item is removed
- `worldUpdate`: Periodic world state broadcast

**Subscribe via SDK**:
```typescript
game.on('tileClaimed', (event) => {
  console.log('Tile claimed:', event);
});
```

---

## Examples

### Complete Workflow

```bash
# 1. Check API health
curl http://localhost:4000/api/health

# 2. Get current world state
curl http://localhost:4000/api/world

# 3. Check a specific tile
curl http://localhost:4000/api/tile/0

# 4. Get player's tiles
curl http://localhost:4000/api/player/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 5. Get player statistics
curl http://localhost:4000/api/player/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266/stats

# 6. View recent activity
curl http://localhost:4000/api/activity?limit=20

# 7. Get game statistics
curl http://localhost:4000/api/stats

# 8. Check sync status
curl http://localhost:4000/api/sync-status
```

### Using with SDK

The SDK abstracts API calls:

```typescript
// Instead of: fetch('http://localhost:4000/api/world')
const world = await game.getWorldState();

// Instead of: fetch('http://localhost:4000/api/tile/42')
const tile = await game.getTile(42);

// Instead of: fetch('http://localhost:4000/api/activity')
const activity = await game.getActivity();
```

---

## Response Times

Typical response times (local development):

| Endpoint | Avg Response Time |
|----------|------------------|
| GET /health | 5ms |
| GET /world | 20ms |
| GET /tile/:id | 10ms |
| GET /player/:address | 15ms |
| GET /activity | 25ms |
| GET /stats | 30ms |

Production with network latency: Add 50-100ms

---

## Changelog

### v1.0.0 (Current)
- Initial API release
- 8 REST endpoints
- Health check endpoint
- WebSocket event broadcasting
- PostgreSQL caching layer

---

For SDK usage examples, see [SDK README](../sdk/README.md).

For deployment configuration, see [DEPLOYMENT.md](DEPLOYMENT.md).