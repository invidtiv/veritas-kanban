import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../utils/api.js';
import { findTask } from '../utils/find.js';
import { formatTask, formatTaskDetails, formatTaskJson, formatTasksJson } from '../utils/format.js';
import type {
  ActivityEntry,
  ResolvedTaskDependencies,
  Task,
  TaskInspection,
} from '../utils/types.js';

function buildTaskListUrl(options: Record<string, unknown>): string {
  const params = new URLSearchParams();
  const assignedTo = String(options.assignedTo || options.agent || '').trim();
  const createdBy = String(options.createdBy || '').trim();
  const search = String(options.search || '').trim();

  if (options.status) {
    params.append('status', String(options.status));
  }
  if (options.type) {
    params.append('type', String(options.type));
  }
  if (options.project) {
    params.append('project', String(options.project));
  }
  if (options.sprint) {
    params.append('sprint', String(options.sprint));
  }
  if (assignedTo) {
    params.append('agent', assignedTo);
  }
  if (createdBy) {
    params.append('createdBy', createdBy);
  }
  if (search) {
    params.append('search', search);
  }

  return `/api/tasks${params.toString() ? `?${params.toString()}` : ''}`;
}

async function resolveTask(id: string): Promise<Task> {
  const task = await findTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }

  return task;
}

async function fetchDependencies(taskId: string): Promise<ResolvedTaskDependencies> {
  return api<ResolvedTaskDependencies>(`/api/tasks/${taskId}/dependencies`);
}

async function fetchActivity(taskId: string, limit = 20): Promise<ActivityEntry[]> {
  const params = new URLSearchParams({
    taskId,
    limit: String(limit),
  });
  return api<ActivityEntry[]>(`/api/activity?${params.toString()}`);
}

async function fetchTaskInspection(taskId: string, activityLimit = 20): Promise<TaskInspection> {
  const [task, dependencies, activity] = await Promise.all([
    api<Task>(`/api/tasks/${taskId}`),
    fetchDependencies(taskId),
    fetchActivity(taskId, activityLimit),
  ]);

  return { task, dependencies, activity };
}

async function patchTask(taskId: string, updates: Record<string, unknown>): Promise<Task> {
  return api<Task>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

function resolveClaimAgent(options: Record<string, unknown>): string | undefined {
  const explicit = String(options.agent || options.assignedTo || '').trim();
  if (explicit) {
    return explicit;
  }

  return (
    process.env.VK_AGENT_NAME ||
    process.env.VERITAS_AGENT_NAME ||
    process.env.OPENCLAW_AGENT_NAME ||
    process.env.USER
  );
}

export function registerTaskCommands(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List tasks')
    .option('-s, --status <status>', 'Filter by status (todo, in-progress, blocked, done)')
    .option('-t, --type <type>', 'Filter by type (code, research, content, automation)')
    .option('-p, --project <project>', 'Filter by project')
    .option('-S, --sprint <sprint>', 'Filter by sprint')
    .option('-a, --agent <agent>', 'Filter by assigned agent (legacy alias for --assigned-to)')
    .option('--assigned-to <agent>', 'Filter by assigned agent')
    .option('--created-by <agent>', 'Filter by task creator')
    .option('--search <query>', 'Search task title and description')
    .option('-v, --verbose', 'Show more details')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const tasks = await api<Task[]>(buildTaskListUrl(options));

        if (options.json) {
          console.log(formatTasksJson(tasks));
        } else if (tasks.length === 0) {
          console.log(chalk.dim('No tasks found'));
        } else {
          tasks.forEach((task: Task) => console.log(formatTask(task, options.verbose)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('show <id>')
    .description('Show task details')
    .option('--json', 'Output raw task JSON')
    .action(async (id, options) => {
      try {
        const task = await resolveTask(id);

        if (options.json) {
          console.log(formatTaskJson(task));
          return;
        }

        const dependencies = await fetchDependencies(task.id);
        console.log(formatTaskDetails(task, { dependencies }));
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('describe <id>')
    .alias('inspect')
    .description('Show a full task dossier including dependencies and activity')
    .option('--activity-limit <n>', 'Limit activity entries in output', '20')
    .option('--json', 'Output aggregated inspection JSON')
    .action(async (id, options) => {
      try {
        const task = await resolveTask(id);
        const activityLimit = Math.max(
          1,
          parseInt(String(options.activityLimit || '20'), 10) || 20
        );
        const inspection = await fetchTaskInspection(task.id, activityLimit);

        if (options.json) {
          console.log(JSON.stringify(inspection, null, 2));
          return;
        }

        console.log(
          formatTaskDetails(inspection.task, {
            dependencies: inspection.dependencies,
            activity: inspection.activity,
            activityLimit,
            includeActivity: true,
          })
        );
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('create <title>')
    .description('Create a new task')
    .option('-t, --type <type>', 'Task type (code, research, content, automation)', 'code')
    .option('-p, --project <project>', 'Project name')
    .option('-S, --sprint <sprint>', 'Sprint name or ID')
    .option('-d, --description <desc>', 'Task description')
    .option('--priority <priority>', 'Priority (low, medium, high)', 'medium')
    .option('-a, --agent <agent>', 'Assign to agent (legacy alias for --assigned-to)')
    .option('--assigned-to <agent>', 'Assign to agent')
    .option('--json', 'Output as JSON')
    .action(async (title, options) => {
      try {
        const assignedTo = String(options.assignedTo || options.agent || '').trim();
        const body: Record<string, unknown> = {
          title,
          type: options.type,
          project: options.project,
          sprint: options.sprint,
          description: options.description || '',
          priority: options.priority,
        };

        if (assignedTo) {
          body.agent = assignedTo;
        }

        const task = await api<Task>('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(body),
        });

        if (options.json) {
          console.log(formatTaskJson(task));
        } else {
          console.log(chalk.green('✓ Task created'));
          console.log(formatTask(task, true));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('update <id>')
    .description('Update a task')
    .option('-s, --status <status>', 'New status')
    .option('-t, --type <type>', 'New type')
    .option('-p, --project <project>', 'New project')
    .option('-S, --sprint <sprint>', 'Sprint name or ID')
    .option('--priority <priority>', 'New priority')
    .option('-a, --agent <agent>', 'Assign to agent (legacy alias for --assigned-to)')
    .option('--assigned-to <agent>', 'Assign to agent')
    .option('--unassign', 'Clear explicit assignment and return task to auto routing')
    .option('--title <title>', 'New title')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const existing = await resolveTask(id);
        const updates: Record<string, unknown> = {};
        const assignedTo = String(options.assignedTo || options.agent || '').trim();

        if (options.status) updates.status = options.status;
        if (options.type) updates.type = options.type;
        if (options.project) updates.project = options.project;
        if (options.sprint) updates.sprint = options.sprint;
        if (options.priority) updates.priority = options.priority;
        if (options.title) updates.title = options.title;
        if (options.unassign) {
          updates.agent = 'auto';
        } else if (assignedTo) {
          updates.agent = assignedTo;
        }

        if (Object.keys(updates).length === 0) {
          console.error(chalk.yellow('No updates specified'));
          process.exit(1);
        }

        const task = await patchTask(existing.id, updates);

        if (options.json) {
          console.log(formatTaskJson(task));
        } else {
          console.log(chalk.green('✓ Task updated'));
          console.log(formatTask(task, true));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('assign <id> <agent>')
    .description('Assign or reassign a task to a specific agent')
    .option('--json', 'Output as JSON')
    .action(async (id, agent, options) => {
      try {
        const task = await resolveTask(id);
        const updated = await patchTask(task.id, { agent });

        if (options.json) {
          console.log(formatTaskJson(updated));
        } else {
          console.log(chalk.green(`✓ Assigned to ${agent}`));
          console.log(formatTask(updated, true));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('unassign <id>')
    .description('Clear explicit assignment and return a task to auto routing')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const task = await resolveTask(id);
        const updated = await patchTask(task.id, { agent: 'auto' });

        if (options.json) {
          console.log(formatTaskJson(updated));
        } else {
          console.log(chalk.green('✓ Task returned to auto routing'));
          console.log(formatTask(updated, true));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('claim <id>')
    .description('Claim a task for the current agent identity')
    .option('-a, --agent <agent>', 'Agent slug to claim with')
    .option('--assigned-to <agent>', 'Agent slug to claim with')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const agent = resolveClaimAgent(options);
        if (!agent) {
          console.error(
            chalk.red(
              'No agent identity available. Pass --agent or set VK_AGENT_NAME / VERITAS_AGENT_NAME.'
            )
          );
          process.exit(1);
        }

        const task = await resolveTask(id);
        const updated = await patchTask(task.id, { agent });

        if (options.json) {
          console.log(formatTaskJson(updated));
        } else {
          console.log(chalk.green(`✓ Claimed by ${agent}`));
          console.log(formatTask(updated, true));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('archive <id>')
    .description('Archive a completed task')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const task = await resolveTask(id);

        await api(`/api/tasks/${task.id}/archive`, { method: 'POST' });

        if (options.json) {
          console.log(JSON.stringify({ archived: true }, null, 2));
        } else {
          console.log(chalk.green('✓ Task archived'));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command('delete <id>')
    .description('Delete a task')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const task = await resolveTask(id);

        await api(`/api/tasks/${task.id}`, { method: 'DELETE' });

        if (options.json) {
          console.log(JSON.stringify({ deleted: true }, null, 2));
        } else {
          console.log(chalk.green('✓ Task deleted'));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
