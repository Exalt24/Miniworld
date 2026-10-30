import { Op } from 'sequelize';
import type { AuditLog } from './audit.js';
import type { ReadThroughCache } from './cache.js';
import { conflict, notFound, AppError } from './errors.js';
import type { Models, Role, SubscriptionStatus } from './models.js';

export interface Actor {
  uid: string;
  email?: string;
  platformAdmin: boolean;
}

export interface PlanDto {
  id: string;
  code: string;
  name: string;
  maxMembers: number;
  maxWorlds: number;
  priceCents: number;
}

export interface UserDto {
  id: string;
  tenantId: string;
  firebaseUid: string;
  email: string;
  role: Role;
}

export interface SubscriptionDto {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

const planKeyById = (id: string) => `plan:id:${id}`;
const planKeyByCode = (code: string) => `plan:code:${code}`;

const planDto = (p: Models['Plan']['prototype']): PlanDto => ({
  id: p.id,
  code: p.code,
  name: p.name,
  maxMembers: p.maxMembers,
  maxWorlds: p.maxWorlds,
  priceCents: p.priceCents,
});

const userDto = (u: Models['User']['prototype']): UserDto => ({
  id: u.id,
  tenantId: u.tenantId,
  firebaseUid: u.firebaseUid,
  email: u.email,
  role: u.role,
});

const subscriptionDto = (s: Models['Subscription']['prototype']): SubscriptionDto => ({
  id: s.id,
  tenantId: s.tenantId,
  planId: s.planId,
  status: s.status,
  currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
});

/**
 * Every tenant-owned query below carries the tenant id in its where clause. The route layer
 * only hands in a tenant id after checking the caller belongs to it, and the where clauses
 * keep a bug in one route from reaching another tenant's rows.
 */
export class SaasService {
  constructor(
    private readonly m: Models,
    private readonly cache: ReadThroughCache,
    private readonly audit: AuditLog,
  ) {}

  private async record(
    tenantId: string | null,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    before: object | null,
    after: object | null,
  ): Promise<void> {
    await this.audit.append({
      tenantId,
      actorUid: actor.uid,
      action,
      entityType,
      entityId,
      before: before as Record<string, unknown> | null,
      after: after as Record<string, unknown> | null,
    });
  }

  // ---- plans (global catalogue, cached) ----

  async listPlans(): Promise<PlanDto[]> {
    const rows = await this.m.Plan.findAll({ order: [['priceCents', 'ASC']] });
    return rows.map(planDto);
  }

  getPlanByCode(code: string): Promise<PlanDto | null> {
    return this.cache.get(planKeyByCode(code), async () => {
      const row = await this.m.Plan.findOne({ where: { code } });
      return row ? planDto(row) : null;
    });
  }

  getPlanById(id: string): Promise<PlanDto | null> {
    return this.cache.get(planKeyById(id), async () => {
      const row = await this.m.Plan.findOne({ where: { id } });
      return row ? planDto(row) : null;
    });
  }

  async createPlan(actor: Actor, input: Omit<PlanDto, 'id'>): Promise<PlanDto> {
    const created = await this.m.sequelize.transaction(async (t) => {
      const row = await this.m.Plan.create({ ...input }, { transaction: t });
      const dto = planDto(row);
      await this.record(null, actor, 'plan.created', 'plan', dto.id, null, dto);
      return dto;
    });
    return created;
  }

  async updatePlan(actor: Actor, code: string, patch: Partial<Omit<PlanDto, 'id' | 'code'>>): Promise<PlanDto> {
    const { before, after } = await this.m.sequelize.transaction(async (t) => {
      const row = await this.m.Plan.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
      if (!row) throw notFound('plan');
      const prev = planDto(row);
      await row.update(patch, { transaction: t });
      const next = planDto(row);
      await this.record(null, actor, 'plan.updated', 'plan', next.id, prev, next);
      return { before: prev, after: next };
    });
    // After the commit, so a reader cannot re-cache the old row between the delete and the commit.
    await this.cache.invalidate(planKeyById(before.id), planKeyByCode(before.code));
    return after;
  }

  // ---- tenants ----

  async createTenant(actor: Actor, input: { name: string; slug: string }) {
    if (!actor.email) throw new AppError(400, 'email_required', 'the token has no email claim');
    const email = actor.email;
    return this.m.sequelize.transaction(async (t) => {
      const free = await this.m.Plan.findOne({ where: { code: 'free' }, transaction: t });
      if (!free) throw new AppError(500, 'no_default_plan', 'the free plan is not seeded');
      const tenant = await this.m.Tenant.create({ ...input }, { transaction: t });
      const subscription = await this.m.Subscription.create(
        { tenantId: tenant.id, planId: free.id, status: 'trialing', currentPeriodEnd: null },
        { transaction: t },
      );
      const owner = await this.m.User.create(
        { tenantId: tenant.id, firebaseUid: actor.uid, email, role: 'owner' },
        { transaction: t },
      );
      await this.record(tenant.id, actor, 'tenant.created', 'tenant', tenant.id, null, { id: tenant.id, slug: tenant.slug, name: tenant.name });
      await this.record(tenant.id, actor, 'subscription.created', 'subscription', subscription.id, null, subscriptionDto(subscription));
      await this.record(tenant.id, actor, 'user.added', 'user', owner.id, null, userDto(owner));
      return { id: tenant.id, slug: tenant.slug, name: tenant.name, subscription: subscriptionDto(subscription) };
    });
  }

  async listTenantsFor(uid: string) {
    const memberships = await this.m.User.findAll({ where: { firebaseUid: uid } });
    if (memberships.length === 0) return [];
    const tenants = await this.m.Tenant.findAll({ where: { id: { [Op.in]: memberships.map((u) => u.tenantId) } }, order: [['name', 'ASC']] });
    return tenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name }));
  }

  async getTenant(tenantId: string) {
    const row = await this.m.Tenant.findOne({ where: { id: tenantId } });
    if (!row) throw notFound('tenant');
    return { id: row.id, slug: row.slug, name: row.name };
  }

  async getMembership(tenantId: string, uid: string): Promise<UserDto | null> {
    const row = await this.m.User.findOne({ where: { tenantId, firebaseUid: uid } });
    return row ? userDto(row) : null;
  }

  // ---- subscription ----

  async getSubscription(tenantId: string) {
    const sub = await this.m.Subscription.findOne({ where: { tenantId } });
    if (!sub) throw notFound('subscription');
    const plan = await this.getPlanById(sub.planId);
    return { ...subscriptionDto(sub), plan };
  }

  async changeSubscription(actor: Actor, tenantId: string, input: { planCode?: string; status?: SubscriptionStatus }) {
    const next = await this.m.sequelize.transaction(async (t) => {
      const sub = await this.m.Subscription.findOne({ where: { tenantId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!sub) throw notFound('subscription');
      const before = subscriptionDto(sub);
      const patch: { planId?: string; status?: SubscriptionStatus } = {};
      if (input.planCode !== undefined) {
        const plan = await this.m.Plan.findOne({ where: { code: input.planCode }, transaction: t });
        if (!plan) throw notFound('plan');
        const members = await this.m.User.count({ where: { tenantId }, transaction: t });
        if (members > plan.maxMembers) {
          throw conflict('plan_too_small', `the tenant has ${members} members and ${plan.code} allows ${plan.maxMembers}`);
        }
        patch.planId = plan.id;
      }
      if (input.status !== undefined) patch.status = input.status;
      await sub.update(patch, { transaction: t });
      const after = subscriptionDto(sub);
      await this.record(tenantId, actor, 'subscription.changed', 'subscription', sub.id, before, after);
      return after;
    });
    return { ...next, plan: await this.getPlanById(next.planId) };
  }

  // ---- users ----

  async listUsers(tenantId: string): Promise<UserDto[]> {
    const rows = await this.m.User.findAll({ where: { tenantId }, order: [['createdAt', 'ASC']] });
    return rows.map(userDto);
  }

  async addUser(actor: Actor, tenantId: string, input: { firebaseUid: string; email: string; role: Role }): Promise<UserDto> {
    return this.m.sequelize.transaction(async (t) => {
      // Locking the tenant row serialises concurrent adds, so the member limit cannot be raced.
      await this.m.Tenant.findOne({ where: { id: tenantId }, transaction: t, lock: t.LOCK.UPDATE });
      const sub = await this.m.Subscription.findOne({ where: { tenantId }, transaction: t });
      if (!sub) throw notFound('subscription');
      if (sub.status === 'canceled' || sub.status === 'past_due') {
        throw new AppError(402, 'subscription_inactive', `the subscription is ${sub.status}`);
      }
      const plan = await this.m.Plan.findOne({ where: { id: sub.planId }, transaction: t });
      if (!plan) throw notFound('plan');
      const members = await this.m.User.count({ where: { tenantId }, transaction: t });
      if (members >= plan.maxMembers) {
        throw conflict('member_limit_reached', `the ${plan.code} plan allows ${plan.maxMembers} members`);
      }
      const row = await this.m.User.create({ tenantId, ...input }, { transaction: t });
      await this.record(tenantId, actor, 'user.added', 'user', row.id, null, userDto(row));
      return userDto(row);
    });
  }

  async removeUser(actor: Actor, tenantId: string, userId: string): Promise<void> {
    await this.m.sequelize.transaction(async (t) => {
      const row = await this.m.User.findOne({ where: { id: userId, tenantId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!row) throw notFound('user');
      if (row.role === 'owner') throw conflict('owner_protected', 'an owner cannot be removed');
      const before = userDto(row);
      await row.destroy({ transaction: t });
      await this.record(tenantId, actor, 'user.removed', 'user', before.id, before, null);
    });
  }

  // ---- audit ----

  listAudit(tenantId: string) {
    return this.audit.listForTenant(tenantId);
  }
}
