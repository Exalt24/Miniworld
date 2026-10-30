import express, { type NextFunction, type Request, type RequestHandler, type Response, Router } from 'express';
import { ZodError, z } from 'zod';
import { UniqueConstraintError } from 'sequelize';
import { AppError, forbidden } from './errors.js';
import { FirebaseTokenVerifier, TokenError } from './firebase.js';
import type { Role } from './models.js';
import type { Actor, SaasService, UserDto } from './service.js';

const uuid = z.uuid();
const subscriptionStatus = z.enum(['trialing', 'active', 'past_due', 'canceled']);

const schemas = {
  createTenant: z.strictObject({
    name: z.string().trim().min(1).max(120),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(48),
  }),
  addUser: z.strictObject({
    firebaseUid: z.string().min(1).max(128),
    email: z.email().max(254),
    role: z.enum(['admin', 'member']),
  }),
  changeSubscription: z
    .strictObject({ planCode: z.string().min(1).max(32).optional(), status: subscriptionStatus.optional() })
    .refine((v) => v.planCode !== undefined || v.status !== undefined, { message: 'planCode or status is required' }),
  createPlan: z.strictObject({
    code: z.string().regex(/^[a-z0-9_-]+$/).min(1).max(32),
    name: z.string().trim().min(1).max(80),
    maxMembers: z.number().int().min(1).max(100000),
    maxWorlds: z.number().int().min(0).max(100000),
    priceCents: z.number().int().min(0).max(100000000),
  }),
  updatePlan: z
    .strictObject({
      name: z.string().trim().min(1).max(80).optional(),
      maxMembers: z.number().int().min(1).max(100000).optional(),
      maxWorlds: z.number().int().min(0).max(100000).optional(),
      priceCents: z.number().int().min(0).max(100000000).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'at least one field is required' }),
};

const param = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? '';

interface Locals {
  actor: Actor;
  membership?: UserDto;
}

const locals = (res: Response) => res.locals as Locals;

/** The tenant the caller was verified to belong to; set by the membership check below. */
const tenantOf = (res: Response): string => locals(res).membership!.tenantId;

export function authenticate(verifier: FirebaseTokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization ?? '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: { code: 'missing_token', message: 'sign in first' } });
      return;
    }
    try {
      const claims = await verifier.verify(match[1]);
      locals(res).actor = {
        uid: claims.sub,
        email: typeof claims.email === 'string' ? claims.email : undefined,
        platformAdmin: claims.platform_admin === true,
      };
      next();
    } catch (err) {
      if (err instanceof TokenError) {
        res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
        res.status(401).json({ error: { code: 'invalid_token', reason: err.reason, message: err.message } });
        return;
      }
      next(err);
    }
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    const membership = locals(res).membership;
    if (!membership || !roles.includes(membership.role)) {
      next(forbidden(`requires one of: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}

const requirePlatformAdmin: RequestHandler = (_req, res, next) => {
  if (!locals(res).actor.platformAdmin) {
    next(forbidden('requires the platform_admin claim'));
    return;
  }
  next();
};

function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
  } else if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'request did not pass validation',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  } else if (err instanceof UniqueConstraintError) {
    res.status(409).json({ error: { code: 'already_exists', message: 'a record with those values already exists' } });
  } else if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'unreadable_body', message: 'request body could not be read' } });
  } else {
    console.error('saas: unhandled error', err);
    res.status(500).json({ error: { code: 'internal', message: 'internal error' } });
  }
}

export function createSaasRouter(service: SaasService, verifier: FirebaseTokenVerifier): Router {
  const router = Router();
  router.use(express.json({ limit: '32kb' }));
  router.use(authenticate(verifier));

  // Plans: readable by any signed-in user, writable by a platform admin.
  router.get('/plans', async (_req, res) => {
    res.json({ plans: await service.listPlans() });
  });
  router.post('/plans', requirePlatformAdmin, async (req, res) => {
    const body = schemas.createPlan.parse(req.body);
    res.status(201).json(await service.createPlan(locals(res).actor, body));
  });
  router.patch('/plans/:code', requirePlatformAdmin, async (req, res) => {
    const body = schemas.updatePlan.parse(req.body);
    res.json(await service.updatePlan(locals(res).actor, param(req.params.code), body));
  });

  // Tenants: any signed-in user can create one and becomes its owner.
  router.get('/tenants', async (_req, res) => {
    res.json({ tenants: await service.listTenantsFor(locals(res).actor.uid) });
  });
  router.post('/tenants', async (req, res) => {
    const body = schemas.createTenant.parse(req.body);
    res.status(201).json(await service.createTenant(locals(res).actor, body));
  });

  // Everything under /tenants/:tenantId needs membership of that tenant.
  const tenantScope = Router({ mergeParams: true });
  router.use(
    '/tenants/:tenantId',
    async (req, res, next) => {
      const tenantId = param(req.params.tenantId);
      if (!uuid.safeParse(tenantId).success) {
        next(new AppError(404, 'not_found', 'tenant not found'));
        return;
      }
      const membership = await service.getMembership(tenantId, locals(res).actor.uid);
      if (!membership) {
        next(forbidden('you are not a member of this tenant'));
        return;
      }
      locals(res).membership = membership;
      next();
    },
    tenantScope,
  );

  tenantScope.get('/', async (req, res) => {
    res.json(await service.getTenant(tenantOf(res)));
  });
  tenantScope.get('/subscription', async (req, res) => {
    res.json(await service.getSubscription(tenantOf(res)));
  });
  tenantScope.put('/subscription', requireRole('owner'), async (req, res) => {
    const body = schemas.changeSubscription.parse(req.body);
    res.json(await service.changeSubscription(locals(res).actor, tenantOf(res), body));
  });
  tenantScope.get('/users', async (req, res) => {
    res.json({ users: await service.listUsers(tenantOf(res)) });
  });
  tenantScope.post('/users', requireRole('owner', 'admin'), async (req, res) => {
    const body = schemas.addUser.parse(req.body);
    res.status(201).json(await service.addUser(locals(res).actor, tenantOf(res), body));
  });
  tenantScope.delete('/users/:userId', requireRole('owner', 'admin'), async (req, res) => {
    const userId = param(req.params.userId);
    if (!uuid.safeParse(userId).success) throw new AppError(404, 'not_found', 'user not found');
    await service.removeUser(locals(res).actor, tenantOf(res), userId);
    res.status(204).end();
  });
  tenantScope.get('/audit', requireRole('owner', 'admin'), async (req, res) => {
    res.json({ events: await service.listAudit(tenantOf(res)) });
  });

  router.use(errorHandler);
  return router;
}
