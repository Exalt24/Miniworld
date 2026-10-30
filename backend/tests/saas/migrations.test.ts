import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { pgQuery, runCli, urls, withDatabase } from './support/harness.js';

const DB = 'saas_migration_check';
const url = withDatabase(urls.admin, DB);

describe('sequelize-cli migrations', () => {
  before(async () => {
    await pgQuery(urls.admin, `DROP DATABASE IF EXISTS ${DB}`);
    await pgQuery(urls.admin, `CREATE DATABASE ${DB}`);
  });
  after(async () => {
    await pgQuery(urls.admin, `DROP DATABASE IF EXISTS ${DB}`);
  });

  it('creates the four tables and seeds the default plans', async () => {
    runCli(url, 'db:migrate');
    runCli(url, 'db:seed:all');
    const tables = await pgQuery(url, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1");
    assert.deepEqual(tables.rows.map((r) => r.table_name), ['SequelizeMeta', 'plans', 'subscriptions', 'tenants', 'users']);
    const plans = await pgQuery(url, 'SELECT code FROM plans ORDER BY price_cents');
    assert.deepEqual(plans.rows.map((r) => r.code), ['free', 'pro', 'scale']);
  });

  it('enforces the constraints the models rely on', async () => {
    const tenant = await pgQuery(url, "INSERT INTO tenants (slug, name) VALUES ('acme', 'Acme') RETURNING id");
    const tenantId = tenant.rows[0].id;
    await pgQuery(url, "INSERT INTO users (tenant_id, firebase_uid, email, role) VALUES ($1, 'u1', 'u1@example.test', 'owner')", [tenantId]);

    await assert.rejects(pgQuery(url, "INSERT INTO users (tenant_id, firebase_uid, email, role) VALUES ($1, 'u1', 'u1@example.test', 'member')", [tenantId]), /users_tenant_uid_unique/);
    await assert.rejects(pgQuery(url, "INSERT INTO users (tenant_id, firebase_uid, email, role) VALUES ($1, 'u2', 'u2@example.test', 'god')", [tenantId]), /users_role_known/);
    await assert.rejects(pgQuery(url, "INSERT INTO users (tenant_id, firebase_uid, email, role) VALUES (gen_random_uuid(), 'u3', 'u3@example.test', 'member')"), /foreign key/);
    await assert.rejects(pgQuery(url, "INSERT INTO plans (code, name, max_members, max_worlds, price_cents) VALUES ('bad', 'Bad', 0, 0, 0)"), /plans_limits_nonnegative/);

    const plan = await pgQuery(url, "SELECT id FROM plans WHERE code = 'free'");
    await pgQuery(url, "INSERT INTO subscriptions (tenant_id, plan_id, status) VALUES ($1, $2, 'active')", [tenantId, plan.rows[0].id]);
    await assert.rejects(pgQuery(url, "INSERT INTO subscriptions (tenant_id, plan_id, status) VALUES ($1, $2, 'active')", [tenantId, plan.rows[0].id]), /subscriptions_tenant_id_key|unique/);
    await assert.rejects(pgQuery(url, "UPDATE subscriptions SET status = 'weird' WHERE tenant_id = $1", [tenantId]), /subscriptions_status_known/);
  });

  it('removes tenant rows with the tenant, and rolls back cleanly', async () => {
    await pgQuery(url, "DELETE FROM tenants WHERE slug = 'acme'");
    const left = await pgQuery(url, 'SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM subscriptions) AS subs');
    assert.deepEqual(left.rows[0], { users: 0, subs: 0 });

    runCli(url, 'db:migrate:undo:all');
    const tables = await pgQuery(url, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1");
    assert.deepEqual(tables.rows.map((r) => r.table_name), ['SequelizeMeta']);
  });
});
