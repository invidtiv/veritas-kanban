import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { authorize, type AuthenticatedRequest } from '../middleware/auth.js';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { auditLog } from '../services/audit-service.js';
import { getAgentCredentialService } from '../services/agent-credential-service.js';

const router: RouterType = Router();

const createSchema = z.object({
  agentId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{2,49}$/, 'Use 3-50 lowercase letters, numbers, - or _'),
  label: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['agent', 'read-only']).optional().default('agent'),
});

router.use(authorize('admin'));

router.get('/', (_req, res) => {
  res.json(getAgentCredentialService().list());
});

router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid remote agent identity', parsed.error.issues);
    }

    let issued;
    try {
      issued = getAgentCredentialService().issue({
        ...parsed.data,
        createdBy: req.auth?.keyName || 'admin',
      });
    } catch (error) {
      if ((error as Error).message.startsWith('Agent ID already exists:')) {
        throw new ConflictError((error as Error).message);
      }
      throw error;
    }

    await auditLog({
      action: 'agent-credential.create',
      actor: req.auth?.keyName || 'admin',
      resource: `agent:${issued.agentId}`,
      details: { role: issued.role, keyPrefix: issued.keyPrefix },
    });
    res.status(201).json(issued);
  })
);

router.post(
  '/:agentId/rotate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const issued = getAgentCredentialService().rotate(req.params.agentId as string);
    if (!issued) throw new NotFoundError('Agent identity not found');

    await auditLog({
      action: 'agent-credential.rotate',
      actor: req.auth?.keyName || 'admin',
      resource: `agent:${issued.agentId}`,
      details: { keyPrefix: issued.keyPrefix },
    });
    res.json(issued);
  })
);

router.delete(
  '/:agentId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const revoked = getAgentCredentialService().revoke(req.params.agentId as string);
    if (!revoked) throw new NotFoundError('Agent identity not found');

    await auditLog({
      action: 'agent-credential.revoke',
      actor: req.auth?.keyName || 'admin',
      resource: `agent:${revoked.agentId}`,
    });
    res.json(revoked);
  })
);

export { router as agentCredentialRoutes };
