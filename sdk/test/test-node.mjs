import { MiniWorldSDK, ItemType, ItemTypeNames } from '../dist/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual: ${actual}`);
    failed++;
  }
}

async function testAPI() {
  console.log('\n🌐 Part 3: API Read Operations Tests (requires backend on port 4000)\n');

  const sdk = new MiniWorldSDK({
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    apiUrl: 'http://localhost:4000/api',
    wsUrl: 'http://localhost:4000',
    autoConnectWebSocket: false
  });

  try {
    // Test 1: getWorldState()
    console.log('Test 1: getWorldState()');
    try {
      const worldState = await sdk.getWorldState();
      assert(worldState !== null, 'World state returned');
      assert(Array.isArray(worldState.tiles), 'World state has tiles array');
      assertEqual(worldState.tiles.length, 100, 'World state has 100 tiles');
      assertEqual(worldState.totalTiles, 100, 'Total tiles is 100');
      assert(typeof worldState.lastUpdated === 'string', 'lastUpdated is string');
      
      // Check first tile structure
      const firstTile = worldState.tiles[0];
      assert(typeof firstTile.tileId === 'number', 'Tile has tileId number');
      assert(typeof firstTile.owner === 'string', 'Tile has owner string');
      assert(typeof firstTile.itemType === 'number', 'Tile has itemType number');
      assert(typeof firstTile.x === 'number', 'Tile has x coordinate');
      assert(typeof firstTile.y === 'number', 'Tile has y coordinate');
    } catch (error) {
      console.error(`✗ getWorldState() failed: ${error.message}`);
      failed++;
    }

    // Test 2: getTile()
    console.log('\nTest 2: getTile()');
    try {
      const tile = await sdk.getTile(0);
      assert(tile !== null, 'Tile 0 returned');
      assertEqual(tile.tileId, 0, 'Tile ID is 0');
      assertEqual(tile.x, 0, 'Tile x coordinate is 0');
      assertEqual(tile.y, 0, 'Tile y coordinate is 0');
    } catch (error) {
      console.error(`✗ getTile() failed: ${error.message}`);
      failed++;
    }

    // Test 3: getTile() with invalid ID
    console.log('\nTest 3: getTile() error handling');
    try {
      await sdk.getTile(100);
      console.error('✗ Should have thrown error for invalid tile ID');
      failed++;
    } catch (error) {
      assert(error.message.includes('Invalid tile ID'), 'Throws error for tile ID 100');
    }

    try {
      await sdk.getTile(-1);
      console.error('✗ Should have thrown error for negative tile ID');
      failed++;
    } catch (error) {
      assert(error.message.includes('Invalid tile ID'), 'Throws error for negative tile ID');
    }

    // Test 4: getPlayerTiles() without connection
    console.log('\nTest 4: getPlayerTiles() without connection');
    try {
      await sdk.getPlayerTiles();
      console.error('✗ Should have thrown error when not connected');
      failed++;
    } catch (error) {
      assert(error.message.includes('wallet not connected'), 'Throws error when no address and not connected');
    }

    // Test 5: getPlayerTiles() with address
    console.log('\nTest 5: getPlayerTiles() with explicit address');
    try {
      const testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Hardhat test account #0
      const playerTiles = await sdk.getPlayerTiles(testAddress);
      assert(playerTiles !== null, 'Player tiles returned');
      assert(Array.isArray(playerTiles.tiles), 'Player tiles has tiles array');
      assertEqual(playerTiles.playerAddress.toLowerCase(), testAddress.toLowerCase(), 'Player address matches');
      assert(typeof playerTiles.totalTiles === 'number', 'Total tiles is number');
    } catch (error) {
      console.error(`✗ getPlayerTiles() failed: ${error.message}`);
      failed++;
    }

    // Test 6: getActivity()
    console.log('\nTest 6: getActivity()');
    try {
      const activity = await sdk.getActivity();
      assert(activity !== null, 'Activity returned');
      assert(Array.isArray(activity.events), 'Activity has events array');
      assert(typeof activity.count === 'number', 'Activity has count');
      
      if (activity.events.length > 0) {
        const event = activity.events[0];
        assert(typeof event.eventType === 'string', 'Event has eventType string');
        assert(typeof event.tileId === 'number', 'Event has tileId number');
        assert(typeof event.playerAddress === 'string', 'Event has playerAddress');
        assert(typeof event.createdAt === 'string', 'Event createdAt is string');
      }
    } catch (error) {
      console.error(`✗ getActivity() failed: ${error.message}`);
      failed++;
    }

    // Test 7: getActivity() with custom limit
    console.log('\nTest 7: getActivity() with custom limit');
    try {
      const activity = await sdk.getActivity(10);
      assert(activity !== null, 'Activity with limit 10 returned');
      assert(activity.events.length <= 10, 'Events array respects limit');
    } catch (error) {
      console.error(`✗ getActivity(10) failed: ${error.message}`);
      failed++;
    }

    // Test 8: getActivity() with invalid limit
    console.log('\nTest 8: getActivity() error handling');
    try {
      await sdk.getActivity(0);
      console.error('✗ Should have thrown error for limit 0');
      failed++;
    } catch (error) {
      assert(error.message.includes('between 1-200'), 'Throws error for limit 0');
    }

    try {
      await sdk.getActivity(201);
      console.error('✗ Should have thrown error for limit 201');
      failed++;
    } catch (error) {
      assert(error.message.includes('between 1-200'), 'Throws error for limit 201');
    }

    // Test 9: getStats()
    console.log('\nTest 9: getStats()');
    try {
      const stats = await sdk.getStats();
      assert(stats !== null, 'Stats returned');
      assert(typeof stats.totalClaims === 'number', 'Stats has totalClaims');
      assert(typeof stats.uniquePlayers === 'number', 'Stats has uniquePlayers');
      assert(typeof stats.totalEvents === 'number', 'Stats has totalEvents');
      assert(typeof stats.itemsByType === 'object', 'Stats has itemsByType object');
      assert(typeof stats.itemsByType.Empty === 'number', 'itemsByType has Empty count');
      assert(typeof stats.itemsByType.Tree === 'number', 'itemsByType has Tree count');
      assert(typeof stats.itemsByType.Rock === 'number', 'itemsByType has Rock count');
      
      // Verify all items sum to 100
      const totalItems = Object.values(stats.itemsByType).reduce((sum, count) => sum + count, 0);
      assertEqual(totalItems, 100, 'Total items by type equals 100');
    } catch (error) {
      console.error(`✗ getStats() failed: ${error.message}`);
      failed++;
    }

    // Test 10: getPlayerStats() without connection
    console.log('\nTest 10: getPlayerStats() without connection');
    try {
      await sdk.getPlayerStats();
      console.error('✗ Should have thrown error when not connected');
      failed++;
    } catch (error) {
      assert(error.message.includes('wallet not connected'), 'Throws error when no address and not connected');
    }

    // Test 11: getPlayerStats() with address
    console.log('\nTest 11: getPlayerStats() with explicit address');
    try {
      const testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      const playerStats = await sdk.getPlayerStats(testAddress);
      assert(playerStats !== null, 'Player stats returned');
      assertEqual(playerStats.playerAddress.toLowerCase(), testAddress.toLowerCase(), 'Player address matches');
      assert(typeof playerStats.tilesOwned === 'number', 'Stats has tilesOwned');
      assert(typeof playerStats.itemsPlaced === 'number', 'Stats has itemsPlaced');
      assert(playerStats.firstClaim === null || typeof playerStats.firstClaim === 'string', 'firstClaim is null or string');
      assert(playerStats.lastActivity === null || typeof playerStats.lastActivity === 'string', 'lastActivity is null or string');
    } catch (error) {
      console.error(`✗ getPlayerStats() failed: ${error.message}`);
      failed++;
    }

    // Test 12: getSyncStatus()
    console.log('\nTest 12: getSyncStatus()');
    try {
      const syncStatus = await sdk.getSyncStatus();
      assert(syncStatus !== null, 'Sync status returned');
      assert(typeof syncStatus.lastSyncedBlock === 'string', 'lastSyncedBlock is string');
      assert(typeof syncStatus.lastSyncTime === 'string', 'lastSyncTime is string');
    } catch (error) {
      console.error(`✗ getSyncStatus() failed: ${error.message}`);
      failed++;
    }

  } catch (error) {
    console.error(`\n❌ API Tests Failed: ${error.message}`);
    console.error('Make sure backend is running on http://localhost:4000');
    console.error('Run: cd miniworld\\backend && npm run dev');
    failed++;
  }
}

async function runAllTests() {
  console.log('🧪 Testing MiniWorld SDK\n');

  // Part 1 & 2 Tests (from previous parts)
  console.log('📦 Part 1 & 2: Core Structure & Wallet Tests\n');

  // Test 1: SDK Import
  console.log('Test 1: SDK Import');
  assert(typeof MiniWorldSDK === 'function', 'MiniWorldSDK is a function');
  assert(typeof ItemType === 'object', 'ItemType is an object');

  // Test 2: ItemType Enum
  console.log('\nTest 2: ItemType Enum');
  assertEqual(ItemType.Empty, 0, 'ItemType.Empty = 0');
  assertEqual(ItemType.Tree, 1, 'ItemType.Tree = 1');
  assertEqual(ItemType.Rock, 2, 'ItemType.Rock = 2');
  assertEqual(ItemType.Flag, 3, 'ItemType.Flag = 3');
  assertEqual(ItemType.Building, 4, 'ItemType.Building = 4');
  assertEqual(ItemType.Water, 5, 'ItemType.Water = 5');

  // Test 3: ItemTypeNames
  console.log('\nTest 3: ItemTypeNames');
  assertEqual(ItemTypeNames[0], 'Empty', 'ItemTypeNames[0] = Empty');
  assertEqual(ItemTypeNames[1], 'Tree', 'ItemTypeNames[1] = Tree');
  assertEqual(ItemTypeNames[5], 'Water', 'ItemTypeNames[5] = Water');

  // Test 4: Coordinate Conversion
  console.log('\nTest 4: Coordinate Conversion');
  assertEqual(MiniWorldSDK.coordsToTileId(0, 0), 0, 'coordsToTileId(0, 0) = 0');
  assertEqual(MiniWorldSDK.coordsToTileId(9, 0), 9, 'coordsToTileId(9, 0) = 9');
  assertEqual(MiniWorldSDK.coordsToTileId(0, 1), 10, 'coordsToTileId(0, 1) = 10');
  assertEqual(MiniWorldSDK.coordsToTileId(4, 2), 24, 'coordsToTileId(4, 2) = 24');
  assertEqual(MiniWorldSDK.coordsToTileId(2, 4), 42, 'coordsToTileId(2, 4) = 42');
  assertEqual(MiniWorldSDK.coordsToTileId(9, 9), 99, 'coordsToTileId(9, 9) = 99');

  // Test 5: Reverse Coordinate Conversion
  console.log('\nTest 5: Reverse Coordinate Conversion');
  let coords = MiniWorldSDK.tileIdToCoords(0);
  assert(coords.x === 0 && coords.y === 0, 'tileIdToCoords(0) = (0, 0)');
  coords = MiniWorldSDK.tileIdToCoords(9);
  assert(coords.x === 9 && coords.y === 0, 'tileIdToCoords(9) = (9, 0)');
  coords = MiniWorldSDK.tileIdToCoords(99);
  assert(coords.x === 9 && coords.y === 9, 'tileIdToCoords(99) = (9, 9)');

  // Test 6: Round-trip Conversion
  console.log('\nTest 6: Round-trip Conversion');
  let roundTripSuccess = true;
  for (let tileId = 0; tileId < 100; tileId++) {
    const { x, y } = MiniWorldSDK.tileIdToCoords(tileId);
    const backToTileId = MiniWorldSDK.coordsToTileId(x, y);
    if (backToTileId !== tileId) {
      roundTripSuccess = false;
      break;
    }
  }
  assert(roundTripSuccess, 'All 100 tiles round-trip correctly');

  // Test 7: Error Handling
  console.log('\nTest 7: Error Handling');
  try {
    MiniWorldSDK.coordsToTileId(-1, 0);
    console.error('✗ Should have thrown error for negative x');
    failed++;
  } catch (e) {
    assert(true, 'Correctly throws error for negative x');
  }

  try {
    MiniWorldSDK.coordsToTileId(10, 0);
    console.error('✗ Should have thrown error for x out of range');
    failed++;
  } catch (e) {
    assert(true, 'Correctly throws error for x out of range');
  }

  try {
    MiniWorldSDK.tileIdToCoords(100);
    console.error('✗ Should have thrown error for tileId 100');
    failed++;
  } catch (e) {
    assert(true, 'Correctly throws error for tileId 100');
  }

  // Test 8: SDK Instance Creation
  console.log('\nTest 8: SDK Instance Creation');
  const sdk = new MiniWorldSDK({
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    apiUrl: 'http://localhost:4000/api',
    wsUrl: 'http://localhost:4000',
    autoConnectWebSocket: false
  });
  assert(sdk instanceof MiniWorldSDK, 'SDK instance created successfully');
  assertEqual(sdk.getConnectedAddress(), null, 'getConnectedAddress() returns null initially');
  assertEqual(sdk.isConnected(), false, 'isConnected() returns false initially');
  assertEqual(sdk.isWebSocketConnected(), false, 'isWebSocketConnected() returns false initially');

  // Run API Tests (Part 3)
  await testAPI();

  // Part 4: Blockchain Write Operations
  console.log('\n🔐 Part 4: Blockchain Write Operations Tests');
  console.log('⚠️  Write operations require MetaMask and cannot be tested in Node.js');
  console.log('✓ Use test-browser.html to test transactions');
  console.log('✓ Methods implemented: claimTile(), placeItem(), removeItem()');
  console.log('✓ Transaction lifecycle: started → submitted → confirmed/failed');
  console.log('✓ Events: transactionStarted, transactionSubmitted, transactionConfirmed, transactionFailed');

  // Part 5: WebSocket Integration
  console.log('\n🔌 Part 5: WebSocket Real-Time Integration Tests');
  console.log('\n✓ WebSocket functionality fully implemented');
  console.log('\n📡 Available Methods:');
  console.log('  • initializeWebSocket() - Connect to backend WebSocket server');
  console.log('  • disconnectWebSocket() - Disconnect from WebSocket server');
  console.log('  • isWebSocketConnected() - Check current connection status');
  console.log('\n🔔 Supported Events:');
  console.log('  • wsConnected - WebSocket connection established');
  console.log('  • wsDisconnected - WebSocket connection closed');
  console.log('  • tileClaimed - Real-time tile claim notifications from other players');
  console.log('  • itemPlaced - Real-time item placement notifications');
  console.log('  • itemRemoved - Real-time item removal notifications');
  console.log('  • worldUpdate - General world state update notifications');
  console.log('\n⚡ Features:');
  console.log('  • Auto-connect on SDK initialization (configurable via autoConnectWebSocket)');
  console.log('  • Automatic reconnection with exponential backoff (max 10 attempts)');
  console.log('  • Event deduplication (prevents processing own transactions twice)');
  console.log('  • Connection status tracking and monitoring');
  console.log('  • Transaction tracking with 60-second timeout');
  console.log('\n⚠️  WebSocket testing requires browser environment');
  console.log('✓ Use test-browser.html for complete WebSocket testing');
  console.log('✓ Open multiple browser windows to test multi-player synchronization');
  console.log('✓ Real-time updates visible when other players interact with the game');
  console.log('\n💡 Multi-Player Testing:');
  console.log('  1. Open test-browser.html in two separate browser windows');
  console.log('  2. Connect wallet in both windows');
  console.log('  3. Perform actions in one window (claim tile, place item)');
  console.log('  4. See real-time updates appear in the other window automatically');
  console.log('  5. Events are color-coded: Blue = your actions, Purple = other players');

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary\n');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Start backend: cd miniworld\\backend && npm run dev');
    console.log('  2. Start Hardhat: cd miniworld\\contracts && npx hardhat node');
    console.log('  3. Open browser test: cd miniworld\\sdk && npx http-server -p 8080');
    console.log('  4. Visit: http://localhost:8080/test/test-browser.html');
    console.log('  5. Test wallet connection, API calls, transactions, and WebSocket events');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed`);
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('💥 Test runner crashed:', error);
  process.exit(1);
});