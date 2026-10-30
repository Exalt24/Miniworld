---
type: reference
updated: 2026-10-30
---

*How the GIF at the top of the README was recorded.*

## Demo recording

The GIF at the top is the real app on a local Hardhat chain, recorded with Playwright in headless Chromium. Two parts of it are scripted, and they are the only things that are not the stock setup:

- **The wallet.** `scripts/demo/wallet-stub.js` is a minimal `window.ethereum` stand-in, not MetaMask. It reports Hardhat dev account #0 and forwards every JSON-RPC call to the local node, which signs with that unlocked account. The game client's own Connect Wallet, Claim Tile and Place Item buttons are what get clicked.
- **The second player.** The green tiles are Hardhat dev account #1, sending `claimTile` and `placeItem` transactions straight to the node from the script. The board colours them by itself when the WebSocket event arrives.

I brought the stack up by running the deploy script's steps by hand (start PostgreSQL and the Hardhat node, deploy with Ignition, export `CONTRACT_ADDRESS` and `VITE_CONTRACT_ADDRESS`, build, start), with the host ports remapped because other containers on that machine held 3000 and 4000. Then `node scripts/demo/record-demo.cjs` drove it. The script needs the stack on a fresh chain, `npm install playwright` somewhere Node can resolve it, and `cd sdk && npm install` for ethers; its ports and output folder are set with `MW_GAME_URL`, `MW_DASH_URL`, `MW_RPC_URL` and `MW_OUT`.

