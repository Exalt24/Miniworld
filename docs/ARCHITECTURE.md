# MiniWorld Architecture

Comprehensive system design documentation covering components, data flow, and technical decisions.

## Table of Contents

- [System Overview](#system-overview)
- [Layer Architecture](#layer-architecture)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Event Processing](#event-processing)
- [Real-Time Synchronization](#real-time-synchronization)
- [Technical Decisions](#technical-decisions)

---

## System Overview

MiniWorld is a full-stack blockchain game built on a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  ┌──────────────────┐       ┌──────────────────────────┐   │
│  │   Game Client    │       │  Creator Dashboard       │   │
│  │  (React 19)      │       │     (React 19)           │   │
│  └────────┬─────────┘       └───────────┬──────────────┘   │
└───────────┼─────────────────────────────┼──────────────────┘
            │                             │
            └──────────┬──────────────────┘
                      │
┌────────────────────┼────────────────────────────────────────┐
│                    │   SDK Layer                             │
│         ┌──────────┴───────────┐                            │
│         │  MiniWorld SDK       │                            │
│         │  (TypeScript)        │                            │
│         └──────┬───────────────┘                            │
└────────────────┼────────────────────────────────────────────┘
            │
┌───────────┼────────────────────────────────────────────────┐
│   Backend │ Layer                                           │
│  ┌────────┴────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Event Listener │  │   REST API   │  │  WebSocket   │  │
│  │  (Indexer)      │  │  (Express)   │  │  (Socket.IO) │  │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘  │
│           │                  │                  │           │
│           └──────────────────┼──────────────────┘           │
│                             │                              │
│                    ┌────────┴────────┐                     │
│                    │   PostgreSQL    │                     │
│                    │   (Cache Layer) │                     │
│                    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
            │
┌───────────┼────────────────────────────────────────────────┐
│           │  Blockchain Layer                               │
│  ┌────────┴────────────┐                                   │
│  │  MiniWorld Contract │                                   │
│  │    (Solidity)       │                                   │
│  └─────────────────────┘                                   │
│           │                                                │
│  ┌────────┴────────────┐                                   │
│  │   Hardhat Node      │                                   │
│  │  (Development)      │                                   │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer Architecture

### 1. Blockchain Layer

**Purpose**: Source of truth for all game state

**Components**:
- **MiniWorld Smart Contract**: Stores tile ownership and items on-chain
- **Hardhat Node**: Local Ethereum node for development

**Responsibilities**:
- Validate ownership and permissions
- Emit events for state changes
- Persist game state permanently

**Technology**: Solidity 0.8.31, Hardhat 3.0.7

---

### 2. Backend Layer

**Purpose**: Index blockchain events and provide fast data access

**Components**:

#### Event Listener
- Connects to blockchain via ethers.js
- Polls for new events every 2 seconds
- Processes TileClaimed, ItemPlaced, ItemRemoved events
- Recovers from missed blocks on restart

#### Event Processor
- Parses blockchain events
- Updates PostgreSQL cache
- Tracks sync status
- Handles reorgs gracefully

#### REST API (Express 5)
- 8 endpoints for game data
- Response caching with fresh data guarantee
- Input validation middleware
- Health check monitoring

#### WebSocket Server (Socket.IO)
- Broadcasts events to connected clients
- Room-based subscriptions
- Auto-reconnect support
- Connection tracking

#### PostgreSQL Database
- Caches world state for fast queries
- Indexes on owner, coordinates, item type
- Tracks sync status and events
- 3x faster I/O with PostgreSQL 18 AIO

**Technology**: Node.js 22, Express 5, Socket.IO 4.8, PostgreSQL 18

---

### 3. SDK Layer

**Purpose**: Abstract Web3 complexity for developers

**Components**:

#### Wallet Management
- MetaMask connection
- Account detection
- Network validation
- Disconnect handling

#### Blockchain Operations
- Contract interaction (read/write)
- Transaction lifecycle management
- Gas estimation
- Error handling

#### API Integration
- HTTP client for backend
- Response parsing
- Error transformation

#### WebSocket Client
- Real-time event subscriptions
- Auto-reconnect logic
- Event emission to application

**Technology**: TypeScript 5.9, ethers.js 6.13, Socket.IO Client 4.8

---

### 4. Frontend Layer

**Purpose**: User interfaces for players and creators

**Components**:

#### Game Client
- Canvas-based 10x10 grid rendering
- Tile selection and interaction
- Activity feed with live updates
- Player statistics
- Transaction status tracking

#### Creator Dashboard
- World overview minimap
- Analytics charts (Recharts)
- Event log with search/filter
- Player management
- Real-time metrics

**Technology**: React 19, Vite 7, Tailwind CSS 4, Recharts 3

---

## Component Details

### Smart Contract (MiniWorld.sol)

**State Variables**:
```solidity
mapping(uint256 => Tile) public tiles;
mapping(address => uint256[]) private playerTiles;

struct Tile {
    address owner;
    ItemType itemType;
    uint256 lastModified;
}

enum ItemType { Empty, Tree, Rock, Flag, Building, Water }
```

**Core Functions**:
- `claimTile(uint256 tileId)`: Claim an unclaimed tile
- `placeItem(uint256 tileId, ItemType itemType)`: Place item on owned tile
- `removeItem(uint256 tileId)`: Remove item from owned tile
- `getTile(uint256 tileId)`: View tile state
- `getPlayerTiles(address player)`: Get player's tiles

**Events**:
```solidity
event TileClaimed(uint256 indexed tileId, address indexed owner, uint256 timestamp);
event ItemPlaced(uint256 indexed tileId, address indexed owner, ItemType itemType, uint256 timestamp);
event ItemRemoved(uint256 indexed tileId, address indexed owner, uint256 timestamp);
```

---

### Event Listener Service

**Flow**:
```
1. Connect to blockchain via ethers.js provider
2. Get contract instance with ABI
3. Query sync_status for last processed block
4. Poll every 2 seconds for new events:
   a. Get latest block number
   b. Query events from lastBlock+1 to latestBlock
   c. Pass events to EventProcessor
   d. Update sync_status
5. On error, log and retry after 10 seconds
```

**Error Handling**:
- Network disconnection: Retry with exponential backoff
- Invalid block range: Reset to safe block
- Missing events: Re-index from last known good block

---

### Event Processor Service

**Processing Pipeline**:
```
1. Receive event from EventListener
2. Parse event data (tileId, owner, itemType, etc.)
3. Begin database transaction
4. Update world_state table
5. Insert into events table
6. Commit transaction
7. Broadcast via WebSocket
8. Update sync_status
```

**Event Types Handling**:

- **TileClaimed**:
  - Update tile owner
  - Set itemType to Empty
  - Update lastModified

- **ItemPlaced**:
  - Update tile itemType
  - Update lastModified

- **ItemRemoved**:
  - Set itemType to Empty
  - Update lastModified

---

### Game Service

**Responsibilities**:
- Query world state from database
- Fetch individual tiles
- Get player's owned tiles
- Retrieve activity history

**Caching Strategy**:
- World state cached for 1 second
- Individual tiles cached for 5 seconds
- Activity refreshed on each request
- Stats computed on-demand

---

## Data Flow

### Transaction Flow (Player Claims Tile)

```
1. User clicks "Claim" button in Game Client
   └─> Calls game.claimTile(42)

2. SDK sends transaction to blockchain
   ├─> Validates user is connected
   ├─> Estimates gas
   ├─> Submits transaction
   └─> Emits 'transactionStarted' event

3. User confirms in MetaMask
   └─> Transaction submitted to mempool

4. Transaction mined in block
   ├─> Contract emits TileClaimed event
   └─> Transaction receipt generated

5. Event Listener detects event (within 2s)
   └─> Passes to Event Processor

6. Event Processor updates database
   ├─> UPDATE world_state SET owner=...
   ├─> INSERT INTO events VALUES (...)
   └─> Commits transaction

7. WebSocket broadcasts to all clients
   └─> Emits 'tileClaimed' event

8. All connected clients receive update
   ├─> Game Client updates grid
   ├─> Activity feed shows new event
   └─> Creator Dashboard updates metrics

9. SDK emits 'transactionConfirmed'
   └─> Game Client shows success message
```

**Total Time**: 3-5 seconds from click to all clients updated

---

### Query Flow (Get World State)

```
1. Game Client requests world state
   └─> Calls game.getWorldState()

2. SDK makes HTTP request
   └─> GET /api/world

3. Backend REST API handler
   ├─> Queries PostgreSQL: SELECT * FROM world_state
   ├─> Formats response with coordinates
   └─> Returns JSON (100 tiles)

4. SDK parses response
   └─> Returns TypeScript objects

5. Game Client renders grid
   ├─> Loops through tiles
   ├─> Draws each tile on Canvas
   └─> Applies colors based on ownership
```

**Total Time**: 50-100ms

---

## Database Schema

### world_state Table

```sql
CREATE TABLE world_state (
  tile_id INTEGER PRIMARY KEY CHECK (tile_id >= 0 AND tile_id <= 99),
  owner TEXT NOT NULL,
  item_type INTEGER NOT NULL CHECK (item_type >= 0 AND item_type <= 5),
  last_modified BIGINT NOT NULL,
  x INTEGER NOT NULL CHECK (x >= 0 AND x <= 9),
  y INTEGER NOT NULL CHECK (y >= 0 AND y <= 9),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_world_state_owner ON world_state(owner);
CREATE INDEX idx_world_state_coords ON world_state(x, y);
CREATE INDEX idx_world_state_item_type ON world_state(item_type);
```

### events Table

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  tile_id INTEGER NOT NULL,
  player_address TEXT NOT NULL,
  item_type INTEGER,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_player ON events(player_address);
CREATE INDEX idx_events_tile ON events(tile_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
```

### sync_status Table

```sql
CREATE TABLE sync_status (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_synced_block BIGINT NOT NULL DEFAULT 0,
  last_sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Event Processing

### Event Types

| Event | Triggers When | Data |
|-------|--------------|------|
| TileClaimed | Player claims unclaimed tile | tileId, owner, timestamp |
| ItemPlaced | Player places item on owned tile | tileId, owner, itemType, timestamp |
| ItemRemoved | Player removes item from owned tile | tileId, owner, timestamp |

### Processing Guarantees

- **At-least-once delivery**: Events may be processed multiple times
- **Idempotency**: Database updates are idempotent (UPDATE vs INSERT)
- **Ordering**: Events processed in block order
- **Atomicity**: Each event update is a database transaction

### Missed Event Recovery

On startup:
```
1. Read last_synced_block from sync_status
2. Get current blockchain height
3. If gap > 1000 blocks, process in batches of 1000
4. Query events for each batch
5. Process events sequentially
6. Update sync_status after each batch
```

---

## Real-Time Synchronization

### WebSocket Architecture

**Server Side**:
```javascript
// Socket.IO server attached to Express
const io = new Server(server, { cors: { origin: '*' } });

// Broadcast event to all clients
io.emit('tileClaimed', { tileId, owner, timestamp });

// Connection tracking
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
```

**Client Side (SDK)**:
```typescript
// Auto-connect on SDK initialization
this.socket = io(wsUrl);

// Subscribe to events
this.socket.on('tileClaimed', (event) => {
  this.emit('tileClaimed', event);
});

// Auto-reconnect on disconnect
this.socket.on('reconnect', () => {
  console.log('Reconnected to server');
});
```

**Latency**: <50ms from event broadcast to client receipt

---

## Technical Decisions

### Why PostgreSQL 18?

- **3x I/O performance**: AIO subsystem for faster reads/writes
- **Mature ecosystem**: Robust query optimization
- **JSONB support**: Flexible data structures if needed
- **Transaction safety**: ACID guarantees

### Why Express 5?

- **Async support**: No need for try-catch wrappers
- **Familiar API**: Minimal migration from Express 4
- **Performance**: V8 optimizations

### Why Socket.IO?

- **Auto-reconnect**: Handles network issues gracefully
- **Room support**: Future-proof for targeted broadcasts
- **Fallback support**: WebSocket with polling fallback

### Why Hardhat 3?

- **Rust EDR**: 10x faster than JavaScript EVM
- **Declarative config**: Cleaner than imperative
- **Ignition**: Built-in deployment framework

### Why React 19?

- **Ref as prop**: Simpler component composition
- **Actions API**: Better form handling
- **Performance**: Concurrent rendering

### Why Vite 7?

- **Speed**: Instant HMR, fast builds
- **ESBuild**: Native bundler performance
- **Node 22**: Latest JavaScript features

### Why Tailwind CSS 4?

- **CSS-first**: No JavaScript config
- **Performance**: Faster builds
- **DX**: Better autocomplete

---

## Performance Optimizations

### Database

- **Indexes**: On owner, coordinates, item_type, timestamp
- **Connection pooling**: Reuse connections
- **Prepared statements**: Query plan caching

### API

- **Response caching**: 1-5 second TTL
- **Compression**: Gzip responses
- **Pagination**: Limit query results

### Frontend

- **Code splitting**: Lazy load components
- **Canvas rendering**: Direct pixel manipulation
- **Memoization**: React.memo, useMemo, useCallback

### Blockchain

- **Gas optimization**: Solidity optimizer enabled
- **Event filtering**: Indexed parameters
- **Batch queries**: Reduce RPC calls

---

## Scalability Considerations

### Horizontal Scaling

**Stateless backend**: Multiple backend instances behind load balancer

**Database replication**: Read replicas for queries

**WebSocket**: Sticky sessions or Redis pub/sub

### Vertical Scaling

**Database**: Increase PostgreSQL resources (RAM, CPU)

**Backend**: Node.js cluster mode

**Caching**: Redis for hot data

### Future Enhancements

- **Message queue**: RabbitMQ for event processing
- **CDN**: CloudFlare for frontend assets
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK stack for centralized logs

---

## Security Architecture

### Smart Contract

- **Access control**: Only tile owners can modify
- **Input validation**: Tile ID bounds checking
- **Reentrancy protection**: No external calls after state changes

### Backend

- **SQL injection**: Parameterized queries
- **CORS**: Configurable origin restrictions
- **Rate limiting**: (To be implemented)
- **Input validation**: Express middleware

### Frontend

- **XSS protection**: React escapes by default
- **CSRF**: Not applicable (no cookies)
- **Content Security Policy**: Set in nginx

---

## Deployment Architecture

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide.

**Development**:
```
Local machine → Docker containers → Port mapping
```

**Production**:
```
Cloud VM → Docker Compose → Nginx reverse proxy → SSL/TLS
```

---

## Monitoring & Observability

### Health Checks

- **Backend**: `/api/health` endpoint
- **Database**: Connection test in health check
- **Blockchain**: Block number in health check

### Metrics to Track

- API response times
- WebSocket connection count
- Event processing lag
- Database query performance
- Transaction gas usage

### Logging

- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Timestamps in ISO format
- Request IDs for tracing

---

## Testing Strategy

### Smart Contracts

- Unit tests: 37 tests covering all functions
- Gas usage reporting
- Event emission validation

### Backend

- Integration tests: API endpoints
- Event processing tests
- Database migration tests

### Frontend

- Component tests: React Testing Library
- End-to-end tests: Playwright (future)

### SDK

- Unit tests: 78 tests
- Mock responses
- Error handling tests

---

For implementation details, see individual component README files.

For API reference, see [API.md](API.md).

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).