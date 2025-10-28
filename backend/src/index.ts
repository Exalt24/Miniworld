import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { waitForConnection } from './config/blockchain.js';
import { pool, closePool } from './config/database.js';
import { EventListener } from './services/EventListener.js';
import { EventProcessor } from './services/EventProcessor.js';
import { WebSocketServer } from './websocket/server.js';
import apiRoutes from './api/routes.js';
import { errorHandler, notFoundHandler, requestLogger } from './api/middleware.js';
import { runMigrations } from '../migrations/run.js';

const PORT = parseInt(process.env.PORT || '4000');
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const START_BLOCK = parseInt(process.env.START_BLOCK || '0');
const GRID_SIZE = parseInt(process.env.GRID_SIZE || '10');

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json());
app.use(requestLogger);

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'MiniWorld Backend',
    version: '1.0.0',
    endpoints: {
      api: '/api',
      health: '/api/health',
      world: '/api/world',
      tile: '/api/tile/:id',
      player: '/api/player/:address',
      activity: '/api/activity',
      stats: '/api/stats',
      syncStatus: '/api/sync-status',
    },
    websocket: true,
    gridSize: GRID_SIZE,
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

let eventListener: EventListener | null = null;
let wsServer: WebSocketServer | null = null;

async function startServer() {
  try {
    console.log('═══════════════════════════════════════════');
    console.log('🎮 Starting MiniWorld Backend Server');
    console.log('═══════════════════════════════════════════');

    console.log('\n[1/6] Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✓ Database connected');

    console.log('\n[2/6] Running database migrations...');
    try {
      await runMigrations();
      console.log('✓ Migrations completed');
    } catch (error: any) {
      console.log('⚠️  Migration warning:', error.message);
      // Continue - migrations are idempotent
    }

    console.log('\n[3/6] Connecting to blockchain...');
    await waitForConnection();

    console.log('\n[4/6] Initializing WebSocket server...');
    wsServer = new WebSocketServer(httpServer);
    console.log('✓ WebSocket server initialized');

    if (CONTRACT_ADDRESS) {
      console.log('\n[5/6] Starting event listener...');
      const eventProcessor = new EventProcessor();
      if (wsServer) {
        eventProcessor.setWebSocketServer(wsServer);
      }
      
      eventListener = new EventListener(CONTRACT_ADDRESS, eventProcessor);
      
      const syncStatus = await eventProcessor.getSyncStatus();
      const startFromBlock = Math.max(START_BLOCK, syncStatus.lastSyncedBlock);
      
      await eventListener.start(startFromBlock);
      console.log(`✓ Event listener started from block ${startFromBlock}`);
    } else {
      console.log('\n[5/6] ⚠️  CONTRACT_ADDRESS not set, skipping event listener');
      console.log('    Set CONTRACT_ADDRESS in .env to enable blockchain integration');
    }

    console.log('\n[6/6] Starting HTTP server...');
    httpServer.listen(PORT, () => {
      console.log('✓ HTTP server started');
      console.log('\n═══════════════════════════════════════════');
      console.log('✅ MiniWorld Backend Ready!');
      console.log('═══════════════════════════════════════════');
      console.log(`📡 API Server:      http://localhost:${PORT}`);
      console.log(`🔌 WebSocket:       ws://localhost:${PORT}`);
      console.log(`❤️  Health Check:   http://localhost:${PORT}/api/health`);
      console.log(`🌍 World State:     http://localhost:${PORT}/api/world`);
      console.log(`📊 Statistics:      http://localhost:${PORT}/api/stats`);
      console.log(`📝 Activity Feed:   http://localhost:${PORT}/api/activity`);
      if (CONTRACT_ADDRESS) {
        console.log(`⛓️  Contract:        ${CONTRACT_ADDRESS}`);
        console.log(`🎧 Listening for:   TileClaimed, ItemPlaced, ItemRemoved`);
      }
      console.log('═══════════════════════════════════════════\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string) {
  console.log(`\n\n⚠️  Received ${signal}, shutting down gracefully...`);
  
  if (eventListener) {
    console.log('Stopping event listener...');
    await eventListener.stop();
  }

  if (httpServer) {
    console.log('Closing HTTP server...');
    httpServer.close(() => {
      console.log('✓ HTTP server closed');
    });
  }

  console.log('Closing database connections...');
  await closePool();
  console.log('✓ Database connections closed');

  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();