import { Router } from 'express';
import type { AgentPolicy, PolicyEvaluationRequest } from '@veritas-kanban/shared';
import { getPolicyService } from '../services/policy-service.js';
import {
  policyEvaluationSchema,
  policyParamsSchema,
  policySchema,
} from '../schemas/policy-schemas.js';
import { validate, type ValidatedRequest } from '../middleware/validate.js';

const router = Router();
const policyService = getPolicyService();

router.get('/', async (_req, res) => {
  const policies = await policyService.listPolicies();
  res.json(policies);
});

router.post(
  '/',
  validate({ body: policySchema }),
  async (req: ValidatedRequest<unknown, unknown, AgentPolicy>, res) => {
    const policy = await policyService.createPolicy(req.validated.body as AgentPolicy);
    res.status(201).json(policy);
  }
);

router.put(
  '/:id',
  validate({ params: policyParamsSchema, body: policySchema }),
  async (req: ValidatedRequest<{ id: string }, unknown, AgentPolicy>, res) => {
    const { id } = req.validated.params as { id: string };
    const policy = await policyService.updatePolicy(id, req.validated.body as AgentPolicy);
    res.json(policy);
  }
);

router.delete(
  '/:id',
  validate({ params: policyParamsSchema }),
  async (req: ValidatedRequest<{ id: string }>, res) => {
    const { id } = req.validated.params as { id: string };
    await policyService.deletePolicy(id);
    res.json({ deleted: id });
  }
);

router.post(
  '/evaluate',
  validate({ body: policyEvaluationSchema }),
  async (req: ValidatedRequest<unknown, unknown, PolicyEvaluationRequest>, res) => {
    const result = await policyService.evaluatePolicies(
      req.validated.body as PolicyEvaluationRequest
    );
    res.json(result);
  }
);

export default router;
