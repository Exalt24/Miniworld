# Project structure

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
│   │   ├── types/          # Shared TypeScript types for the services
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
│   └── demo/               # wallet-stub.js and record-demo.cjs (how docs/demo.gif was recorded)
├── docs/                   # API, architecture and deployment notes, plus demo.gif
├── docker-compose.yml      # Base service configuration (dev overrides baked in)
└── docker-compose.prod.yml # Production-style configuration (see docs/DEPLOYMENT.md)
```
