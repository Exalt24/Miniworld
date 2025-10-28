import { query } from '../config/database.js';
import { GameStats } from '../types/database.js';

export class StatsService {
  async getGameStats(): Promise<GameStats> {
    const [claimsResult, playersResult, eventsResult, itemsResult] = await Promise.all([
      this.getTotalClaims(),
      this.getUniquePlayers(),
      this.getTotalEvents(),
      this.getItemsByType(),
    ]);

    return {
      total_claims: claimsResult,
      unique_players: playersResult,
      total_events: eventsResult,
      items_by_type: itemsResult,
    };
  }

  private async getTotalClaims(): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count 
      FROM world_state 
      WHERE owner != '0x0000000000000000000000000000000000000000'
    `;
    const result = await query(sql);
    return parseInt(result.rows[0].count);
  }

  private async getUniquePlayers(): Promise<number> {
    const sql = `
      SELECT COUNT(DISTINCT owner) as count 
      FROM world_state 
      WHERE owner != '0x0000000000000000000000000000000000000000'
    `;
    const result = await query(sql);
    return parseInt(result.rows[0].count);
  }

  private async getTotalEvents(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM events';
    const result = await query(sql);
    return parseInt(result.rows[0].count);
  }

  private async getItemsByType(): Promise<{ [key: number]: number }> {
    const sql = `
      SELECT item_type, COUNT(*) as count 
      FROM world_state 
      GROUP BY item_type 
      ORDER BY item_type
    `;
    const result = await query(sql);
    
    const itemsByType: { [key: number]: number } = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const row of result.rows) {
      itemsByType[row.item_type] = parseInt(row.count);
    }

    return itemsByType;
  }

  async getPlayerStats(playerAddress: string): Promise<{
    tilesOwned: number;
    itemsPlaced: number;
    firstClaim: Date | null;
    lastActivity: Date | null;
  }> {
    const [tilesResult, itemsResult, activityResult] = await Promise.all([
      query(
        'SELECT COUNT(*) as count FROM world_state WHERE LOWER(owner) = LOWER($1)',
        [playerAddress]
      ),
      query(
        'SELECT COUNT(*) as count FROM events WHERE LOWER(player_address) = LOWER($1) AND event_type = $2',
        [playerAddress, 'ItemPlaced']
      ),
      query(
        `SELECT MIN(created_at) as first_claim, MAX(created_at) as last_activity 
         FROM events 
         WHERE LOWER(player_address) = LOWER($1)`,
        [playerAddress]
      ),
    ]);

    return {
      tilesOwned: parseInt(tilesResult.rows[0].count),
      itemsPlaced: parseInt(itemsResult.rows[0].count),
      firstClaim: activityResult.rows[0].first_claim,
      lastActivity: activityResult.rows[0].last_activity,
    };
  }
}