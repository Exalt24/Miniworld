import { provider, getContract } from '../config/blockchain.js';
import { EventProcessor } from './EventProcessor.js';
import { ContractEvent } from '../types/game.js';

export class EventListener {
  private contract: any;
  private processor: EventProcessor;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isListening = false;
  private lastProcessedBlock = 0;

  constructor(contractAddress: string, processor?: EventProcessor) {
    this.contract = getContract(contractAddress);
    this.processor = processor || new EventProcessor();
  }

  async start(startBlock: number = 0): Promise<void> {
    if (this.isListening) {
      console.log('EventListener already running');
      return;
    }

    this.isListening = true;
    this.lastProcessedBlock = startBlock;

    console.log(`Starting EventListener from block ${startBlock}`);
    console.log('Listening for: TileClaimed, ItemPlaced, ItemRemoved');

    await this.pollForEvents();

    this.pollingInterval = setInterval(async () => {
      await this.pollForEvents();
    }, 2000);
  }

  private async pollForEvents(): Promise<void> {
    try {
      const currentBlock = await provider.getBlockNumber();
      
      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = currentBlock;

      const events = await this.fetchAllEvents(fromBlock, toBlock);

      if (events.length > 0) {
        console.log(`Processing ${events.length} events from blocks ${fromBlock}-${toBlock}`);
        await this.processor.processEvents(events);
      }

      this.lastProcessedBlock = currentBlock;
      await this.processor.updateSyncStatus(currentBlock);

    } catch (error) {
      console.error('Error polling events:', error);
    }
  }

  private async fetchAllEvents(fromBlock: number, toBlock: number): Promise<ContractEvent[]> {
    const events: ContractEvent[] = [];

    const tileClaimedFilter = this.contract.filters.TileClaimed();
    const itemPlacedFilter = this.contract.filters.ItemPlaced();
    const itemRemovedFilter = this.contract.filters.ItemRemoved();

    const [claimedEvents, placedEvents, removedEvents] = await Promise.all([
      this.contract.queryFilter(tileClaimedFilter, fromBlock, toBlock),
      this.contract.queryFilter(itemPlacedFilter, fromBlock, toBlock),
      this.contract.queryFilter(itemRemovedFilter, fromBlock, toBlock),
    ]);

    for (const event of claimedEvents) {
      events.push({
        eventType: 'TileClaimed',
        tileId: event.args.tileId,
        owner: event.args.owner,
        timestamp: event.args.timestamp,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });
    }

    for (const event of placedEvents) {
      events.push({
        eventType: 'ItemPlaced',
        tileId: event.args.tileId,
        owner: event.args.owner,
        itemType: event.args.itemType,
        timestamp: event.args.timestamp,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });
    }

    for (const event of removedEvents) {
      events.push({
        eventType: 'ItemRemoved',
        tileId: event.args.tileId,
        owner: event.args.owner,
        timestamp: event.args.timestamp,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });
    }

    events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      return 0;
    });

    return events;
  }

  async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isListening = false;
    console.log('EventListener stopped');
  }

  isActive(): boolean {
    return this.isListening;
  }
}