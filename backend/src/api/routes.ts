import { Router, Request, Response } from 'express';
import { GameService } from '../services/GameService.js';
import { StatsService } from '../services/StatsService.js';
import { EventProcessor } from '../services/EventProcessor.js';
import { validateTileId, validateAddress } from './middleware.js';

const router = Router();
const gameService = new GameService();
const statsService = new StatsService();
const eventProcessor = new EventProcessor();

router.get('/world', async (req: Request, res: Response) => {
  const worldState = await gameService.getWorldState();
  
  res.json({
    tiles: worldState.tiles.map(tile => ({
      tileId: tile.tileId,
      owner: tile.owner,
      itemType: tile.itemType,
      lastModified: tile.lastModified.toString(),
      x: tile.x,
      y: tile.y,
    })),
    totalTiles: worldState.tiles.length,
    lastUpdated: worldState.lastUpdated,
  });
});

router.get('/tile/:id', validateTileId, async (req: Request, res: Response) => {
  const tileId = parseInt(req.params.id);
  const tile = await gameService.getTile(tileId);
  
  if (!tile) {
    res.status(404).json({
      error: 'Tile not found',
      tileId,
    });
    return;
  }
  
  res.json({
    tileId: tile.tileId,
    owner: tile.owner,
    itemType: tile.itemType,
    lastModified: tile.lastModified.toString(),
    x: tile.x,
    y: tile.y,
  });
});

router.get('/player/:address', validateAddress, async (req: Request, res: Response) => {
  const address = req.params.address;
  const result = await gameService.getPlayerTiles(address);
  
  res.json({
    playerAddress: address,
    tiles: result.tiles,
    totalTiles: result.total_count,
  });
});

router.get('/player/:address/stats', validateAddress, async (req: Request, res: Response) => {
  const address = req.params.address;
  const stats = await statsService.getPlayerStats(address);
  
  res.json({
    playerAddress: address,
    ...stats,
  });
});

router.get('/activity', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  
  if (limit < 1 || limit > 200) {
    res.status(400).json({
      error: 'Invalid limit',
      message: 'Limit must be between 1 and 200',
    });
    return;
  }
  
  const activity = await gameService.getActivity(limit);
  
  res.json({
    events: activity,
    count: activity.length,
  });
});

router.get('/stats', async (req: Request, res: Response) => {
  const stats = await statsService.getGameStats();
  
  res.json(stats);
});

router.get('/sync-status', async (req: Request, res: Response) => {
  const status = await eventProcessor.getSyncStatus();
  
  res.json({
    lastSyncedBlock: status.lastSyncedBlock,
    lastSyncTime: status.lastSyncTime,
  });
});

router.get('/health', async (req: Request, res: Response) => {
  const { pool } = await import('../config/database.js');
  const { provider } = await import('../config/blockchain.js');
  
  try {
    const [dbTest, blockchainTest] = await Promise.all([
      pool.query('SELECT 1'),
      provider.getBlockNumber(),
    ]);
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      database: 'connected',
      blockchain: {
        connected: true,
        blockNumber: blockchainTest,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;