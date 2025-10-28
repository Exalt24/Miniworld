import { query } from '../config/database.js';
import { WorldStateTile, TileQueryResult, PlayerTilesResult } from '../types/database.js';
import { Tile, WorldState, ActivityItem, ItemTypeNames, ItemType } from '../types/game.js';

export class GameService {
  async getWorldState(): Promise<WorldState> {
    const sql = 'SELECT * FROM world_state ORDER BY tile_id';
    const result = await query(sql);
    
    const tiles: Tile[] = result.rows.map((row: WorldStateTile) => ({
      tileId: row.tile_id,
      owner: row.owner,
      itemType: row.item_type as ItemType,
      lastModified: BigInt(row.last_modified),
      x: row.x,
      y: row.y,
    }));

    return {
      tiles,
      lastUpdated: new Date(),
    };
  }

  async getTile(tileId: number): Promise<Tile | null> {
    if (tileId < 0 || tileId >= 100) {
      return null;
    }

    const sql = 'SELECT * FROM world_state WHERE tile_id = $1';
    const result = await query(sql, [tileId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row: WorldStateTile = result.rows[0];
    return {
      tileId: row.tile_id,
      owner: row.owner,
      itemType: row.item_type as ItemType,
      lastModified: BigInt(row.last_modified),
      x: row.x,
      y: row.y,
    };
  }

  async getPlayerTiles(playerAddress: string): Promise<PlayerTilesResult> {
    const sql = `
      SELECT tile_id, owner, item_type, last_modified, x, y 
      FROM world_state 
      WHERE LOWER(owner) = LOWER($1)
      ORDER BY tile_id
    `;
    const result = await query(sql, [playerAddress]);
    
    const tiles: TileQueryResult[] = result.rows.map((row: any) => ({
      tile_id: row.tile_id,
      owner: row.owner,
      item_type: row.item_type,
      last_modified: row.last_modified,
      x: row.x,
      y: row.y,
    }));

    return {
      tiles,
      total_count: tiles.length,
    };
  }

  async getActivity(limit: number = 50): Promise<ActivityItem[]> {
    const sql = `
      SELECT * FROM events 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    const result = await query(sql, [limit]);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      tileId: row.tile_id,
      playerAddress: row.player_address,
      itemType: row.item_type,
      itemTypeName: row.item_type !== null ? ItemTypeNames[row.item_type] : null,
      timestamp: row.timestamp,
      transactionHash: row.transaction_hash,
      createdAt: row.created_at,
    }));
  }

  async getTilesByItemType(itemType: ItemType): Promise<Tile[]> {
    const sql = `
      SELECT * FROM world_state 
      WHERE item_type = $1 
      ORDER BY tile_id
    `;
    const result = await query(sql, [itemType]);
    
    return result.rows.map((row: WorldStateTile) => ({
      tileId: row.tile_id,
      owner: row.owner,
      itemType: row.item_type as ItemType,
      lastModified: BigInt(row.last_modified),
      x: row.x,
      y: row.y,
    }));
  }
}