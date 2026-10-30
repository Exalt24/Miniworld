---
type: reference
updated: 2026-10-30
---

*Moved out of the README to keep it short: the development workflow, the API summary and troubleshooting.*

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

