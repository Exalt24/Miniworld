# MiniWorld

A small multiplayer Web3 game on a local Ethereum chain. Players claim tiles on a 10x10 grid and place items on them, with all game state in a Solidity contract. A backend indexes the contract events into PostgreSQL, serves a REST API and pushes updates over WebSocket, and a TypeScript SDK wraps the contract and API for two React apps: a player client and a creator analytics dashboard. The whole stack runs locally in Docker. It has not been deployed to a public network.

## Contents

- [Overview](#overview)
- [Documentation](#documentation)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Development workflow](#development-workflow)
- [API reference](#api-reference)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Tech stack](#tech-stack)

## Overview

- Game state lives in the `MiniWorld.sol` contract: tile ownership and item placement
- A WebSocket feed (Socket.IO) pushes tile and item events to every connected client
- The player client is a React 19 app that draws the board on a canvas
- The creator dashboard shows activity and statistics with Recharts
- The SDK exposes contract calls, REST reads and WebSocket events, and has the contract ABI bundled at build time
- Docker Compose runs everything with one script

## Documentation

- [API reference](docs/API.md): REST endpoints and WebSocket events
- [Architecture](docs/ARCHITECTURE.md): system design, data flow and how the ABI gets distributed
- [Deployment](docs/DEPLOYMENT.md): container orchestration and notes on deploying beyond a local machine
- [SDK guide](sdk/README.md): installation, usage and the SDK API

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser layer                        │
├─────────────────────────────────────────────────────────┤
│  Game client (3000)  │  Creator dashboard (3001)        │
│  • Canvas game board │  • Analytics charts              │
│  • Real-time updates │  • Event log                     │
│  • SDK integration   │  • Player management             │
└────────────┬────────────────────────┬───────────────────┘
             │                        │
             │   MiniWorld SDK (bundled into frontends)
             │   • Contract ABI baked in at build time
             │   • WebSocket client
             │   • Transaction handling
             │                        │
┌────────────┴────────────────────────┴───────────────────┐
│                   Backend layer                          │
├─────────────────────────────────────────────────────────┤
│  Backend API (4000)                                     │
│  • REST API (8 endpoints)                               │
│  • WebSocket server (Socket.IO)                         │
│  • Event indexer                                        │
│  • Contract ABI loaded from build                       │
└────────────┬──────────────────┬─────────────────────────┘
             │                  │
    ┌────────┴────────┐  ┌─────┴──────────┐
    │  PostgreSQL 18   │  │  Hardhat node  │
    │  • World state   │  │  • Smart       │
    │  • Event log     │  │    contracts   │
    │  • Stats cache   │  │  • Local EVM   │
    └──────────────────┘  └────────────────┘
```

### How the contract ABI reaches each component

1. Deploying the contracts generates `contracts/artifacts/MiniWorld.json`.
2. The backend build copies the ABI into its Docker image.
3. The SDK build runs a prebuild script that copies the ABI into `sdk/src/contractABI.ts`, and TypeScript compiles the SDK with it.
4. The frontend builds import the SDK, and Vite bundles the ABI into the JavaScript.

Every component has the ABI without fetching it at runtime.

## Quick start

You need Docker Desktop (Windows or Mac) or Docker Engine (Linux), and PowerShell on Windows or Bash on Mac and Linux. Node.js 22.12 or newer is only needed for local development outside Docker.

```powershell
.\scripts\docker-deploy-all.ps1
```

The script cleans the previous deployment, starts PostgreSQL and the Hardhat node, deploys the contracts, generates and distributes the ABI, builds the backend, SDK and frontends, starts the containers and checks that they are healthy. The first run takes several minutes and later runs are faster.

| Application | URL | Purpose |
|-------------|-----|---------|
| Game client | http://localhost:3000 | Play the game |
| Creator dashboard | http://localhost:3001 | View analytics |
| Backend API | http://localhost:4000/api | API endpoints |
| Health check | http://localhost:4000/api/health | Service status |

## Project structure

```
miniworld/
├── contracts/              # Smart contracts (Solidity + Hardhat 3)
│   ├── contracts/
│   │   └── MiniWorld.sol   # Main game contract
│   ├── ignition/           # Hardhat Ignition deployment
│   ├── test/               # Contract tests (37)
│   └── artifacts/          # Generated ABI (not in git)
│
├── backend/                # Event indexer + REST API
│   ├── src/
│   │   ├── config/         # Database and blockchain config
│   │   ├── services/       # Event processing and game logic
│   │   ├── api/            # Express routes (8 endpoints)
│   │   └── websocket/      # Socket.IO server
│   └── migrations/         # SQL schema migrations
│
├── sdk/                    # TypeScript SDK for the contract and API
│   ├── src/
│   │   ├── MiniWorldSDK.ts # Main SDK class
│   │   ├── types.ts        # Type definitions
│   │   ├── contractABI.ts  # Generated ABI (empty template in git)
│   │   └── index.ts        # Public exports
│   ├── scripts/
│   │   └── copy-abi.js     # Prebuild script (copies ABI)
│   └── test/               # SDK test script and a browser test page
│
├── game-client/            # Player-facing React app
├── creator-dashboard/      # Analytics dashboard
├── docker/                 # Dockerfiles and nginx configs
├── scripts/                # docker-deploy-all.ps1, docker-status.ps1
├── docker-compose.yml      # Base service configuration (dev overrides baked in)
└── docker-compose.prod.yml # Production-style configuration (see docs/DEPLOYMENT.md)
```

## Development workflow

### Contract changes

```powershell
code contracts/contracts/MiniWorld.sol

# Redeploy everything
.\scripts\docker-deploy-all.ps1
```

The script recompiles the contracts to get a new ABI, updates the contract address in the `.env` files, and rebuilds the backend, SDK and frontends against it.

### Backend changes

```powershell
code backend/src/services/GameService.ts

# In dev mode the backend reloads itself. To rebuild by hand:
docker-compose build backend
docker-compose up -d backend
```

### SDK changes

```powershell
code sdk/src/MiniWorldSDK.ts

cd sdk
npm run build

# The frontends import the SDK, so rebuild them too
docker-compose build game-client creator-dashboard
docker-compose up -d game-client creator-dashboard
```

### Frontend changes

```powershell
code game-client/src/components/GameBoard.tsx

# In dev mode Vite reloads through volume mounts. To rebuild by hand:
docker-compose build game-client
docker-compose up -d game-client
```

### Commands

```powershell
docker-compose ps                       # service status
docker-compose logs -f                  # all logs
docker-compose logs -f backend          # one service
docker-compose down                     # stop, keep data
docker-compose down -v                  # stop, delete data
.\scripts\docker-status.ps1             # optional status dashboard
docker-compose restart backend
```

## API reference

Base URL: `http://localhost:4000/api`

### World state

**Get all tiles**: `GET /api/world` returns all 100 tiles with their current state.

```json
{
  "tiles": [
    {
      "tileId": 0,
      "owner": "0x0000000000000000000000000000000000000000",
      "itemType": 0,
      "x": 0,
      "y": 0,
      "lastModified": "1640000000"
    }
  ],
  "totalTiles": 100,
  "lastUpdated": "2025-01-20T10:30:00Z"
}
```

**Get one tile**: `GET /api/tile/:id`, where `id` is the tile ID (0 to 99).

**Get a player's tiles**: `GET /api/player/:address`, where `address` is an Ethereum address.

### Activity and stats

**Recent events**: `GET /api/activity?limit=50`, where `limit` is 1 to 200 and defaults to 50.

**Game statistics**: `GET /api/stats`

```json
{
  "total_claims": 42,
  "unique_players": 15,
  "total_events": 127,
  "items_by_type": {
    "0": 58,
    "1": 12,
    "2": 8,
    "3": 5,
    "4": 3,
    "5": 14
  }
}
```

The item types are 0 Empty, 1 Tree, 2 Rock, 3 Flag, 4 Building and 5 Water.

**Player statistics**: `GET /api/player/:address/stats`

### System

**Health check**: `GET /api/health`

**Sync status**: `GET /api/sync-status`

### WebSocket events

Connect to `ws://localhost:4000`.

- `tileClaimed`: a player claimed a tile
- `itemPlaced`: a player placed an item
- `itemRemoved`: a player removed an item
- `worldUpdate`: a general state change

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

socket.on('tileClaimed', (data) => {
  console.log('Tile claimed:', data.tileId, 'by', data.owner);
});
```

## Testing

### Contract tests

```powershell
cd contracts
npm install
npm test

# With gas reporting
npm test -- --gas-report

# One test
npm test -- --grep "Should allow claiming"
```

On 2026-10-07 this printed `37 passing`.

### SDK tests

```powershell
cd sdk
npm install
npm run build
node test/test-node.mjs
```

The script has 79 assert calls. It needs the contract artifacts (the build copies the ABI from `contracts/artifacts`) and, for its API checks, the backend running on port 4000. On 2026-10-07 without the backend it reported 34 passed and 8 failed, and the 8 failures were the API read checks that could not reach port 4000. Several of the passing lines are status messages rather than assertions. The write and WebSocket checks need a browser and a wallet: serve the folder with `npx http-server -p 8080` and open `http://localhost:8080/test/test-browser.html`.

### Full-stack check

`.\scripts\docker-deploy-all.ps1` ends with a validation step that reports PostgreSQL, the backend API, the 100-tile world state and both frontends.

## Troubleshooting

### Services will not start

```powershell
docker-compose logs
docker-compose logs backend
docker-compose down
.\scripts\docker-deploy-all.ps1
```

### Port already in use

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :4000
netstat -ano | findstr :8545

# Replace <PID> with the process ID
taskkill /PID <PID> /F
```

Or change the port in `docker-compose.yml`.

### Contract address mismatch

```powershell
type backend\.env | findstr CONTRACT_ADDRESS
type game-client\.env | findstr CONTRACT_ADDRESS
type creator-dashboard\.env | findstr CONTRACT_ADDRESS

# If they differ, redeploy
.\scripts\docker-deploy-all.ps1
```

### Database connection errors

```powershell
docker-compose ps postgres
docker-compose restart postgres

# Or rebuild everything
docker-compose down -v
.\scripts\docker-deploy-all.ps1
```

### MetaMask will not connect

1. Add the Hardhat network: name `Hardhat Local`, RPC URL `http://localhost:8545`, chain ID `31337`, currency symbol `ETH`.
2. Import a test account. Open a Hardhat console with `docker-compose exec contracts npx hardhat console --network localhost` and read the account from the signers, or take a private key from the Hardhat node output.
3. If transactions still fail after a restart, use Settings, Advanced, Reset Account in MetaMask.

### ABI loading errors

```powershell
dir contracts\artifacts\contracts\MiniWorld.sol\MiniWorld.json

# If it is missing, redeploy
.\scripts\docker-deploy-all.ps1
```

### Canvas not rendering

Open the browser console (F12), check that the SDK initialized and that the WebSocket connected.

### Clear everything and start fresh

```powershell
docker-compose down -v
docker-compose down --rmi all
.\scripts\docker-deploy-all.ps1
```

This takes longer than a normal run but starts from a clean state.

## Tech stack

### Contracts and blockchain
- Solidity 0.8.30
- Hardhat 3.0.7
- ethers.js 6.13.7
- Local Hardhat node, chain ID 31337

### Backend
- Node.js 22, TypeScript 5.9
- Express 5.1
- PostgreSQL 18 with the `pg` driver 8.13.1
- Socket.IO 4.8.1
- tsx 4.19.2

### Frontend
- React 19.2 and TypeScript 5.9
- Vite 7.1
- Tailwind CSS 4.1
- Recharts 3.2.1 (creator dashboard)
- Nginx (Alpine) to serve the production build

### Tooling
- Docker 24+ and Docker Compose v2

## Security

This is a development setup with default credentials, no API authentication and `CORS_ORIGIN=*`. Before putting anything like it on a public network you would need to change the PostgreSQL password, add authentication and rate limiting to the API, serve it over HTTPS with a real CORS origin, put the contract through a professional audit and test it on a testnet first, and move secrets into a secrets manager.

## Environment variables

### Backend (`.env`)

```env
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=miniworld
DB_USER=postgres
DB_PASSWORD=postgres
RPC_URL=http://contracts:8545
CONTRACT_ADDRESS=0x...  # updated by the deploy script
CHAIN_ID=31337
START_BLOCK=0
GRID_SIZE=10
CORS_ORIGIN=*
```

### Frontend (`.env`)

```env
# Game client and creator dashboard
VITE_API_URL=http://localhost:4000/api
VITE_WS_URL=http://localhost:4000
VITE_CONTRACT_ADDRESS=0x...  # updated by the deploy script
```

`VITE_*` variables are baked into the JavaScript at build time, so changing one means rebuilding the frontend.

## Running it locally

```powershell
git clone https://github.com/Exalt24/Miniworld.git
cd Miniworld
.\scripts\docker-deploy-all.ps1
```

Then open the game client at http://localhost:3000 and the creator dashboard at http://localhost:3001.

## Not done

- No public deployment, testnet or mainnet
- No latency measurements for the WebSocket feed or the API
- No API authentication or rate limiting
- No contract audit

## License

MIT. See the LICENSE file.
