import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';
import { AuditLog } from './audit.js';
import { ReadThroughCache } from './cache.js';
import { loadSaasConfig, type SaasConfig } from './config.js';
import { FirebaseTokenVerifier, JwkKeyStore } from './firebase.js';
import { createSequelize, initModels } from './models.js';
import { createSaasRouter } from './routes.js';
import { SaasService } from './service.js';

export interface SaasModule {
  router: ReturnType<typeof createSaasRouter>;
  service: SaasService;
  audit: AuditLog;
  close(): Promise<void>;
}

/** Connects Postgres (Sequelize), Redis and MongoDB and builds the router. Nothing connects at import time. */
export async function createSaasModule(config: SaasConfig = loadSaasConfig()): Promise<SaasModule> {
  const models = initModels(createSequelize(config.databaseUrl));
  await models.sequelize.authenticate();

  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  const mongo = await new MongoClient(config.mongoUrl).connect();
  const audit = new AuditLog(mongo.db(config.mongoDb));
  await audit.init();

  const cache = new ReadThroughCache(redis, config.planCacheTtlSeconds);
  const service = new SaasService(models, cache, audit);
  const verifier = new FirebaseTokenVerifier({
    projectId: config.firebaseProjectId,
    keys: new JwkKeyStore(config.firebaseJwkUrl),
  });

  return {
    router: createSaasRouter(service, verifier),
    service,
    audit,
    async close() {
      await Promise.allSettled([models.sequelize.close(), mongo.close(), redis.quit()]);
    },
  };
}

export { loadSaasConfig } from './config.js';
export type { SaasConfig } from './config.js';
