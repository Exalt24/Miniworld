import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { ContractEvent } from '../types/game.js';

export class WebSocketServer {
  private io: Server;
  private connectedClients: Set<string> = new Set();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.connectedClients.add(socket.id);
      console.log(`✓ WebSocket client connected: ${socket.id} (${this.connectedClients.size} total)`);

      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id);
        console.log(`✗ WebSocket client disconnected: ${socket.id} (${this.connectedClients.size} remaining)`);
      });

      socket.on('error', (error) => {
        console.error(`WebSocket error for ${socket.id}:`, error);
      });

      socket.emit('connected', {
        message: 'Connected to MiniWorld backend',
        timestamp: new Date(),
      });
    });
  }

  broadcastTileClaimed(event: ContractEvent): void {
    this.io.emit('tileClaimed', {
      tileId: Number(event.tileId),
      owner: event.owner,
      timestamp: event.timestamp.toString(),
      transactionHash: event.transactionHash,
    });
  }

  broadcastItemPlaced(event: ContractEvent): void {
    this.io.emit('itemPlaced', {
      tileId: Number(event.tileId),
      owner: event.owner,
      itemType: event.itemType ? Number(event.itemType) : null,
      timestamp: event.timestamp.toString(),
      transactionHash: event.transactionHash,
    });
  }

  broadcastItemRemoved(event: ContractEvent): void {
    this.io.emit('itemRemoved', {
      tileId: Number(event.tileId),
      owner: event.owner,
      timestamp: event.timestamp.toString(),
      transactionHash: event.transactionHash,
    });
  }

  broadcastWorldUpdate(): void {
    this.io.emit('worldUpdate', {
      timestamp: new Date(),
    });
  }

  broadcastEvent(event: ContractEvent): void {
    switch (event.eventType) {
      case 'TileClaimed':
        this.broadcastTileClaimed(event);
        break;
      case 'ItemPlaced':
        this.broadcastItemPlaced(event);
        break;
      case 'ItemRemoved':
        this.broadcastItemRemoved(event);
        break;
    }
    
    this.broadcastWorldUpdate();
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  getServer(): Server {
    return this.io;
  }
}