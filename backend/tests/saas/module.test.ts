import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { createSaasModule, loadSaasConfig, type SaasModule } from '../../src/saas/index.js';
import { pgQuery, runCli, urls, withDatabase } from './support/harness.js';
import { claimsFor, StandInKeyServer, TEST_PROJECT_ID } from './support/keyserver.js';

const DB = 'saas_module_check';
const dbUrl = withDatabase(urls.admin, DB);

let keyServer: StandInKeyServer;
let mod: SaasModule;
let base = '';
let close: () => Promise<void>;

describe('createSaasModule wires the real connections from the environment', () => {
  before(async () => {
    await pgQuery(urls.admin, `DROP DATABASE IF EXISTS ${DB}`);
    await pgQuery(urls.admin, `CREATE DATABASE ${DB}`);
    runCli(dbUrl, 'db:migrate');
    runCli(dbUrl, 'db:seed:all');

    keyServer = await StandInKeyServer.start();
    mod = await createSaasModule(
      loadSaasConfig({
        SAAS_DATABASE_URL: dbUrl,
        SAAS_REDIS_URL: `${urls.redis}/2`,
        SAAS_MONGO_URL: urls.mongo,
        SAAS_MONGO_DB: 'miniworld_saas_module_check',
        FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
        FIREBASE_JWK_URL: keyServer.url,
      }),
    );
    const app = express();
    app.use('/api/saas', mod.router);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/saas`;
    close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  });

  after(async () => {
    await close();
    await mod.close();
    await keyServer.close();
    await pgQuery(urls.admin, `DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  });

  it('serves a signed-in request end to end and refuses an unsigned one', async () => {
    const token = keyServer.sign(claimsFor('module-user'));
    const created = await fetch(`${base}/tenants`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Module Studio', slug: 'module-studio' }),
    });
    assert.equal(created.status, 201);
    const tenant = (await created.json()) as { id: string };

    const events = await mod.audit.listForTenant(tenant.id);
    assert.equal(events.length, 3);

    const anonymous = await fetch(`${base}/plans`);
    assert.equal(anonymous.status, 401);
  });

  it('refuses to start without its settings', () => {
    assert.throws(() => loadSaasConfig({}), /SAAS_DATABASE_URL is required/);
    assert.throws(() => loadSaasConfig({ SAAS_DATABASE_URL: 'x', SAAS_REDIS_URL: 'x', SAAS_MONGO_URL: 'x' }), /FIREBASE_PROJECT_ID is required/);
  });
});
