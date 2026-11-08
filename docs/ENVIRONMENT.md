# Environment variables

Docker Compose sets all of these for the containers, so the Docker route needs no `.env` file. The `.env.example` files in `backend/`, `game-client/` and `creator-dashboard/` hold the values for running a service on the host instead. They point at `localhost` rather than the container names, and the `.env` copies are git-ignored.

### Backend (as set in `docker-compose.yml`)

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

### Frontend (game client and creator dashboard)

```env
VITE_API_URL=http://localhost:4000/api
VITE_WS_URL=http://localhost:4000
VITE_CONTRACT_ADDRESS=0x...  # the deploy script exports it from the contract it just deployed
```

The compose file passes these to the Vite dev server when the container starts, so after changing one, restart the container. In a production build Vite bakes them into the JavaScript. The frontend then has to be rebuilt.
