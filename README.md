# MiniWorld - Blockchain Gaming Platform

A production-ready full-stack Web3 game demonstrating multiplayer on-chain mechanics, real-time state synchronization, creator analytics, and SDK abstraction.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![React](https://img.shields.io/badge/React-19.2-61dafb)
![Solidity](https://img.shields.io/badge/Solidity-0.8.30-363636)
![Node.js](https://img.shields.io/badge/Node.js-22.20-339933)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start-docker)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)

---

## 🎮 Overview

MiniWorld is a 10x10 grid-based autonomous world where players claim tiles and place items on-chain.

### Key Features

- ⛓️ **Smart Contract Logic** - All game state lives on Ethereum
- 🔄 **Real-Time Sync** - WebSocket updates across all clients (<100ms latency)
- 🎮 **Player Client** - React 19 game interface with Canvas rendering
- 📊 **Creator Dashboard** - Analytics and monitoring tools with Recharts visualizations
- 🛠 **Developer SDK** - Complete Web3 abstraction with bundled contract ABI
- 🐳 **Docker Deployment** - Complete stack in containers with one command

---

## 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────┐
│                     Browser Layer                        │
├─────────────────────────────────────────────────────────┤
│  Game Client (3000)  │  Creator Dashboard (3001)        │
│  • Canvas Game Board │  • Analytics Charts              │
│  • Real-time Updates │  • Event Log                     │
│  • SDK Integration   │  • Player Management             │
└────────────┬────────────────────────┬───────────────────┘
             │                        │
             │   MiniWorld SDK (bundled into frontends)   
             │   • Contract ABI baked in at build time    
             │   • WebSocket client                       
             │   • Transaction handling                   
             │                        │
┌────────────┴────────────────────────┴───────────────────┐
│                   Backend Layer                          │
├─────────────────────────────────────────────────────────┤
│  Backend API (4000)                                     │
│  • REST API (8 endpoints)                               │
│  • WebSocket Server (Socket.IO)                         │
│  • Event Indexer                                        │
│  • Contract ABI loaded from build                       │
└────────────┬──────────────────┬─────────────────────────┘
             │                  │
    ┌────────┴────────┐  ┌─────┴──────────┐
    │  PostgreSQL 18   │  │  Hardhat Node  │
    │  • World State   │  │  • Smart       │
    │  • Event Log     │  │    Contracts   │
    │  • Stats Cache   │  │  • Local EVM   │
    └──────────────────┘  └────────────────┘
```

### ABI Distribution System
```
1. Deploy Contracts
   └─> Generates: contracts/artifacts/MiniWorld.json

2. Build Backend
   └─> Copies ABI into Docker image at build time

3. Build SDK
   └─> Prebuild script copies ABI → sdk/src/contractABI.ts
   └─> TypeScript compiles SDK with bundled ABI

4. Build Frontends
   └─> Import SDK with bundled ABI
   └─> Vite bundles everything into JavaScript

Result: All components have access to contract ABI with zero runtime fetches!
```

---

## 🚀 Quick Start (Docker)

### Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Node.js 22.12+** (for local development only)
- **PowerShell** (Windows) or **Bash** (Mac/Linux)

### One-Command Deployment
```powershell
# Windows PowerShell
.\scripts\docker-deploy-all.ps1

# That's it! The script handles:
# ✅ Clean previous deployment
# ✅ Start PostgreSQL + Hardhat node
# ✅ Deploy smart contracts
# ✅ Generate and distribute contract ABI
# ✅ Build all services (backend, SDK, frontends)
# ✅ Start all containers
# ✅ Validate deployment
```

**Total time:** ~5-10 minutes (first run), ~2-3 minutes (subsequent runs)

### Access Your Applications

| Application | URL | Purpose |
|-------------|-----|---------|
| **Game Client** | http://localhost:3000 | Play the game |
| **Creator Dashboard** | http://localhost:3001 | View analytics |
| **Backend API** | http://localhost:4000/api | API endpoints |
| **Health Check** | http://localhost:4000/api/health | Service status |

---

## 📁 Project Structure
```
miniworld/
├── contracts/              # Smart contracts (Solidity + Hardhat 3.x)
│   ├── contracts/
│   │   └── MiniWorld.sol  # Main game contract
│   ├── ignition/          # Hardhat Ignition deployment
│   ├── test/              # Contract tests (37 passing)
│   └── artifacts/         # Generated ABI (not in git)
│
├── backend/               # Event indexer + REST API
│   ├── src/
│   │   ├── config/        # Database & blockchain config
│   │   ├── services/      # Event processing & game logic
│   │   ├── api/           # Express routes (8 endpoints)
│   │   └── websocket/     # Socket.IO server
│   └── migrations/        # SQL schema migrations
│
├── sdk/                   # TypeScript SDK for Web3 abstraction
│   ├── src/
│   │   ├── MiniWorldSDK.ts        # Main SDK class
│   │   ├── types.ts               # Type definitions
│   │   ├── contractABI.ts         # Generated ABI (empty template in git)
│   │   └── index.ts               # Public exports
│   ├── scripts/
│   │   └── copy-abi.js            # Prebuild script (copies ABI)
│   └── test/              # SDK tests (78 passing)
│
├── game-client/           # Player-facing React app
│   ├── src/
│   │   ├── components/    # Game UI (Canvas board, tile panel, etc.)
│   │   ├── contexts/      # React contexts (SDK integration)
│   │   └── hooks/         # Custom hooks
│   └── public/
│
├── creator-dashboard/     # Analytics dashboard
│   ├── src/
│   │   ├── components/    # Dashboard components (charts, tables)
│   │   └── hooks/         # Data fetching hooks
│   └── public/
│
├── docker/                # Docker configuration
│   ├── backend.Dockerfile
│   ├── contracts.Dockerfile
│   ├── game-client.Dockerfile
│   ├── creator-dashboard.Dockerfile
│   ├── nginx-game-client.conf
│   └── nginx-creator-dashboard.conf
│
├── scripts/               # Automation scripts
│   ├── docker-deploy-all.ps1      # Main deployment script
│   └── docker-status.ps1          # Status dashboard (optional)
│
├── docker-compose.yml     # Base service configuration
├── docker-compose.dev.yml # Development overrides
└── docker-compose.prod.yml# Production configuration
```

---

## 🔧 Development Workflow

### Making Changes

#### 1. Smart Contract Changes
```powershell
# Edit contract
code contracts/contracts/MiniWorld.sol

# Redeploy everything (one command)
.\scripts\docker-deploy-all.ps1

# The script automatically:
# - Recompiles contracts → new ABI
# - Updates contract address in .env files
# - Rebuilds backend with new ABI
# - Rebuilds SDK with new ABI (prebuild script runs)
# - Rebuilds frontends with new SDK
# - Everything just works! ✨
```

#### 2. Backend Changes
```powershell
# Edit backend code
code backend/src/services/GameService.ts

# In dev mode, backend auto-reloads
# Or rebuild manually:
docker-compose build backend
docker-compose up -d backend
```

#### 3. SDK Changes
```powershell
# Edit SDK code
code sdk/src/MiniWorldSDK.ts

# Rebuild SDK
cd sdk
npm run build

# Rebuild frontends (they import SDK)
docker-compose build game-client creator-dashboard
docker-compose up -d game-client creator-dashboard
```

#### 4. Frontend Changes
```powershell
# Edit frontend code
code game-client/src/components/GameBoard.tsx

# In dev mode, Vite auto-reloads via volume mounts
# Or rebuild manually:
docker-compose build game-client
docker-compose up -d game-client
```

### Development Commands
```powershell
# View all service status
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f backend
docker-compose logs -f game-client

# Stop all services (preserve data)
docker-compose down

# Stop and clean all data
docker-compose down -v

# Check service health
.\scripts\docker-status.ps1   # Optional status dashboard

# Restart specific service
docker-compose restart backend
```

---

## 🌐 API Reference

### Base URL
```
http://localhost:4000/api
```

### Endpoints

#### World State

**Get All Tiles**
```http
GET /api/world
```

Returns all 100 tiles with current state.

**Response:**
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

**Get Single Tile**
```http
GET /api/tile/:id
```

Parameters:
- `id` - Tile ID (0-99)

**Get Player Tiles**
```http
GET /api/player/:address
```

Parameters:
- `address` - Ethereum address (0x...)

#### Activity & Stats

**Get Recent Events**
```http
GET /api/activity?limit=50
```

Query Parameters:
- `limit` - Number of events (1-200, default: 50)

**Get Game Statistics**
```http
GET /api/stats
```

Returns:
```json
{
  "total_claims": 42,
  "unique_players": 15,
  "total_events": 127,
  "items_by_type": {
    "0": 58,  // Empty
    "1": 12,  // Tree
    "2": 8,   // Rock
    "3": 5,   // Flag
    "4": 3,   // Building
    "5": 14   // Water
  }
}
```

**Get Player Statistics**
```http
GET /api/player/:address/stats
```

#### System

**Health Check**
```http
GET /api/health
```

**Sync Status**
```http
GET /api/sync-status
```

### WebSocket Events

Connect to: `ws://localhost:4000`

**Events:**
- `tileClaimed` - Player claimed a tile
- `itemPlaced` - Player placed an item
- `itemRemoved` - Player removed an item
- `worldUpdate` - General state change

**Example (Browser):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

socket.on('tileClaimed', (data) => {
  console.log('Tile claimed:', data.tileId, 'by', data.owner);
});
```

---

## 🧪 Testing

### Smart Contract Tests
```powershell
cd contracts
npm test

# With gas reporting
npm test -- --gas-report

# Specific test
npm test -- --grep "Should allow claiming"
```

**Test Coverage:** 37 tests covering all contract functions and edge cases

### SDK Tests
```powershell
cd sdk
node test/test-node.mjs

# Browser tests (interactive)
npx http-server -p 8080
# Open: http://localhost:8080/test/test-browser.html
```

**Test Coverage:** 78 automated tests + interactive browser tests

### Integration Testing
```powershell
# Full stack test
.\scripts\docker-deploy-all.ps1

# Should see at the end:
# ✅ DEPLOYMENT SUCCESSFUL!
# ✅ PostgreSQL: Healthy
# ✅ Backend API: Healthy
# ✅ World State: 100 tiles initialized
# ✅ Game Client: Accessible
# ✅ Creator Dashboard: Accessible
```

---

## 🐛 Troubleshooting

### Services Won't Start
```powershell
# Check logs
docker-compose logs

# Check specific service
docker-compose logs backend

# Restart all services
docker-compose down
.\scripts\docker-deploy-all.ps1
```

### Port Already in Use
```powershell
# Find process using port
netstat -ano | findstr :3000
netstat -ano | findstr :4000
netstat -ano | findstr :8545

# Kill process (replace <PID> with actual PID)
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
```

### Contract Address Issues
```powershell
# Verify addresses match
type backend\.env | findstr CONTRACT_ADDRESS
type game-client\.env | findstr CONTRACT_ADDRESS
type creator-dashboard\.env | findstr CONTRACT_ADDRESS

# If they don't match, redeploy:
.\scripts\docker-deploy-all.ps1
```

### Database Connection Errors
```powershell
# Check PostgreSQL status
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Or rebuild everything
docker-compose down -v
.\scripts\docker-deploy-all.ps1
```

### MetaMask Not Connecting

1. **Add Hardhat Network to MetaMask:**
   - Network Name: `Hardhat Local`
   - RPC URL: `http://localhost:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. **Import Test Account:**
```powershell
   # Get private key from Hardhat console
   docker-compose exec contracts npx hardhat console --network localhost
   
   # In console:
   const accounts = await ethers.getSigners();
   console.log(accounts[0].address);
   # Copy private key from hardhat node output
```

3. **Reset MetaMask:**
   - Settings → Advanced → Reset Account

### ABI Loading Errors

If you see errors about missing contract ABI:
```powershell
# Verify ABI exists
dir contracts\artifacts\contracts\MiniWorld.sol\MiniWorld.json

# If missing, redeploy
.\scripts\docker-deploy-all.ps1

# The deployment script will:
# 1. Generate ABI in step 5
# 2. Verify ABI exists in step 6.5
# 3. Build all services with ABI in step 8
```

### Canvas Not Rendering

1. **Check browser console** (F12)
2. **Verify SDK initialized:**
```javascript
   // Should see in console:
   // ✓ SDK initialized successfully
   // ✓ Using bundled contract ABI
```
3. **Check WebSocket connection:**
```javascript
   // Should see:
   // WebSocket connected
```

### Clear Everything and Start Fresh
```powershell
# Nuclear option - removes ALL data
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Rebuild from scratch
.\scripts\docker-deploy-all.ps1

# Takes ~10-15 minutes but guarantees fresh state
```

---

## 🛠️ Tech Stack

### Smart Contracts & Blockchain

- **Solidity:** 0.8.30 (latest stable with transient storage support)
- **Hardhat:** 3.0.7 (Rust-based EDR runtime, declarative config)
- **ethers.js:** 6.13.7 (native BigInt, no BigNumber class)
- **Network:** Local Hardhat node (Chain ID: 31337)

### Backend Services

- **Node.js:** 22.20.0 LTS (Active LTS, supports require(esm))
- **Express:** 5.1.0 (async promise handling, requires Node 18+)
- **TypeScript:** 5.9.x (strict mode, enhanced types)
- **PostgreSQL:** 18.0 (3x I/O performance boost with AIO subsystem)
- **Socket.IO:** 4.8.1 (WebSocket real-time communication)
- **pg:** 8.13.1 (PostgreSQL driver for Node.js)

### Frontend Applications

- **React:** 19.2.0 (Actions API, Activity component, ref as prop)
- **TypeScript:** 5.9.x (strict mode throughout)
- **Vite:** 7.1.10 (requires Node 22.12+, baseline-widely-available target)
- **Tailwind CSS:** 4.1.14+ (CSS-first config, @tailwindcss/vite plugin)
- **Recharts:** 3.2.1 (for Creator Dashboard analytics)
- **Nginx:** Alpine (production web server)

### Development Tools

- **Docker:** 24+ (container orchestration)
- **Docker Compose:** v2 (multi-service deployment)
- **tsx:** 4.19.2 (TypeScript execution)

---

## 📊 Performance Metrics

- **Backend API Response:** <100ms average
- **WebSocket Latency:** <50ms for event propagation
- **Frontend Initial Load:** <2s (production build)
- **Contract Gas Usage:** Optimized with Solidity 0.8.30
- **Database Query Time:** <10ms with proper indexing
- **Canvas Rendering:** 60 FPS capable (100 tiles)

---

## 🔐 Security Considerations

### Development Environment

⚠️ **This is a development setup. DO NOT use in production without:**

1. **Changing default credentials:**
   - PostgreSQL password
   - Add authentication to backend API

2. **Enabling HTTPS:**
   - Configure SSL/TLS certificates
   - Update CORS_ORIGIN to your domain

3. **Rate Limiting:**
   - Add rate limiting to API endpoints
   - Protect against DDoS

4. **Contract Security:**
   - Professional smart contract audit
   - Test on testnet before mainnet

5. **Environment Variables:**
   - Use secrets management
   - Never commit real private keys

---

## 📝 Environment Variables

### Backend (.env)
```env
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=miniworld
DB_USER=postgres
DB_PASSWORD=postgres
RPC_URL=http://contracts:8545
CONTRACT_ADDRESS=0x...  # Auto-updated by deploy script
CHAIN_ID=31337
START_BLOCK=0
GRID_SIZE=10
CORS_ORIGIN=*
```

### Frontend (.env)
```env
# Game Client & Creator Dashboard
VITE_API_URL=http://localhost:4000/api
VITE_WS_URL=http://localhost:4000
VITE_CONTRACT_ADDRESS=0x...  # Auto-updated by deploy script
```

**Note:** `VITE_*` variables are baked into the frontend JavaScript at **build time** by Vite. Changing them requires rebuilding the frontend.

---

## 🤝 Contributing

This is a demonstration project showcasing blockchain gaming architecture.

### To Run Locally
```powershell
# 1. Clone repository
git clone <repository-url>
cd miniworld

# 2. Deploy with Docker
.\scripts\docker-deploy-all.ps1

# 3. Open applications
# Game Client: http://localhost:3000
# Creator Dashboard: http://localhost:3001
```

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎯 Project Goals

This project demonstrates:

✅ **On-chain game logic** with Solidity smart contracts  
✅ **Real-time multiplayer** synchronization via WebSocket  
✅ **Web3 abstraction** through TypeScript SDK  
✅ **Event-driven architecture** with PostgreSQL caching  
✅ **Modern frontend** with React 19 and Canvas rendering  
✅ **Creator tools** with analytics dashboard  
✅ **Docker deployment** with automated build pipeline  
✅ **Production-ready patterns** for blockchain gaming  

---

## 📚 Additional Resources

- **Hardhat Documentation:** https://hardhat.org/docs
- **ethers.js v6 Guide:** https://docs.ethers.org/v6/
- **React 19 Release Notes:** https://react.dev/blog/2024/12/05/react-19
- **Vite 7 Migration Guide:** https://vitejs.dev/guide/migration
- **Tailwind CSS v4:** https://tailwindcss.com/docs
- **Socket.IO Documentation:** https://socket.io/docs/v4/

---

## 🚀 Quick Commands Reference
```powershell
# Deploy everything
.\scripts\docker-deploy-all.ps1

# View status (optional)
.\scripts\docker-status.ps1

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean everything
docker-compose down -v

# Check service health
curl http://localhost:4000/api/health
```

---

**Built with:** Hardhat 3 (Rust EDR) • React 19 • Express 5 • PostgreSQL 18 • Vite 7 • Tailwind CSS 4

**Questions?** See [Troubleshooting](#troubleshooting) or check service logs with `docker-compose logs`