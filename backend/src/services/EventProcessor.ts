import { query, getClient } from '../config/database.js';
import { ContractEvent } from '../types/game.js';
import { WebSocketServer } from '../websocket/server.js';

export class EventProcessor {
  private wsServer?: WebSocketServer;

  setWebSocketServer(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
  }

  async processEvents(events: ContractEvent[]): Promise<void> {
    if (events.length === 0) return;

    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      for (const event of events) {
        await this.storeEvent(event, client);
        await this.updateWorldState(event, client);
      }

      await client.query('COMMIT');
      console.log(`✓ Processed ${events.length} events successfully`);
      
      if (this.wsServer) {
        for (const event of events) {
          this.wsServer.broadcastEvent(event);
        }
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error processing events:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async storeEvent(event: ContractEvent, client: any): Promise<void> {
    const sql = `
      INSERT INTO events (
        event_type, tile_id, player_address, item_type, 
        block_number, transaction_hash, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      event.eventType,
      Number(event.tileId),
      event.owner,
      event.itemType !== undefined ? Number(event.itemType) : null,
      event.blockNumber.toString(),
      event.transactionHash,
      event.timestamp.toString(),
    ];

    await client.query(sql, values);
  }

  private async updateWorldState(event: ContractEvent, client: any): Promise<void> {
    const tileId = Number(event.tileId);

    if (event.eventType === 'TileClaimed') {
      const sql = `
        UPDATE world_state 
        SET owner = $1, last_modified = $2
        WHERE tile_id = $3
      `;
      await client.query(sql, [event.owner, event.timestamp.toString(), tileId]);
      
    } else if (event.eventType === 'ItemPlaced') {
      const sql = `
        UPDATE world_state 
        SET item_type = $1, last_modified = $2
        WHERE tile_id = $3
      `;
      await client.query(sql, [Number(event.itemType), event.timestamp.toString(), tileId]);
      
    } else if (event.eventType === 'ItemRemoved') {
      const sql = `
        UPDATE world_state 
        SET item_type = 0, last_modified = $1
        WHERE tile_id = $2
      `;
      await client.query(sql, [event.timestamp.toString(), tileId]);
    }
  }

  async updateSyncStatus(blockNumber: number): Promise<void> {
    const sql = `
      UPDATE sync_status 
      SET last_synced_block = $1, last_sync_time = CURRENT_TIMESTAMP
      WHERE id = 1
    `;
    await query(sql, [blockNumber.toString()]);
  }

  async getSyncStatus(): Promise<{ lastSyncedBlock: number; lastSyncTime: Date }> {
    const result = await query('SELECT last_synced_block, last_sync_time FROM sync_status WHERE id = 1');
    
    if (result.rows.length === 0) {
      return { lastSyncedBlock: 0, lastSyncTime: new Date() };
    }

    return {
      lastSyncedBlock: parseInt(result.rows[0].last_synced_block),
      lastSyncTime: result.rows[0].last_sync_time,
    };
  }
}