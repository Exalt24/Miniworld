/**
 * Mutation check for the multi-tenant API guards.
 *
 * Each entry deletes (or weakens) one guard in the source, runs the suite and expects at
 * least one test to fail. A mutant that survives means a guard has no test behind it.
 * The file is always restored, including on Ctrl-C and on a crash.
 *
 * Usage (from backend/, with the databases from docker-compose.saas.yml running):
 *   npx tsx scripts/saas-mutation-check.ts                 run everything
 *   npx tsx scripts/saas-mutation-check.ts --check         only confirm each target text exists exactly once
 *   npx tsx scripts/saas-mutation-check.ts --from 1 --to 20   run a slice (1-based, inclusive)
 *
 * It is deterministic: the mutations are fixed text replacements applied in a fixed order.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface Mutation {
  id: string;
  file: string;
  from: string;
  to: string;
  what: string;
}

const skipAudit = (target: string, action: string) =>
  `await (false as boolean) && this.record(${target}, actor, '${action}',`;

const mutations: Mutation[] = [
  // ---- Firebase token guards ----
  { id: 'tok-alg', file: 'src/saas/firebase.ts', from: "if (header.alg !== 'RS256') throw", to: "if (false && header.alg !== 'RS256') throw", what: 'accept any algorithm' },
  { id: 'tok-kid', file: 'src/saas/firebase.ts', from: "if (typeof header.kid !== 'string' || header.kid === '') throw", to: 'if (false) throw', what: 'accept a token with no kid' },
  { id: 'tok-unknown-kid', file: 'src/saas/firebase.ts', from: "if (!key) throw new TokenError('unknown_kid'", to: "if (false && !key) throw new TokenError('unknown_kid'", what: 'accept an unknown kid' },
  { id: 'tok-signature', file: 'src/saas/firebase.ts', from: 'if (!signatureOk) throw', to: 'if (false && !signatureOk) throw', what: 'skip signature verification' },
  { id: 'tok-exp', file: 'src/saas/firebase.ts', from: '|| claims.exp <= now)', to: ')', what: 'accept an expired token' },
  { id: 'tok-iat', file: 'src/saas/firebase.ts', from: '|| claims.iat > now + this.skew)', to: ')', what: 'accept a token issued in the future' },
  { id: 'tok-auth-time', file: 'src/saas/firebase.ts', from: '|| claims.auth_time > now + this.skew)', to: ')', what: 'accept an auth_time in the future' },
  { id: 'tok-aud', file: 'src/saas/firebase.ts', from: 'if (claims.aud !== this.opts.projectId) throw', to: 'if (false && claims.aud !== this.opts.projectId) throw', what: 'accept any audience' },
  { id: 'tok-iss', file: 'src/saas/firebase.ts', from: 'if (claims.iss !== ', to: 'if (false && claims.iss !== ', what: 'accept any issuer' },
  { id: 'tok-sub', file: 'src/saas/firebase.ts', from: "if (typeof claims.sub !== 'string' || claims.sub === '' || claims.sub.length > 128) throw", to: 'if (false) throw', what: 'accept an empty or invalid subject' },
  { id: 'keys-throttle', file: 'src/saas/firebase.ts', from: 'if (this.nowMs() - this.lastFetchAt >= (this.opts.minRefetchMs ?? 10_000)) {', to: 'if (true) {', what: 'refetch keys on every unknown kid' },
  { id: 'keys-expiry', file: 'src/saas/firebase.ts', from: 'if (this.nowMs() >= this.expiresAt) await this.refresh();', to: ';', what: 'never refresh an expired key set' },

  // ---- HTTP guards ----
  { id: 'http-no-token', file: 'src/saas/routes.ts', from: 'if (!match) {', to: 'if (false) {', what: 'let a request without a token through the check' },
  { id: 'http-membership', file: 'src/saas/routes.ts', from: 'if (!membership) {', to: 'if (false) {', what: 'skip the tenant membership check' },
  { id: 'http-uuid', file: 'src/saas/routes.ts', from: 'if (!uuid.safeParse(tenantId).success) {', to: 'if (false) {', what: 'pass a non-UUID tenant id to the database' },
  { id: 'http-role', file: 'src/saas/routes.ts', from: 'if (!membership || !roles.includes(membership.role)) {', to: 'if (false) {', what: 'ignore roles everywhere' },
  { id: 'http-platform-admin', file: 'src/saas/routes.ts', from: 'if (!locals(res).actor.platformAdmin) {', to: 'if (false) {', what: 'let any user write plans' },
  { id: 'http-sub-owner-only', file: 'src/saas/routes.ts', from: "tenantScope.put('/subscription', requireRole('owner'),", to: "tenantScope.put('/subscription',", what: 'let any member change the subscription' },
  { id: 'http-add-user-role', file: 'src/saas/routes.ts', from: "tenantScope.post('/users', requireRole('owner', 'admin'),", to: "tenantScope.post('/users',", what: 'let any member add people' },
  { id: 'http-del-user-role', file: 'src/saas/routes.ts', from: "tenantScope.delete('/users/:userId', requireRole('owner', 'admin'),", to: "tenantScope.delete('/users/:userId',", what: 'let any member remove people' },
  { id: 'http-audit-role', file: 'src/saas/routes.ts', from: "tenantScope.get('/audit', requireRole('owner', 'admin'),", to: "tenantScope.get('/audit',", what: 'let any member read the audit trail' },
  { id: 'http-validate-add-user', file: 'src/saas/routes.ts', from: 'const body = schemas.addUser.parse(req.body);', to: 'const body = req.body;', what: 'skip validation on add user' },
  { id: 'http-strict-tenant', file: 'src/saas/routes.ts', from: 'createTenant: z.strictObject({', to: 'createTenant: z.object({', what: 'accept unknown fields on create tenant' },
  { id: 'http-owner-role', file: 'src/saas/routes.ts', from: "role: z.enum(['admin', 'member']),", to: "role: z.enum(['owner', 'admin', 'member']),", what: 'allow creating owners through add user' },

  // ---- tenant scoping in queries ----
  { id: 'scope-membership', file: 'src/saas/service.ts', from: 'where: { tenantId, firebaseUid: uid }', to: 'where: { firebaseUid: uid }', what: 'membership lookup ignores the tenant' },
  { id: 'scope-tenant-read', file: 'src/saas/service.ts', from: 'const row = await this.m.Tenant.findOne({ where: { id: tenantId } });\n    if (!row) throw notFound', to: 'const row = await this.m.Tenant.findOne({});\n    if (!row) throw notFound', what: 'tenant read ignores the id' },
  { id: 'scope-my-tenants', file: 'src/saas/service.ts', from: 'User.findAll({ where: { firebaseUid: uid } })', to: 'User.findAll({})', what: 'tenant list ignores the caller' },
  { id: 'scope-list-users', file: 'src/saas/service.ts', from: "User.findAll({ where: { tenantId }, order: [['createdAt', 'ASC']] })", to: "User.findAll({ order: [['createdAt', 'ASC']] })", what: 'user list ignores the tenant' },
  { id: 'scope-remove-user', file: 'src/saas/service.ts', from: 'where: { id: userId, tenantId }', to: 'where: { id: userId }', what: 'user removal ignores the tenant' },
  { id: 'scope-get-sub', file: 'src/saas/service.ts', from: 'const sub = await this.m.Subscription.findOne({ where: { tenantId } });', to: 'const sub = await this.m.Subscription.findOne({});', what: 'subscription read ignores the tenant' },
  { id: 'scope-change-sub', file: 'src/saas/service.ts', from: 'const sub = await this.m.Subscription.findOne({ where: { tenantId }, transaction: t, lock: t.LOCK.UPDATE });', to: 'const sub = await this.m.Subscription.findOne({ transaction: t, lock: t.LOCK.UPDATE });', what: 'subscription change ignores the tenant' },
  { id: 'scope-count-add', file: 'src/saas/service.ts', from: 'const members = await this.m.User.count({ where: { tenantId }, transaction: t });\n      if (members >= plan.maxMembers) {', to: 'const members = await this.m.User.count({ transaction: t });\n      if (members >= plan.maxMembers) {', what: 'member count ignores the tenant' },
  { id: 'scope-audit-read', file: 'src/saas/audit.ts', from: '.find({ tenantId }, ', to: '.find({}, ', what: 'audit read ignores the tenant' },

  // ---- plan rules ----
  { id: 'rule-member-limit', file: 'src/saas/service.ts', from: 'if (members >= plan.maxMembers) {', to: 'if (false && members >= plan.maxMembers) {', what: 'no member limit' },
  { id: 'rule-downgrade', file: 'src/saas/service.ts', from: 'if (members > plan.maxMembers) {', to: 'if (false && members > plan.maxMembers) {', what: 'allow a downgrade below the member count' },
  { id: 'rule-inactive', file: 'src/saas/service.ts', from: "if (sub.status === 'canceled' || sub.status === 'past_due') {", to: 'if (false) {', what: 'allow adding members on a canceled subscription' },
  { id: 'rule-owner-protected', file: 'src/saas/service.ts', from: "if (row.role === 'owner') throw", to: "if (false && row.role === 'owner') throw", what: 'allow removing an owner' },

  // ---- cache ----
  { id: 'cache-read', file: 'src/saas/cache.ts', from: 'if (hit !== null) return JSON.parse(hit) as T;', to: 'if (false && hit !== null) return JSON.parse(hit) as T;', what: 'never read from Redis' },
  { id: 'cache-ttl', file: 'src/saas/cache.ts', from: "await this.redis.set(full, JSON.stringify(value), 'EX', this.ttlSeconds);", to: 'await this.redis.set(full, JSON.stringify(value));', what: 'cache entries never expire' },
  { id: 'cache-invalidate-all', file: 'src/saas/service.ts', from: 'await this.cache.invalidate(planKeyById(before.id), planKeyByCode(before.code));', to: 'void 0;', what: 'no invalidation on plan change' },
  { id: 'cache-invalidate-id', file: 'src/saas/service.ts', from: 'await this.cache.invalidate(planKeyById(before.id), planKeyByCode(before.code));', to: 'await this.cache.invalidate(planKeyByCode(before.code));', what: 'invalidate only the by-code key' },
  { id: 'cache-invalidate-code', file: 'src/saas/service.ts', from: 'await this.cache.invalidate(planKeyById(before.id), planKeyByCode(before.code));', to: 'await this.cache.invalidate(planKeyById(before.id));', what: 'invalidate only the by-id key' },

  // ---- audit ----
  { id: 'audit-plan-created', file: 'src/saas/service.ts', from: "await this.record(null, actor, 'plan.created',", to: skipAudit('null', 'plan.created'), what: 'no audit event for a new plan' },
  { id: 'audit-plan-updated', file: 'src/saas/service.ts', from: "await this.record(null, actor, 'plan.updated',", to: skipAudit('null', 'plan.updated'), what: 'no audit event for a plan change' },
  { id: 'audit-tenant-created', file: 'src/saas/service.ts', from: "await this.record(tenant.id, actor, 'tenant.created',", to: skipAudit('tenant.id', 'tenant.created'), what: 'no audit event for a new tenant' },
  { id: 'audit-sub-created', file: 'src/saas/service.ts', from: "await this.record(tenant.id, actor, 'subscription.created',", to: skipAudit('tenant.id', 'subscription.created'), what: 'no audit event for a new subscription' },
  { id: 'audit-owner-added', file: 'src/saas/service.ts', from: "await this.record(tenant.id, actor, 'user.added',", to: skipAudit('tenant.id', 'user.added'), what: 'no audit event for the first owner' },
  { id: 'audit-sub-changed', file: 'src/saas/service.ts', from: "await this.record(tenantId, actor, 'subscription.changed',", to: skipAudit('tenantId', 'subscription.changed'), what: 'no audit event for a subscription change' },
  { id: 'audit-user-added', file: 'src/saas/service.ts', from: "await this.record(tenantId, actor, 'user.added',", to: skipAudit('tenantId', 'user.added'), what: 'no audit event for an added user' },
  { id: 'audit-user-removed', file: 'src/saas/service.ts', from: "await this.record(tenantId, actor, 'user.removed',", to: skipAudit('tenantId', 'user.removed'), what: 'no audit event for a removed user' },
  { id: 'audit-unique-index', file: 'src/saas/audit.ts', from: 'createIndex({ eventId: 1 }, { unique: true })', to: 'createIndex({ eventId: 1 }, {})', what: 'event id index is not unique' },
];

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const checkOnly = args.includes('--check');
const from = parseInt(flag('--from') ?? '1', 10);
const to = parseInt(flag('--to') ?? String(mutations.length), 10);

const tsxCli = path.join(backendDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');

interface SuiteResult {
  passed: boolean;
  failing: string[];
  /** The failure is a real assertion failure, not a missing database or a crash. */
  assertionFailure: boolean;
  /** The databases were unreachable, so the run says nothing about the mutant. */
  infraDown: boolean;
}

function runSuite(): SuiteResult {
  const res = spawnSync(process.execPath, [tsxCli, '--test', '--test-concurrency=1', 'tests/saas/*.test.ts'], {
    cwd: backendDir,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${res.stdout}\n${res.stderr}`;
  const failing = [...res.stdout.matchAll(/^\s*✖ (.+?)(?: \(\d|\s*$)/gm)].map((m) => m[1]);
  return {
    passed: res.status === 0,
    failing,
    assertionFailure: /ERR_ASSERTION|AssertionError/.test(out),
    infraDown: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|MongoServerSelectionError|Connection terminated/.test(out),
  };
}

const originals = new Map<string, string>();
function restoreAll() {
  for (const [file, text] of originals) writeFileSync(path.join(backendDir, file), text);
}
process.on('SIGINT', () => {
  restoreAll();
  process.exit(130);
});

function main(): number {
  // 1. every target must exist exactly once, or the mutation proves nothing
  let bad = 0;
  for (const m of mutations) {
    const text = readFileSync(path.join(backendDir, m.file), 'utf8').replace(/\r\n/g, '\n');
    const count = text.split(m.from).length - 1;
    if (count !== 1) {
      console.log(`TARGET PROBLEM ${m.id}: found ${count} copies of the target text in ${m.file}`);
      bad += 1;
    }
  }
  if (bad > 0) return 2;
  console.log(`${mutations.length} mutation targets found, each exactly once.`);
  if (checkOnly) return 0;

  // 2. the unmutated suite must pass
  const baseline = runSuite();
  console.log(`baseline: ${baseline.passed ? 'suite passes' : 'SUITE FAILS'}`);
  if (!baseline.passed) return 2;

  let killed = 0;
  const survivors: string[] = [];
  const slice = mutations.slice(from - 1, to);
  for (const [i, m] of slice.entries()) {
    const abs = path.join(backendDir, m.file);
    const raw = originals.get(m.file) ?? readFileSync(abs, 'utf8');
    originals.set(m.file, raw);
    const usesCrlf = raw.includes('\r\n');
    const lf = raw.replace(/\r\n/g, '\n');
    const mutated = lf.replace(m.from, () => m.to);
    writeFileSync(abs, usesCrlf ? mutated.replace(/\n/g, '\r\n') : mutated);
    let result;
    try {
      result = runSuite();
    } finally {
      writeFileSync(abs, raw);
      originals.delete(m.file);
    }
    const n = String(from + i).padStart(2, '0');
    if (result.passed) {
      survivors.push(m.id);
      console.log(`${n} SURVIVED ${m.id}: ${m.what}`);
    } else if (result.infraDown || !result.assertionFailure) {
      // A failure that is not a failed assertion proves nothing about the guard: stop and say so.
      console.log(`${n} NOT COUNTED ${m.id}: the suite failed without a failed assertion (databases down, or a crash). Stopping.`);
      return 2;
    } else {
      killed += 1;
      console.log(`${n} killed   ${m.id}: ${m.what}`);
      console.log(`      first failing test: ${result.failing[0] ?? '(unnamed)'}`);
    }
  }
  console.log(`\n${killed} of ${slice.length} mutants killed, ${survivors.length} survived.`);
  if (survivors.length > 0) console.log(`survivors: ${survivors.join(', ')}`);
  return survivors.length > 0 ? 1 : 0;
}

try {
  process.exitCode = main();
} finally {
  restoreAll();
}
