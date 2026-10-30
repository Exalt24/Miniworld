export interface SaasConfig {
  databaseUrl: string;
  redisUrl: string;
  mongoUrl: string;
  mongoDb: string;
  firebaseProjectId: string;
  firebaseJwkUrl: string;
  planCacheTtlSeconds: number;
}

/** The URL Google publishes the Firebase ID token signing keys at (JWK form). */
export const FIREBASE_JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required when the SaaS layer is enabled`);
  return value;
}

export function loadSaasConfig(env: NodeJS.ProcessEnv = process.env): SaasConfig {
  return {
    databaseUrl: required(env, 'SAAS_DATABASE_URL'),
    redisUrl: required(env, 'SAAS_REDIS_URL'),
    mongoUrl: required(env, 'SAAS_MONGO_URL'),
    mongoDb: env.SAAS_MONGO_DB || 'miniworld_saas',
    firebaseProjectId: required(env, 'FIREBASE_PROJECT_ID'),
    firebaseJwkUrl: env.FIREBASE_JWK_URL || FIREBASE_JWK_URL,
    planCacheTtlSeconds: parseInt(env.SAAS_PLAN_CACHE_TTL || '300', 10),
  };
}
