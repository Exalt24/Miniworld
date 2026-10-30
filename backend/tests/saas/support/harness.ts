import { spawnSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';
import pg from 'pg';
import { AuditLog } from '../../../src/saas/audit.js';
import { ReadThroughCache } from '../../../src/saas/cache.js';
import { FirebaseTokenVerifier, JwkKeyStore } from '../../../src/saas/firebase.js';
import { createSequelize, initModels } from '../../../src/saas/models.js';
import { createSaasRouter } from '../../../src/saas/routes.js';
import { SaasService } from '../../../src/saas/service.js';
import { claimsFor, StandInKeyServer, TEST_PROJECT_ID } from './keyserver.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Defaults match docker-compose.saas.yml; CI sets the same variables for its service containers. */
export const urls = {
  admin: process.env.SAAS_TEST_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/miniworld_saas',
  redis: process.env.SAAS_TEST_REDIS_URL ?? 'redis://127.0.0.1:56379',
  mongo: process.env.SAAS_TEST_MONGO_URL ?? 'mongodb://127.0.0.1:57017',
};

export function withDatabase(adminUrl: string, database: string): string {
  const u = new URL(adminUrl);
  u.pathname = `/${database}`;
  return u.toString();
}

/** Runs sequelize-cli (the real migrations and seeders) against a database URL. */
export function runCli(databaseUrl: string, ...args: string[]): string {
  const cli = path.join(backendDir, 'node_modules', 'sequelize-cli', 'lib', 'sequelize');
  const result = spawnSync(process.execPath, [cli, ...args, '--env', 'test'], {
    cwd: backendDir,
    env: { ...process.env, SAAS_DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`sequelize-cli ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

export async function pgQuery(url: string, sql: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

export interface Harness {
  baseUrl: string;
  keyServer: StandInKeyServer;
  models: ReturnType<typeof initModels>;
  service: SaasService;
  audit: AuditLog;
  redis: Redis;
  databaseUrl: string;
  token(uid: string, overrides?: Record<string, unknown>): string;
  call(method: string, route: string, opts?: { token?: string | null; body?: unknown; rawBody?: string }): Promise<{ status: number; body: any }>;
  auditCount(tenantId: string): Promise<number>;
  close(): Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  const databaseUrl = urls.admin;
  await pgQuery(databaseUrl, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  runCli(databaseUrl, 'db:migrate');
  runCli(databaseUrl, 'db:seed:all');

  const keyServer = await StandInKeyServer.start();
  const models = initModels(createSequelize(databaseUrl));

  const redis = new Redis(`${urls.redis}/1`, { maxRetriesPerRequest: 1 });
  await redis.flushdb();

  const mongo = await new MongoClient(urls.mongo).connect();
  const db = mongo.db('miniworld_saas_test');
  await db.dropDatabase();
  const audit = new AuditLog(db);
  await audit.init();

  const service = new SaasService(models, new ReadThroughCache(redis, 300), audit);
  const verifier = new FirebaseTokenVerifier({
    projectId: TEST_PROJECT_ID,
    keys: new JwkKeyStore(keyServer.url, { minRefetchMs: 0 }),
  });

  const app = express();
  app.use('/api/saas', createSaasRouter(service, verifier));
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/saas`;

  return {
    baseUrl,
    keyServer,
    models,
    service,
    audit,
    redis,
    databaseUrl,
    token: (uid, overrides = {}) => keyServer.sign(claimsFor(uid, overrides)),
    async call(method, route, opts = {}) {
      const headers: Record<string, string> = {};
      if (opts.token) headers.authorization = `Bearer ${opts.token}`;
      let body: string | undefined;
      if (opts.rawBody !== undefined) {
        body = opts.rawBody;
        headers['content-type'] = 'application/json';
      } else if (opts.body !== undefined) {
        body = JSON.stringify(opts.body);
        headers['content-type'] = 'application/json';
      }
      const res = await fetch(`${baseUrl}${route}`, { method, headers, body });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    auditCount: async (tenantId) => (await audit.listForTenant(tenantId, 1000)).length,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await keyServer.close();
      await Promise.allSettled([models.sequelize.close(), redis.quit(), mongo.close()]);
    },
  };
}
