import { Router } from 'express';
import { z } from 'zod';
import { ProjectService } from '../services/project-service.js';
import { getTaskService } from '../services/task-service.js';
import { createManagedListRouter } from './managed-list-routes.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('projects');

// Validation schemas
const createProjectSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

const updateProjectSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  isHidden: z.boolean().optional(),
});

// Create service instances
const taskService = getTaskService();
const projectService = new ProjectService(taskService);

// Initialize service
projectService.init().catch((err) => {
  log.error('Failed to initialize ProjectService:', err);
});

const baseRouter = createManagedListRouter(
  projectService,
  createProjectSchema,
  updateProjectSchema
);
const router = Router();

// Must come before /:id wildcard in baseRouter
router.get(
  '/enriched',
  asyncHandler(async (_req, res) => {
    const [projects, tasks] = await Promise.all([projectService.list(), taskService.listTasks()]);

    const enriched = projects.map((p) => {
      const projectTasks = tasks.filter((t) => t.project === p.id);
      const agents = [
        ...new Set(
          projectTasks.map((t) => t.agent).filter((a): a is string => !!a && a !== 'auto')
        ),
      ].sort();
      const statusCounts: Record<string, number> = {};
      for (const t of projectTasks) {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      }
      return { ...p, taskCount: projectTasks.length, agents, statusCounts };
    });

    res.json(enriched);
  })
);

router.use('/', baseRouter);

export default router;
