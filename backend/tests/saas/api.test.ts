import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AuditLog } from '../../src/saas/audit.js';
import { startHarness, pgQuery, type Harness } from './support/harness.js';

let h: Harness;
let slugCounter = 0;

before(async () => {
  h = await startHarness();
});
after(async () => {
  await h.close();
});

const tok = (uid: string, extra: Record<string, unknown> = {}) => h.token(uid, extra);

/** Creates a tenant owned by `uid` and returns its id. */
async function makeTenant(uid: string): Promise<string> {
  slugCounter += 1;
  const res = await h.call('POST', '/tenants', { token: tok(uid), body: { name: `Studio ${slugCounter}`, slug: `studio-${slugCounter}` } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
}

async function addMember(ownerUid: string, tenantId: string, uid: string, role = 'member') {
  return h.call('POST', `/tenants/${tenantId}/users`, {
    token: tok(ownerUid),
    body: { firebaseUid: uid, email: `${uid}@example.test`, role },
  });
}

const actions = async (tenantId: string) => (await h.audit.listForTenant(tenantId, 1000)).map((e) => e.action);

describe('token checks at the HTTP edge', () => {
  it('refuses a request with no token', async () => {
    const res = await h.call('GET', '/plans');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'missing_token');
  });

  it('accepts a valid token', async () => {
    const res = await h.call('GET', '/plans', { token: tok('reader') });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.plans.map((p: { code: string }) => p.code), ['free', 'pro', 'scale']);
  });

  const refused: Array<[string, () => string, string]> = [
    ['an expired token', () => tok('u', { exp: Math.floor(Date.now() / 1000) - 10 }), 'expired'],
    ['a token for another audience', () => tok('u', { aud: 'another-project' }), 'bad_audience'],
    ['a token from another issuer', () => tok('u', { iss: 'https://securetoken.google.com/another-project' }), 'bad_issuer'],
    ['a token with a tampered payload', () => {
      const [header, , signature] = tok('victim').split('.');
      return `${header}.${Buffer.from(JSON.stringify({ sub: 'attacker', aud: 'miniworld-test-project' })).toString('base64url')}.${signature}`;
    }, 'bad_signature'],
    ['a token signed with a different key', () => h.keyServer.sign({ sub: 'u', aud: 'miniworld-test-project' }, { foreignKey: true, kid: h.keyServer.currentKid }), 'bad_signature'],
    ['a token with an unknown kid', () => h.keyServer.sign({ sub: 'u' }, { kid: 'unknown' }), 'unknown_kid'],
    ['a token using HS256', () => h.keyServer.sign({ sub: 'u' }, { alg: 'HS256' }), 'bad_alg'],
  ];
  for (const [name, make, reason] of refused) {
    it(`refuses ${name}`, async () => {
      const res = await h.call('GET', '/plans', { token: make() });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.reason, reason);
    });
  }

  it('keeps working after the key server rotates its key', async () => {
    h.keyServer.rotate();
    const res = await h.call('GET', '/plans', { token: tok('after-rotation') });
    assert.equal(res.status, 200);
  });
});

describe('tenant isolation', () => {
  it('lets a member read their tenant and refuses everyone else, on every route', async () => {
    const tenantA = await makeTenant('owner-a');
    const tenantB = await makeTenant('owner-b');

    const own = await h.call('GET', `/tenants/${tenantA}`, { token: tok('owner-a') });
    assert.equal(own.status, 200);
    assert.equal(own.body.id, tenantA);
    const ownB = await h.call('GET', `/tenants/${tenantB}`, { token: tok('owner-b') });
    assert.equal(ownB.body.id, tenantB, 'each member reads their own tenant, not the first row');

    const outsider = tok('owner-b');
    const probes: Array<[string, string, unknown?]> = [
      ['GET', `/tenants/${tenantA}`],
      ['GET', `/tenants/${tenantA}/subscription`],
      ['PUT', `/tenants/${tenantA}/subscription`, { status: 'canceled' }],
      ['GET', `/tenants/${tenantA}/users`],
      ['POST', `/tenants/${tenantA}/users`, { firebaseUid: 'x', email: 'x@example.test', role: 'member' }],
      ['GET', `/tenants/${tenantA}/audit`],
    ];
    for (const [method, route, body] of probes) {
      const res = await h.call(method, route, { token: outsider, body });
      assert.equal(res.status, 403, `${method} ${route} should be refused for a non-member`);
    }
    const sub = await h.call('GET', `/tenants/${tenantA}/subscription`, { token: tok('owner-a') });
    assert.equal(sub.body.status, 'trialing', 'the refused PUT did not change anything');
  });

  it('keeps one tenant subscription separate from another when it is read or changed', async () => {
    const upgraded = await makeTenant('sub-iso-x');
    const untouched = await makeTenant('sub-iso-y');
    const change = await h.call('PUT', `/tenants/${upgraded}/subscription`, { token: tok('sub-iso-x'), body: { planCode: 'pro', status: 'active' } });
    assert.equal(change.status, 200);
    assert.equal(change.body.tenantId, upgraded);

    const x = await h.call('GET', `/tenants/${upgraded}/subscription`, { token: tok('sub-iso-x') });
    const y = await h.call('GET', `/tenants/${untouched}/subscription`, { token: tok('sub-iso-y') });
    assert.deepEqual([x.body.tenantId, x.body.plan.code, x.body.status], [upgraded, 'pro', 'active']);
    assert.deepEqual([y.body.tenantId, y.body.plan.code, y.body.status], [untouched, 'free', 'trialing']);

    const rows = await pgQuery(h.databaseUrl, 'SELECT count(*)::int AS n FROM subscriptions WHERE status = $1 AND tenant_id <> $2', ['active', upgraded]);
    assert.equal(rows.rows[0].n, 0, 'no other tenant subscription was changed');
  });

  it('answers 404 for a tenant id that is not a UUID', async () => {
    const res = await h.call('GET', '/tenants/not-a-uuid', { token: tok('owner-a') });
    assert.equal(res.status, 404);
  });

  it('lists only the caller own tenants and only that tenant users', async () => {
    const tenantA = await makeTenant('lister-a');
    const tenantB = await makeTenant('lister-b');
    await addMember('lister-a', tenantA, 'only-in-a');
    await addMember('lister-b', tenantB, 'only-in-b');

    const mine = await h.call('GET', '/tenants', { token: tok('lister-a') });
    assert.deepEqual(mine.body.tenants.map((t: { id: string }) => t.id), [tenantA]);

    const usersA = await h.call('GET', `/tenants/${tenantA}/users`, { token: tok('lister-a') });
    assert.deepEqual(usersA.body.users.map((u: { firebaseUid: string }) => u.firebaseUid).sort(), ['lister-a', 'only-in-a']);
  });

  it('cannot remove another tenant user through your own tenant path', async () => {
    const tenantA = await makeTenant('del-a');
    const tenantB = await makeTenant('del-b');
    const added = await addMember('del-b', tenantB, 'victim');
    const victimId = added.body.id;

    const res = await h.call('DELETE', `/tenants/${tenantA}/users/${victimId}`, { token: tok('del-a') });
    assert.equal(res.status, 404);
    const rows = await pgQuery(h.databaseUrl, 'SELECT count(*)::int AS n FROM users WHERE id = $1', [victimId]);
    assert.equal(rows.rows[0].n, 1, 'the other tenant user is still there');
  });

  it('keeps each tenant audit trail separate', async () => {
    const tenantA = await makeTenant('trail-a');
    await makeTenant('trail-b');
    const events = await h.call('GET', `/tenants/${tenantA}/audit`, { token: tok('trail-a') });
    assert.ok(events.body.events.length > 0);
    assert.ok(events.body.events.every((e: { tenantId: string }) => e.tenantId === tenantA));
  });
});

describe('roles', () => {
  it('lets only owners change the subscription and only owners or admins add and remove people', async () => {
    const tenant = await makeTenant('roles-owner');
    const member = await addMember('roles-owner', tenant, 'roles-member');
    assert.equal(member.status, 201);
    await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('roles-owner'), body: { planCode: 'pro' } });
    const admin = await addMember('roles-owner', tenant, 'roles-admin', 'admin');
    assert.equal(admin.status, 201);

    const memberAdds = await addMember('roles-member', tenant, 'another');
    assert.equal(memberAdds.status, 403);
    const adminChangesPlan = await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('roles-admin'), body: { status: 'active' } });
    assert.equal(adminChangesPlan.status, 403);
    const memberReadsAudit = await h.call('GET', `/tenants/${tenant}/audit`, { token: tok('roles-member') });
    assert.equal(memberReadsAudit.status, 403);
    const adminAdds = await addMember('roles-admin', tenant, 'added-by-admin');
    assert.equal(adminAdds.status, 201);
    const memberRemoves = await h.call('DELETE', `/tenants/${tenant}/users/${adminAdds.body.id}`, { token: tok('roles-member') });
    assert.equal(memberRemoves.status, 403);
    const adminRemoves = await h.call('DELETE', `/tenants/${tenant}/users/${adminAdds.body.id}`, { token: tok('roles-admin') });
    assert.equal(adminRemoves.status, 204);
  });

  it('does not let an owner be removed', async () => {
    const tenant = await makeTenant('owner-keep');
    const users = await h.call('GET', `/tenants/${tenant}/users`, { token: tok('owner-keep') });
    const ownerId = users.body.users[0].id;
    const res = await h.call('DELETE', `/tenants/${tenant}/users/${ownerId}`, { token: tok('owner-keep') });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'owner_protected');
  });

  it('lets only a platform admin write plans', async () => {
    const asUser = await h.call('PATCH', '/plans/pro', { token: tok('plain-user'), body: { priceCents: 1 } });
    assert.equal(asUser.status, 403);
    const create = await h.call('POST', '/plans', { token: tok('plain-user'), body: { code: 'x', name: 'X', maxMembers: 1, maxWorlds: 0, priceCents: 0 } });
    assert.equal(create.status, 403);
  });
});

describe('subscription and plan limits', () => {
  it('starts a new tenant on the free plan in trial', async () => {
    const tenant = await makeTenant('sub-start');
    const res = await h.call('GET', `/tenants/${tenant}/subscription`, { token: tok('sub-start') });
    assert.equal(res.body.status, 'trialing');
    assert.equal(res.body.plan.code, 'free');
  });

  it('refuses a member beyond the plan limit and accepts it after an upgrade', async () => {
    const tenant = await makeTenant('limit-owner');
    assert.equal((await addMember('limit-owner', tenant, 'm1')).status, 201);
    assert.equal((await addMember('limit-owner', tenant, 'm2')).status, 201);
    const over = await addMember('limit-owner', tenant, 'm3');
    assert.equal(over.status, 409);
    assert.equal(over.body.error.code, 'member_limit_reached');

    const upgrade = await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('limit-owner'), body: { planCode: 'pro', status: 'active' } });
    assert.equal(upgrade.status, 200);
    assert.equal(upgrade.body.plan.code, 'pro');
    assert.equal((await addMember('limit-owner', tenant, 'm3')).status, 201);
  });

  it('refuses a downgrade below the current member count', async () => {
    const tenant = await makeTenant('down-owner');
    await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('down-owner'), body: { planCode: 'pro' } });
    for (const uid of ['d1', 'd2', 'd3']) await addMember('down-owner', tenant, uid);
    const res = await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('down-owner'), body: { planCode: 'free' } });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'plan_too_small');
  });

  it('refuses new members while the subscription is canceled or past due', async () => {
    const tenant = await makeTenant('inactive-owner');
    await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('inactive-owner'), body: { status: 'canceled' } });
    const res = await addMember('inactive-owner', tenant, 'late');
    assert.equal(res.status, 402);
    assert.equal(res.body.error.code, 'subscription_inactive');
  });

  it('holds the member limit under concurrent adds', async () => {
    const tenant = await makeTenant('race-owner');
    const results = await Promise.all(['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].map((uid) => addMember('race-owner', tenant, uid)));
    const created = results.filter((r) => r.status === 201).length;
    assert.equal(created, 2, 'the free plan allows three members and the owner is one');
    const users = await h.call('GET', `/tenants/${tenant}/users`, { token: tok('race-owner') });
    assert.equal(users.body.users.length, 3);
  });
});

describe('validation and error handling', () => {
  it('rejects bad input with a 400 and a path for each problem', async () => {
    const badSlug = await h.call('POST', '/tenants', { token: tok('v1'), body: { name: 'A', slug: 'Not A Slug' } });
    assert.equal(badSlug.status, 400);
    assert.equal(badSlug.body.error.code, 'validation_failed');
    assert.equal(badSlug.body.error.issues[0].path, 'slug');

    const extra = await h.call('POST', '/tenants', { token: tok('v1'), body: { name: 'A', slug: 'good-slug', isAdmin: true } });
    assert.equal(extra.status, 400);

    const tenant = await makeTenant('v2');
    const badEmail = await h.call('POST', `/tenants/${tenant}/users`, { token: tok('v2'), body: { firebaseUid: 'x', email: 'nope', role: 'member' } });
    assert.equal(badEmail.status, 400);
    const ownerRole = await h.call('POST', `/tenants/${tenant}/users`, { token: tok('v2'), body: { firebaseUid: 'x', email: 'x@example.test', role: 'owner' } });
    assert.equal(ownerRole.status, 400, 'an owner cannot be created through the add-user route');
    const emptyChange = await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('v2'), body: {} });
    assert.equal(emptyChange.status, 400);
  });

  it('rejects unreadable bodies and answers duplicates with a 409', async () => {
    const broken = await h.call('POST', '/tenants', { token: tok('v3'), rawBody: '{not json' });
    assert.equal(broken.status, 400);
    assert.equal(broken.body.error.code, 'unreadable_body');

    const first = await h.call('POST', '/tenants', { token: tok('v3'), body: { name: 'Dup', slug: 'dup-slug' } });
    assert.equal(first.status, 201);
    const second = await h.call('POST', '/tenants', { token: tok('v4'), body: { name: 'Dup', slug: 'dup-slug' } });
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'already_exists');
  });

  it('answers 404 for a plan or user that does not exist', async () => {
    const admin = tok('root', { platform_admin: true });
    const plan = await h.call('PATCH', '/plans/nope', { token: admin, body: { priceCents: 5 } });
    assert.equal(plan.status, 404);
    const tenant = await makeTenant('v5');
    const user = await h.call('DELETE', `/tenants/${tenant}/users/00000000-0000-4000-8000-000000000000`, { token: tok('v5') });
    assert.equal(user.status, 404);
  });
});

describe('read-through plan cache in Redis', () => {
  it('serves the plan from Redis after the first read, then reflects a change made through the API', async () => {
    const tenant = await makeTenant('cache-owner');
    const owner = tok('cache-owner');
    const platform = tok('cache-root', { platform_admin: true });

    const first = await h.call('GET', `/tenants/${tenant}/subscription`, { token: owner });
    const planId = first.body.plan.id;
    assert.equal(first.body.plan.maxMembers, 3);
    assert.equal(await h.redis.exists(`saas:plan:id:${planId}`), 1, 'the first read filled the cache');
    const ttl = await h.redis.ttl(`saas:plan:id:${planId}`);
    assert.ok(ttl > 0 && ttl <= 300, `cache entry has a TTL, saw ${ttl}`);

    // Change the row behind the API's back: a cache hit must not see it.
    await pgQuery(h.databaseUrl, "UPDATE plans SET max_members = 7 WHERE code = 'free'");
    const cached = await h.call('GET', `/tenants/${tenant}/subscription`, { token: owner });
    assert.equal(cached.body.plan.maxMembers, 3, 'the second read came from Redis');

    // Change it through the API: the cache is invalidated and the next read sees the new value.
    const patch = await h.call('PATCH', '/plans/free', { token: platform, body: { maxMembers: 4 } });
    assert.equal(patch.status, 200);
    assert.equal(await h.redis.exists(`saas:plan:id:${planId}`), 0, 'the change deleted the cache entry');
    const fresh = await h.call('GET', `/tenants/${tenant}/subscription`, { token: owner });
    assert.equal(fresh.body.plan.maxMembers, 4);
    assert.equal(await h.redis.exists(`saas:plan:id:${planId}`), 1, 'and the read refilled it');

    // Put the free plan back so later tests see the seeded limit of three members.
    await h.call('PATCH', '/plans/free', { token: platform, body: { maxMembers: 3 } });
  });

  it('invalidates the by-code entry too', async () => {
    const platform = tok('cache-root', { platform_admin: true });
    const warmed = await h.service.getPlanByCode('scale');
    assert.ok(warmed);
    assert.equal(await h.redis.exists('saas:plan:code:scale'), 1);
    await h.call('PATCH', '/plans/scale', { token: platform, body: { priceCents: 19900 } });
    assert.equal(await h.redis.exists('saas:plan:code:scale'), 0);
    assert.equal((await h.service.getPlanByCode('scale'))?.priceCents, 19900);
  });

  it('keeps answering when Redis is unreachable', async () => {
    const { Redis } = await import('ioredis');
    const { ReadThroughCache } = await import('../../src/saas/cache.js');
    const dead = new Redis('redis://127.0.0.1:1', { maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null, lazyConnect: true });
    dead.on('error', () => {});
    const cache = new ReadThroughCache(dead, 60);
    assert.equal(await cache.get('k', async () => 'from-loader'), 'from-loader');
  });
});

describe('append-only audit log in MongoDB', () => {
  it('records exactly one event per state change, with who, what, before and after', async () => {
    const tenant = await makeTenant('audit-owner');
    assert.deepEqual((await actions(tenant)).sort(), ['subscription.created', 'tenant.created', 'user.added'], 'creating a tenant records the tenant, its subscription and its owner');

    const added = await addMember('audit-owner', tenant, 'audit-member');
    assert.equal((await h.audit.listForTenant(tenant)).length, 4);

    await h.call('PUT', `/tenants/${tenant}/subscription`, { token: tok('audit-owner'), body: { planCode: 'pro', status: 'active' } });
    assert.equal((await h.audit.listForTenant(tenant)).length, 5);

    await h.call('DELETE', `/tenants/${tenant}/users/${added.body.id}`, { token: tok('audit-owner') });
    const events = await h.audit.listForTenant(tenant);
    assert.equal(events.length, 6);

    const removal = events.find((e) => e.action === 'user.removed');
    assert.ok(removal);
    assert.equal(removal.actorUid, 'audit-owner');
    assert.equal(removal.entityId, added.body.id);
    assert.equal((removal.before as { firebaseUid: string }).firebaseUid, 'audit-member');
    assert.equal(removal.after, null);

    const change = events.find((e) => e.action === 'subscription.changed');
    assert.ok(change);
    assert.equal((change.before as { status: string }).status, 'trialing');
    assert.equal((change.after as { status: string }).status, 'active');
  });

  it('records plan edits as global events with the old and new values', async () => {
    const platform = tok('audit-root', { platform_admin: true });
    const created = await h.call('POST', '/plans', { token: platform, body: { code: 'audit-plan', name: 'Audit', maxMembers: 5, maxWorlds: 2, priceCents: 100 } });
    assert.equal(created.status, 201);
    await h.call('PATCH', '/plans/audit-plan', { token: platform, body: { priceCents: 250 } });
    const events = (await h.audit.listForTenant(null as unknown as string, 1000)).filter((e) => e.entityId === created.body.id);
    assert.deepEqual(events.map((e) => e.action).sort(), ['plan.created', 'plan.updated']);
    const updated = events.find((e) => e.action === 'plan.updated')!;
    assert.equal((updated.before as { priceCents: number }).priceCents, 100);
    assert.equal((updated.after as { priceCents: number }).priceCents, 250);
  });

  it('writes nothing for a refused change or a read', async () => {
    const tenant = await makeTenant('quiet-owner');
    const baseline = await h.auditCount(tenant);
    await addMember('quiet-owner', tenant, 'q1');
    await addMember('quiet-owner', tenant, 'q2');
    const refused = await addMember('quiet-owner', tenant, 'q3');
    assert.equal(refused.status, 409);
    await h.call('GET', `/tenants/${tenant}/users`, { token: tok('quiet-owner') });
    await h.call('GET', `/tenants/${tenant}/subscription`, { token: tok('quiet-owner') });
    assert.equal(await h.auditCount(tenant), baseline + 2, 'only the two successful adds were logged');
    const outsider = await h.call('DELETE', `/tenants/${tenant}/users/00000000-0000-4000-8000-000000000000`, { token: tok('quiet-owner') });
    assert.equal(outsider.status, 404);
    assert.equal(await h.auditCount(tenant), baseline + 2, 'a 404 delete was not logged');
  });

  it('exposes no way to change or delete an event, and indexes the event id as unique', async () => {
    const methods = Object.getOwnPropertyNames(AuditLog.prototype).sort();
    assert.deepEqual(methods, ['append', 'constructor', 'init', 'listForTenant']);

    const { MongoClient } = await import('mongodb');
    const client = await new MongoClient(process.env.SAAS_TEST_MONGO_URL ?? 'mongodb://127.0.0.1:57017').connect();
    try {
      const indexes = await client.db('miniworld_saas_test').collection('audit_events').indexes();
      assert.ok(indexes.some((i) => i.unique && (i.key as Record<string, number>).eventId === 1));
    } finally {
      await client.close();
    }
  });
});
