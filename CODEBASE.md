MINIWORLD - INTERVIEW CHEAT SHEET

ONE-LINER
It's a Web3 game platform with a Solidity smart contract (10x10 grid, tile claiming, item placement), a TypeScript SDK that abstracts all contract interactions with bundled ABI distribution, a Node.js backend that indexes on-chain events into PostgreSQL with real-time Socket.IO updates, and two React frontends (game client with Canvas rendering + creator analytics dashboard). 44 contract tests and 78 SDK tests.

QUICK FACTS

Item                    Detail
What it does            On-chain grid game: claim tiles, place items, real-time multiplayer
Smart Contract          MiniWorld.sol (3 events, 7 functions, 10x10 grid = 100 tiles)
Solidity Version        0.8.30
Hardhat                 3.0.7 (Rust-based EDR runtime)
SDK                     TypeScript, ethers.js 6.13.7, socket.io-client 4.8.1
Backend                 Node.js 22.20, Express 5.1, PostgreSQL 18, Socket.IO 4.8
Game Client             React 19.2, Vite 7.1, Tailwind CSS 4.1, Canvas rendering
Creator Dashboard       React 19.2, Recharts 3.2 for analytics
Contract Tests          44 tests (Hardhat + Chai + TypeScript)
SDK Tests               78 automated tests + browser test suite
API Endpoints           8 REST endpoints
Event Polling           Every 2 seconds
WebSocket Latency       Sub-50ms event propagation
Docker                  5 containers (PostgreSQL, Hardhat, Backend, Game Client, Creator Dashboard)
GitHub                  https://github.com/Exalt24/Miniworld

ARCHITECTURE IN PLAIN ENGLISH
The game state lives entirely on-chain in the MiniWorld smart contract. Players interact through the TypeScript SDK, which handles MetaMask wallet connection and translates high-level calls (claimTile, placeItem) into contract transactions through ethers.js. The SDK bundles the contract ABI at build time so there are zero runtime fetches. The backend polls the blockchain every 2 seconds for new events, stores them in PostgreSQL, and broadcasts through Socket.IO. The game client renders the 10x10 grid on Canvas and updates in real time when other players make moves.

EVERY POSSIBLE INTERVIEW QUESTION

What/How Questions

Q: How does the smart contract work?
A: MiniWorld.sol manages a 10x10 grid (100 tiles). Each tile has an owner address, an ItemType enum (Empty, Tree, Rock, Flag, Building, Water), and a lastModified timestamp. Players call claimTile to take ownership of unclaimed tiles. Once they own a tile, they can call placeItem or removeItem. Custom errors handle invalid tile IDs, double claims, and non-owner access. The contract emits 3 events: TileClaimed, ItemPlaced, ItemRemoved. It has coordinate conversion functions (coordsToTileId and tileIdToCoords) for mapping between (x,y) pairs and flat tile IDs.

I went with a flat mapping (tileId = y * 10 + x) instead of a 2D mapping because it's cheaper on gas. A mapping(uint => mapping(uint => Tile)) would cost two SLOAD operations per read, while a single mapping(uint => Tile) costs one. For 100 tiles that's not a huge deal, but it's a good habit. The trade-off is I need the coordinate conversion functions, but those are pure functions so they cost zero gas when called externally.

One limitation worth acknowledging: the contract has no access control beyond tile ownership. There's no admin, no pause mechanism, no upgrade path. That's intentional for a demo since it keeps the contract simple and trustless, but in production you'd probably want at least an emergency pause. I chose not to add OpenZeppelin's Pausable or Ownable because I wanted the contract to be fully permissionless, which is the whole point of on-chain gaming. But it means if there's a bug, there's no way to stop it.

Q: Why Solidity 0.8.30 specifically?
A: 0.8.30 gives me built-in overflow protection (no SafeMath needed), custom errors (cheaper than require strings since they don't store string data on-chain), and the latest optimizer improvements. I could have gone with an older version, but custom errors alone save meaningful gas compared to string-based reverts. The trade-off is that 0.8.x's checked arithmetic adds a small gas overhead per operation compared to unchecked blocks, but for a game contract where correctness matters more than shaving a few gas units, that's the right call.

Q: How does the SDK work?
A: MiniWorldSDK is a TypeScript class (934 lines) that abstracts all blockchain and API interactions. You initialize it with a config object (contract address, API URL, WebSocket URL). It handles wallet management through MetaMask's ethereum provider. Read operations go through the REST API (faster than on-chain reads). Write operations go through ethers.js to the contract. It has an event emitter pattern with 14 event types covering wallet state, transaction lifecycle, game updates, and WebSocket status. The key design decision is bundled ABI distribution: a prebuild script copies the compiled ABI from contracts/artifacts into the SDK source, so consumers never need to fetch the ABI at runtime.

The reason I split reads and writes between the API and the blockchain is latency. An on-chain read through ethers.js still requires an RPC call, and you're at the mercy of the node's response time. The REST API reads from PostgreSQL, which is already indexed and optimized for the exact queries the game client needs (get all tiles, get player tiles, get stats). Writes obviously have to go on-chain since that's where the source of truth lives. This is a common pattern in Web3 apps, sometimes called a "read replica" architecture.

The alternative would have been to use something like The Graph for indexing, but that felt like overkill for a local Hardhat deployment. The Graph is great for mainnet where you need decentralized indexing, but for a portfolio project on a local chain, a simple Express + PostgreSQL setup is faster to build and easier to debug.

Q: Why ethers.js instead of viem?
A: I went with ethers.js 6.x because it's the library I know best and it has the most mature documentation and ecosystem. Viem is the newer, more TypeScript-native alternative with better tree-shaking (27KB vs 130KB bundle), stricter types, and a modular architecture. For a new project in 2026, viem would probably be the better choice since the industry is moving that direction, and wagmi (built on viem) is becoming the standard for React dApps.

The honest reason is that when I started MiniWorld, I was already comfortable with ethers.js Provider/Signer patterns, and learning viem's action-based API would have added time without changing the outcome. The SDK abstracts the blockchain library anyway, so swapping ethers for viem would be an internal change that doesn't affect consumers. That's actually one benefit of having the SDK layer: it isolates library choices.

If I were building this today, I'd seriously consider viem for the bundle size alone. The game client doesn't need all of ethers.js, just contract interaction and wallet connection. Viem's modular imports would let me pull in only what I need.

Q: How does the ABI distribution work?
A: The contracts compile to artifacts/MiniWorld.json. A prebuild script (sdk/scripts/copy-abi.js) runs before the SDK builds and copies the ABI into sdk/src/contractABI.ts as a TypeScript export. When the SDK is built, the ABI is baked into the bundle. The game client imports the SDK package and gets the ABI for free. No runtime ABI fetching, no extra network requests. This is important because the ABI is a build-time dependency, not a runtime one.

The alternative approaches I considered: (1) the frontend fetches the ABI from an API endpoint at startup, which adds latency and a failure point, (2) the frontend imports the ABI JSON directly, which couples it to the contract's build output path, or (3) using a tool like typechain or ABIType to generate typed wrappers. I went with the copy script because it's the simplest approach that still gives you type safety. The ABI becomes a TypeScript constant, so any changes to the contract surface immediately as build errors in the SDK.

The limitation is that if the contract changes, you have to rebuild the SDK. There's no automatic sync. In a CI/CD pipeline you'd chain these builds, but for local development it's a manual step. I mitigate this with the Docker deployment script which runs everything in the right order.

Q: What do the 44 contract tests cover?
A: Deployment (2 tests, grid constants and initial state), tile claiming (6 tests, including double-claim prevention, multi-player scenarios, invalid IDs, and lastModified tracking), item placement (7 tests, all 6 item types plus non-owner rejection, unclaimed tile rejection, invalid tile ID, lastModified, and item replacement), item removal (6 tests, owner removal, non-owner rejection, unclaimed tile, invalid ID, lastModified, and removing from already empty tile), view functions (5 tests, getTile, getPlayerTiles for claimed and unclaimed scenarios), coordinate conversion (5 tests, bidirectional conversion for all 100 tiles including edge cases), events (3 tests, validating all 3 event emissions with parameter checking), and complex scenarios (3 tests, full game cycles and batch operations).

I intentionally test edge cases that seem obvious, like removing an item from an already-empty tile. In Solidity, setting an enum to its zero value when it's already zero doesn't revert by default, so I want to make sure the event still emits correctly. These "obvious" tests have saved me from regressions in other projects.

Q: Why Hardhat over Foundry for testing?
A: Hardhat 3.x with its Rust-based EDR runtime is genuinely fast now, closing the gap with Foundry. But the real reason is ecosystem integration. My entire pipeline is TypeScript: the SDK, the backend, the frontends. Having contract tests in TypeScript means I can share type definitions and testing patterns across the stack. With Foundry, the tests would be in Solidity, which is great for unit testing contract logic but creates a language boundary when you need integration tests that touch the SDK or API.

Foundry has real advantages I'm giving up though. Fuzz testing is built-in (Hardhat needs plugins), and Forge tests run 2-5x faster on large suites. For a contract this size (131 lines, 44 tests), the speed difference is negligible. But if I were writing a DeFi protocol with complex invariants, I'd use Foundry for fuzz testing and Hardhat for integration tests. The industry is actually trending toward using both in the same repo, which is a pattern I'd adopt for a more complex project.

Q: What about the 78 SDK tests?
A: Core structure (2 tests, import verification and enum validation), type definitions (2 tests, ItemTypeNames mapping and error classes), coordinate conversion (6 tests, round-trip for all 100 tiles), SDK instance (1 test, config validation), and API operations (12 tests, covering all 7 read operations plus error handling for invalid inputs and bounds checking). There's also a browser test suite for interactive wallet connection, transaction lifecycle, WebSocket monitoring, and multi-player synchronization.

Q: How does real-time multiplayer work?
A: When Player A claims a tile, the transaction gets mined and a TileClaimed event emits on-chain. The backend's EventListener detects it within 2 seconds (polling interval). EventProcessor stores it in PostgreSQL and broadcasts through Socket.IO. Player B's game client receives the event through the SDK's WebSocket connection and updates the Canvas grid. Total latency is under 50ms from broadcast to render, plus up to 2 seconds for the polling detection.

The 2-second polling is the bottleneck here, and it's worth being honest about that. In the worst case, a player waits almost 2 seconds to see another player's move. For a tile-claiming game that's acceptable since it's not a twitch game. But for anything real-time like a battle system, you'd need WebSocket subscriptions to the blockchain node (or a service like Alchemy's subscription API) for near-instant event detection.

I chose polling because Hardhat 3.x's local node has compatibility issues with ethers.js contract.on() subscriptions. On mainnet with a provider like Alchemy or Infura, you'd use their WebSocket endpoints for event subscriptions and get sub-second detection. The polling approach is actually more reliable though since subscriptions can silently drop, and you need reconnection logic plus gap-fill polling anyway. So polling is the "boring but correct" approach.

Q: What's the database schema?
A: Three tables. world_state stores the current state of all 100 tiles (tile_id as primary key, owner, item_type, last_modified, x, y coordinates). Indexed on owner, coordinates, and item_type. events stores all historical blockchain events (event_type, tile_id, player_address, item_type, block_number, transaction_hash). Indexed on player_address, tile_id, event_type, and timestamp DESC. sync_status tracks the last synced block for recovery.

The world_state table is a materialized view of on-chain state, which means it can technically drift from the blockchain. The sync_status table exists to handle this: if the backend restarts, it picks up from the last synced block and replays any missed events. This is the standard "event sourcing" pattern for blockchain indexers.

One thing I'd do differently is add a checksum or periodic reconciliation that reads the full on-chain state and compares it to the database. Right now if an event is somehow missed (network issue during polling), the database would be permanently out of sync until someone notices. For 100 tiles, a full reconciliation would be cheap, maybe once every few minutes.

Why Questions / Architectural Decisions

Q: Why fully on-chain game state instead of a hybrid approach?
A: The entire game state (who owns which tile, what item is placed) lives in the smart contract. This means every action is verifiable, the game can't be cheated by a rogue server, and the state persists as long as the blockchain exists. Players truly own their tiles.

But I want to be honest about the trade-offs. Fully on-chain gaming is expensive and slow compared to centralized servers. Every tile claim costs gas. Every item placement costs gas. If this were on Ethereum mainnet, a single tile claim might cost $5-10 in gas. That's why most production blockchain games use a hybrid approach: game logic runs on a centralized server for speed, and only asset ownership and economic transactions go on-chain.

For MiniWorld, fully on-chain makes sense because the game is simple enough (100 tiles, 6 item types, no real-time physics) that the performance constraints don't matter. The alternative would be using a framework like MUD (by Lattice), which is an Entity Component System framework specifically designed for on-chain games. MUD handles state management, indexing, and client sync automatically, and it's battle-tested with millions of on-chain entities. I didn't use MUD because I wanted to understand the full stack myself, from raw Solidity to event indexing to real-time sync. But for a production on-chain game, MUD or Dojo (on Starknet) would save months of infrastructure work.

Another option would be L2 rollups or app-specific chains. Projects like Argus and World Engine build dedicated chains for games so you get near-zero gas costs and high throughput while still being verifiable on-chain. For a tile-claiming game with occasional actions, mainnet is fine. For anything with higher APM (actions per minute), you'd need an L2 or app-chain.

Q: Why a TypeScript SDK instead of direct contract calls?
A: Abstraction. Other developers or frontend components shouldn't need to understand ethers.js, ABI encoding, or gas estimation to interact with the game. The SDK provides clean async methods like claimTile(tileId) that handle wallet connection, transaction submission, confirmation waiting, and error parsing internally. It also combines on-chain writes with off-chain API reads in a single interface. The event emitter pattern gives consumers a clean way to react to state changes.

The alternative was using thirdweb's SDK, which provides pre-built contract interaction patterns, wallet connection, and even gasless transactions out of the box. Thirdweb is great for shipping fast since a small team can launch in 10-12 weeks with their tools. But it creates vendor lock-in, and the gaming SDKs are essentially wrappers around their general-purpose tools rather than being game-optimized. Building a custom SDK gave me full control over the API surface and taught me the internals of Web3 interaction, which is the whole point of a portfolio project.

In a production setting, I'd evaluate thirdweb for prototyping and switch to custom when we hit its limitations. The sweet spot is using thirdweb for wallet connection (which is tedious to build well) and custom SDK for game-specific logic.

Q: Why bundle the ABI at build time?
A: Zero runtime fetches. In a typical Web3 app, the frontend fetches the ABI from a server or imports it from a file. By baking it into the SDK at build time, consumers get the ABI as part of the package. This eliminates a network request, prevents version mismatches between the frontend ABI and deployed contract, and makes the SDK fully self-contained.

The downside is tight coupling between the contract and SDK builds. If the contract changes, the SDK must be rebuilt. In a monorepo with CI/CD this is fine since you chain the builds. But if the contract and SDK were separate packages published to npm, you'd need a versioning strategy to keep them in sync. For MiniWorld's monorepo setup, the build-time approach is simpler and safer.

Q: Why Canvas rendering instead of DOM elements?
A: Performance. Rendering 100 tiles as DOM elements with React re-renders would be slower than drawing them directly on a Canvas. Canvas gives 60 FPS rendering with minimal overhead. For a game with frequent state updates, Canvas is the right choice.

That said, 100 DOM elements wouldn't actually be slow. React can handle hundreds of elements fine. The real benefit of Canvas shows up at scale: if the grid were 1000x1000, DOM rendering would choke while Canvas would handle it fine. I chose Canvas partly for the learning experience and partly because it's the industry standard for game rendering. The limitation is that Canvas elements aren't accessible by default (no screen reader support, no tab navigation), which matters if you care about web accessibility. For a game, that's usually an acceptable trade-off.

Q: Why polling instead of event subscriptions?
A: Same reason as the Blockchain Explorer. Hardhat 3.x has an incompatibility with contract.on() subscriptions. Polling every 2 seconds is reliable and handles missed events through the sync_status recovery mechanism. In production with a service like Alchemy, you could add WebSocket subscriptions for lower latency.

The deeper reason polling is actually underrated: WebSocket subscriptions are stateful connections that can silently disconnect. When they reconnect, you have a gap of missed events that you need to backfill with... polling. So even subscription-based architectures need a polling fallback. I just cut to the chase and made polling the primary mechanism. The 2-second interval is a balance between freshness and RPC call volume. In production you'd tune this based on your provider's rate limits and the game's latency requirements.

Walk Me Through Questions

Q: Walk me through what happens when a player claims a tile
A: Player clicks a tile in the game client. React calls sdk.claimTile(tileId). SDK checks wallet is connected (throws WalletError if not). Gets the contract instance from ethers.js with the bundled ABI. Emits 'transactionStarted' event. Calls contract.claimTile(tileId) which triggers MetaMask popup. After user confirms, emits 'transactionSubmitted' with the tx hash. Waits for confirmation (1 block). Emits 'transactionConfirmed'. Meanwhile, the on-chain TileClaimed event fires. Backend's EventListener picks it up within 2 seconds. EventProcessor updates the world_state table (sets owner) and inserts into events table, all in one database transaction. Then broadcasts via Socket.IO. All other connected game clients receive the update through their SDK's WebSocket connection and update the Canvas.

One thing I'd add in production: optimistic UI updates. Right now the tile doesn't visually change until the transaction is confirmed and the backend broadcasts it. That's a delay of block confirmation time plus up to 2 seconds of polling. With optimistic updates, I'd immediately render the tile as "claimed (pending)" when the user submits the transaction, then confirm or rollback when the receipt comes in. This is the same pattern that apps like Uniswap use for swap confirmations.

Q: Walk me through the deployment pipeline
A: docker-deploy-all.ps1 handles everything. Step 1: Clean previous deployment. Step 2: Start PostgreSQL and Hardhat node. Step 3: Deploy MiniWorld.sol via Hardhat Ignition, extract the contract address. Step 4: Verify ABI generation in artifacts. Step 5: Build backend (copies ABI into config). Step 6: Build SDK (prebuild script copies ABI into contractABI.ts). Step 7: Build game client (imports compiled SDK). Step 8: Build creator dashboard. Step 9: Start all containers with docker-compose. Step 10: Run health checks on all services.

The build order matters because of the dependency chain: contract -> ABI -> SDK -> game client. If you parallelize the wrong steps, the game client might build with a stale SDK that has an old ABI. The PowerShell script enforces this ordering. In a CI system, you'd express these as pipeline stages with explicit dependencies.

What Would You Change Questions

Q: What would you do differently?
A: A few things, being honest:

First, I'd add optimistic UI updates. Right now there's a noticeable delay between clicking a tile and seeing it change. The user experience should be: click, immediate visual feedback, then confirm/rollback async.

Second, I'd explore using MUD framework for the on-chain layer. MUD gives you an Entity Component System with built-in state synchronization, indexing, and client-side state management. I built all of that manually (EventListener, EventProcessor, world_state table, Socket.IO broadcasting), and MUD handles it out of the box. The trade-off is that MUD adds framework complexity and lock-in, but for on-chain games specifically, it's becoming the industry standard.

Third, I'd consider viem over ethers.js for the SDK. The bundle size reduction (130KB to 27KB) matters for a game client that needs to load fast. And viem's TypeScript types are stricter, which catches more bugs at compile time.

Fourth, I'd add Foundry alongside Hardhat. Foundry's fuzz testing would let me automatically generate thousands of random tile IDs, item types, and player addresses to find edge cases that my 44 handwritten tests might miss. I'd keep Hardhat for the TypeScript integration tests and deployment, but use Foundry's forge for property-based testing.

Q: How would you scale this to thousands of players?
A: The contract itself scales fine since storage is per-tile. But there are real bottlenecks:

The 10x10 grid is a design constraint. With 100 tiles and thousands of players, most players couldn't claim anything. You'd need larger grids or procedural world generation. The architecture supports arbitrary grid sizes since tile IDs are just integers, but the contract would need gas optimization for large grids (getPlayerTiles iterates all tiles, which would be prohibitively expensive at 10,000+ tiles).

The backend would need Redis caching instead of in-memory for horizontal scaling. Socket.IO supports Redis adapter for multi-instance broadcasting. The database would benefit from read replicas for the analytics queries.

On-chain, you'd hit gas limits. Ethereum mainnet processes about 15 transactions per second. If 1000 players try to claim tiles simultaneously, they'd be competing for block space and paying escalating gas fees. This is exactly why L2s and app-specific chains exist. You'd deploy to something like Base, Arbitrum, or a dedicated rollup where transactions cost fractions of a cent and throughput is much higher.

Q: How does this relate to tokenization?
A: The SDK pattern transfers directly. For tokenization, instead of claimTile and placeItem, you'd have mint, burn, and transfer. The bundled ABI approach eliminates version mismatches between your backend services and the deployed contracts. The event indexing pattern is the same: poll for events, store in database, reconcile state. The TypeScript abstraction layer means other services interact with clean function calls, not raw contract encoding.

Q: What are the security considerations?
A: The contract uses custom errors instead of require strings, which saves gas and gives clearer error messages. Access control is ownership-based: only the tile owner can place or remove items. There's no reentrancy risk because the contract doesn't make external calls or send ETH.

But there are things I'd add for production: (1) Rate limiting at the contract level to prevent a single address from claiming all tiles in one block. (2) An emergency pause mechanism, even if it compromises decentralization, because contract bugs can't be fixed without one. (3) Input validation for item types at the contract level (right now the enum handles it, but explicit validation would be defense-in-depth). (4) Events should include the previous state for cleaner off-chain reconciliation.

The backend has its own security surface: the API endpoints are read-only which limits damage, but there's no rate limiting on API calls, no authentication, and the Socket.IO connection accepts any client. For a local demo that's fine, but production would need API keys, rate limiting, and connection authentication.

MODELS & LIBRARIES CHEAT SHEET

Name                    What it does                                    Why it's here
Solidity 0.8.30         Smart contract language                         Latest stable with custom errors and built-in overflow protection
Hardhat 3.0.7           Dev environment                                 Rust-based EDR runtime, faster than Hardhat 2, TypeScript-native testing
ethers.js 6.13.7        Blockchain interaction                          Contract calls, ABI encoding, wallet management (would consider viem for new projects)
Express 5.1.0           REST API                                        8 endpoints for game state and analytics
PostgreSQL 18.0         Database                                        3 tables: world_state, events, sync_status
Socket.IO 4.8.1         Real-time                                       Sub-50ms event propagation, auto-reconnect
React 19.2.0            Frontend                                        Game client (Canvas) + Creator dashboard (Recharts)
Vite 7.1.10             Build tool                                      Requires Node 22.12+
Tailwind CSS 4.1.14     Styling                                         Utility-first CSS with @tailwindcss/vite plugin
Recharts 3.2.1          Charts                                          Creator dashboard analytics
TypeScript 5.9          Type safety                                     Strict mode across all layers
Docker Compose          Orchestration                                   5 containers, PowerShell deployment script

KEY FILES MAP

If they ask about...                            Open this file
Smart contract (grid, tiles, items)             contracts/contracts/MiniWorld.sol (131 lines)
Contract tests (44)                             contracts/test/MiniWorld.test.ts
Deployment module                               contracts/ignition/modules/MiniWorld.ts
SDK main class (934 lines)                      sdk/src/MiniWorldSDK.ts
SDK types and enums                             sdk/src/types.ts
ABI copy prebuild script                        sdk/scripts/copy-abi.js
SDK tests (78)                                  sdk/test/test-node.mjs
Browser tests (interactive)                     sdk/test/test-browser.html
Event polling                                   backend/src/services/EventListener.ts
Event processing and DB storage                 backend/src/services/EventProcessor.ts
Game state queries                              backend/src/services/GameService.ts
Statistics                                      backend/src/services/StatsService.ts
REST API (8 endpoints)                          backend/src/api/routes.ts
WebSocket broadcasting                          backend/src/websocket/server.ts
Database schema (3 tables)                      backend/migrations/
Game client (Canvas rendering)                  game-client/src/components/
Creator dashboard                               creator-dashboard/src/components/
Docker deployment script                        scripts/docker-deploy-all.ps1
Architecture documentation                      docs/ARCHITECTURE.md (681 lines)
