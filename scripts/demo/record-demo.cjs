// Recording aid for docs/demo.gif. Drives the local stack in a real Chromium and records it to a .webm.
//
//   - Wallet: scripts/demo/wallet-stub.js stands in for a browser wallet. It is NOT MetaMask; it signs through
//     the Hardhat node's unlocked dev accounts, so it only works against the local dev chain.
//   - Second player: Hardhat dev account #1 sends plain JSON-RPC transactions from this script (no browser).
//
// Prerequisites: the stack is up (see the README quick start), `npm install playwright` somewhere resolvable
// (NODE_PATH works), and `cd sdk && npm install` so ethers is available. Run from the repo root on a FRESH chain
// (the final checks expect exactly 3 claimed tiles and 6 events):
//
//   node scripts/demo/record-demo.cjs
//
// Ports and output are overridable: MW_GAME_URL, MW_DASH_URL, MW_RPC_URL, MW_CONTRACT, MW_OUT.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { Interface } = require('../../sdk/node_modules/ethers');

const GAME = process.env.MW_GAME_URL || 'http://localhost:3000';
const DASH = process.env.MW_DASH_URL || 'http://localhost:3001';
const RPC = process.env.MW_RPC_URL || 'http://localhost:8545';
const CONTRACT = process.env.MW_CONTRACT || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const OUT = process.env.MW_OUT || path.join(os.tmpdir(), 'miniworld-demo');
// Hardhat's public dev accounts #0 and #1 (addresses only; the node holds the keys and signs for them)
const ACC0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ACC1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const abi = JSON.parse(fs.readFileSync(path.join(__dirname, '../../contracts/artifacts/contracts/MiniWorld.sol/MiniWorld.json'), 'utf8')).abi;
const iface = new Interface(abi);

let rid = 1;
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params }) });
  return r.json();
}
async function sendFrom(from, fn, args) {
  const res = await rpc('eth_sendTransaction', [{ from, to: CONTRACT, data: iface.encodeFunctionData(fn, args) }]);
  if (res.error) throw new Error(fn + ': ' + res.error.message);
  return res.result;
}

// Poll in short steps and print the outcome; the page is read, never assumed.
async function poll(page, label, fn, maxMs = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    let ok = false;
    try { ok = await fn(); } catch (e) { ok = false; }
    if (ok) { console.log(`ok: ${label} after ${Date.now() - t0} ms`); return true; }
    await page.waitForTimeout(250);
  }
  console.log(`TIMEOUT: ${label} after ${maxMs} ms`);
  return false;
}
async function body(page) { return (await page.locator('body').innerText()).replace(/\s+/g, ' '); }
// colour at the top-left of a tile on the board canvas, as "r,g,b"
async function tileColor(page, tileId) {
  return page.evaluate((id) => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData((id % 10) * 50 + 8, Math.floor(id / 10) * 50 + 8, 1, 1).data;
    return `${d[0]},${d[1]},${d[2]}`;
  }, tileId);
}
const GREEN = '34,197,94', BLUE = '59,130,246';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 810 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  await page.exposeFunction('__rpc', (m, p) => rpc(m, p));
  await page.addInitScript(`window.__MW_ACCOUNT = '${ACC0}';`);
  await page.addInitScript({ content: fs.readFileSync(path.join(__dirname, 'wallet-stub.js'), 'utf8') });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)); });

  // 1. the board, nobody connected yet
  await page.goto(GAME, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await poll(page, 'board drawn', async () => (await page.locator('canvas').count()) > 0 && !/Loading world state/.test(await body(page)));
  await page.waitForTimeout(1200);

  // 2. connect the scripted wallet
  await page.getByRole('button', { name: /Connect Wallet/ }).first().click();
  await poll(page, 'wallet connected', async () => /Connected 0xf39F\.\.\.2266/.test(await body(page)));
  await page.waitForTimeout(900);

  // 3. select tile #44
  await page.locator('canvas').click({ position: { x: 4 * 50 + 25, y: 4 * 50 + 25 } });
  await poll(page, 'tile #44 selected', async () => /Selected Tile #44/.test(await body(page)));
  await page.waitForTimeout(1000);

  // 4. claim it: a real transaction on the local chain
  await page.getByRole('button', { name: /Claim Tile/ }).click();
  await poll(page, 'tile #44 owned by You', async () => /Owner You/.test(await body(page)) && (await tileColor(page, 44)) === BLUE, 8000);
  await page.waitForTimeout(1000);

  // 5. place a Building on it
  await page.locator('select').selectOption({ label: '\u{1F3E2} Building' });
  await page.getByRole('button', { name: /Place Item/ }).click();
  await poll(page, 'building placed', async () => /Current Item Building/.test(await body(page)), 8000);
  await page.waitForTimeout(1000);

  // 6. a second player acts from outside the browser; the board updates by itself over the WebSocket feed
  await sendFrom(ACC1, 'claimTile', [45]);
  await poll(page, 'tile 45 turns green', async () => (await tileColor(page, 45)) === GREEN, 8000);
  await page.waitForTimeout(700);
  await sendFrom(ACC1, 'placeItem', [45, 1]);
  await sendFrom(ACC1, 'claimTile', [55]);
  await poll(page, 'tile 55 turns green', async () => (await tileColor(page, 55)) === GREEN, 8000);
  await sendFrom(ACC1, 'placeItem', [55, 5]);
  await page.waitForTimeout(1200);

  // 7. the activity feed
  await page.getByText('Activity Feed').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);

  // 8. creator dashboard
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await poll(page, 'dashboard: 3 claims, 2 players, 6 events', async () => /Total Claims\D*3\D*Unique Players\D*2\D*Total Events\D*6/.test(await body(page)), 8000);
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /World Overview/ }).click();
  await poll(page, 'minimap', async () => /Claimed \(3\)/.test(await body(page)));
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /Event Log/ }).click();
  await poll(page, 'event log', async () => /6 events/.test(await body(page)));
  await page.waitForTimeout(2200);

  const video = await page.video().path();
  await ctx.close();
  await browser.close();
  console.log('video:', video);
})();
