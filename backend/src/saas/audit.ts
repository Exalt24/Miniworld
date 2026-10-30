import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';

export interface AuditEvent {
  eventId: string;
  at: Date;
  tenantId: string | null;
  actorUid: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export type NewAuditEvent = Omit<AuditEvent, 'eventId' | 'at'>;

/**
 * Append-only log of every state change, kept in MongoDB. The class exposes insert and read
 * and nothing else: there is no update or delete method, and the unique index on eventId
 * makes a replayed event fail loudly instead of overwriting.
 */
export class AuditLog {
  private readonly events: Collection<AuditEvent>;

  constructor(db: Db) {
    this.events = db.collection<AuditEvent>('audit_events');
  }

  async init(): Promise<void> {
    await this.events.createIndex({ eventId: 1 }, { unique: true });
    await this.events.createIndex({ tenantId: 1, at: -1 });
  }

  async append(event: NewAuditEvent): Promise<AuditEvent> {
    const full: AuditEvent = { ...event, eventId: randomUUID(), at: new Date() };
    await this.events.insertOne({ ...full });
    return full;
  }

  async listForTenant(tenantId: string, limit = 100): Promise<AuditEvent[]> {
    return this.events
      .find({ tenantId }, { projection: { _id: 0 } })
      .sort({ at: -1, eventId: 1 })
      .limit(limit)
      .toArray();
  }
}
