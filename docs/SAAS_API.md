---
type: reference
updated: 2026-10-30
---

*The multi-tenant account layer of the MiniWorld backend: tenants, plans and subscriptions in Postgres, a Redis plan cache, a MongoDB audit log and Firebase Auth ID token verification.*

## Why this repo

Two public repos had a Node, Express and Postgres backend that could take this layer: MiniWorld and NFT-Trading. NFT-Trading already runs every query through Prisma 7 with its own schema and migration flow, so adding Sequelize models there would have put a second ORM over the same database. MiniWorld's backend talks to Postgres through plain `pg` and hand-written SQL migrations, has no ORM, and had no automated tests, so the Sequelize models and `sequelize-cli` migrations arrive as the first ORM layer and the first suite, in their own tables and their own migration folder. The repo also already has a creator dashboard, the surface a studio running worlds would sign in to, so tenants (studios), their members and a plan with a subscription are the account layer that dashboard sits on. The layer is off unless `SAAS_ENABLED=true`, so the game indexer starts exactly as before.

## What it does

| Piece | Where | What it holds |
|-------|-------|---------------|
| Models and migrations | `backend/src/saas/models.ts`, `backend/saas-migrations/` | `plans`, `tenants`, `users`, `subscriptions` with foreign keys, a unique `(tenant_id, firebase_uid)` and check constraints on roles, statuses and limits |
| Routes | `backend/src/saas/routes.ts` | REST under `/api/saas`, request validation with zod, one error handler |
| Business rules | `backend/src/saas/service.ts` | Tenant scoping on every query, plan limits, role checks, audit writes, cache invalidation |
| Plan cache | `backend/src/saas/cache.ts` | Redis read-through cache with a TTL, deleted when a plan changes |
| Audit log | `backend/src/saas/audit.ts` | MongoDB collection `audit_events`, insert and read only |
| Token check | `backend/src/saas/firebase.ts` | Firebase Auth ID token verification against Google's published signing keys |

### Data model

A `plan` is global (code, name, member limit, world limit, price). A `tenant` has one `subscription` (a plan and a status of `trialing`, `active`, `past_due` or `canceled`) and many `users`. A user row is a Firebase uid inside one tenant with a role of `owner`, `admin` or `member`; the same person can belong to several tenants. Every query on a tenant-owned table carries the tenant id in its `where` clause.

### Routes

All routes need `Authorization: Bearer <Firebase ID token>`.

| Route | Who | Does |
|-------|-----|------|
| `GET /plans` | any signed-in user | lists plans |
| `POST /plans`, `PATCH /plans/:code` | platform admin (token claim `platform_admin`) | creates or changes a plan; a change deletes the Redis entries |
| `GET /tenants`, `POST /tenants` | any signed-in user | lists your tenants, or creates one (you become its owner, on the free plan in trial) |
| `GET /tenants/:id` | member | tenant details |
| `GET /tenants/:id/subscription` | member | subscription with its plan (plan read through Redis) |
| `PUT /tenants/:id/subscription` | owner | changes plan or status; refuses a plan smaller than the member count |
| `GET /tenants/:id/users` | member | lists members |
| `POST /tenants/:id/users` | owner or admin | adds an admin or member; refuses past the plan's member limit or on a canceled or past due subscription |
| `DELETE /tenants/:id/users/:userId` | owner or admin | removes a member; an owner cannot be removed |
| `GET /tenants/:id/audit` | owner or admin | the tenant's audit events, newest first |

A caller who is not a member of `:id` gets 403 on every one of these. A malformed id gets 404.

### Token verification

`firebase.ts` follows the rules in the Firebase Admin docs for verifying an ID token with a third-party JWT library: the header algorithm is `RS256` and its `kid` names a current Google key; `exp` is in the future; `iat` and `auth_time` are in the past (5 seconds of drift allowed); `aud` is the Firebase project id; `iss` is `https://securetoken.google.com/<project id>`; `sub` is a non-empty string up to 128 characters; and the signature verifies against the key for that `kid`. Keys come from the JWK endpoint Google publishes for `securetoken@system.gserviceaccount.com`, are cached for the response's `Cache-Control` max-age, and an unknown `kid` triggers one refetch, throttled to one per 10 seconds so bad tokens cannot flood the key server.

### Audit log

Every successful change appends one event to MongoDB (`tenant.created`, `subscription.created`, `subscription.changed`, `user.added`, `user.removed`, `plan.created`, `plan.updated`) with the actor's uid, the entity, and its state before and after. The `AuditLog` class has `append` and `listForTenant` and no update or delete, and a unique index on `eventId` makes a replayed event fail. The append happens inside the Postgres transaction, just before commit, so a change that is refused or fails earlier leaves no event.

## Run it

```bash
docker compose -f docker-compose.saas.yml up -d --wait     # Postgres 55432, Redis 56379, MongoDB 57017

cd backend
npm ci
cp .env.example .env        # set SAAS_ENABLED=true and FIREBASE_PROJECT_ID
SAAS_DATABASE_URL=postgres://postgres:postgres@localhost:55432/miniworld_saas npm run saas:migrate
SAAS_DATABASE_URL=postgres://postgres:postgres@localhost:55432/miniworld_saas npm run saas:seed
npm run dev
```

The seeder adds three plans (`free`, `pro`, `scale`). Environment variables: `SAAS_ENABLED`, `SAAS_DATABASE_URL`, `SAAS_REDIS_URL`, `SAAS_MONGO_URL`, `SAAS_MONGO_DB`, `FIREBASE_PROJECT_ID`, and optionally `FIREBASE_JWK_URL` and `SAAS_PLAN_CACHE_TTL`.

## Tests

```bash
cd backend
npm test                 # the three suites, against the compose databases
npm run test:mutation    # deletes each guard in turn; a test must fail each time
```

- `tests/saas/firebase.test.ts`: the token rules and the key cache, against a stand-in key server (`tests/saas/support/keyserver.ts`) that serves a JWK set of keys it generated itself.
- `tests/saas/api.test.ts`: the same token cases over HTTP, tenant isolation on every route, roles, plan limits (including concurrent adds), validation, the Redis cache and the audit log, against real Postgres, Redis and MongoDB.
- `tests/saas/migrations.test.ts`: the real `sequelize-cli` migrations up, their constraints, and `undo:all`.
- `scripts/saas-mutation-check.ts`: 51 mutants, each a one-line deletion or weakening of a guard.

Run logs are in `docs/test-runs/`.
