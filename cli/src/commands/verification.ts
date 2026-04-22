import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../utils/api.js';
import { findTask } from '../utils/find.js';
import type { Task, VerificationStep } from '../utils/types.js';

async function resolveTask(id: string): Promise<Task> {
  const task = await findTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }

  return task;
}

function resolveStep(task: Task, id: string): VerificationStep {
  const steps = task.verificationSteps || [];
  const exact = steps.find((step) => step.id === id);
  if (exact) {
    return exact;
  }

  const matches = steps.filter((step) => step.id.endsWith(id));
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`Multiple verification steps match: ${id}`);
  }

  throw new Error(`Verification step not found: ${id}`);
}

function renderStep(step: VerificationStep): string {
  return `${step.checked ? chalk.green('[x]') : chalk.dim('[ ]')} ${step.description} ${chalk.dim(`#${step.id.slice(-8)}`)}`;
}

export function registerVerificationCommands(program: Command): void {
  const verify = program.command('verify').description('Manage task verification steps');

  verify
    .command('list <taskId>')
    .description('List verification steps for a task')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      try {
        const task = await resolveTask(taskId);
        const steps = task.verificationSteps || [];

        if (options.json) {
          console.log(JSON.stringify(steps, null, 2));
        } else if (steps.length === 0) {
          console.log(chalk.dim('No verification steps'));
        } else {
          steps.forEach((step) => console.log(renderStep(step)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  verify
    .command('add <taskId> <description>')
    .description('Add a verification step to a task')
    .option('--json', 'Output as JSON')
    .action(async (taskId, description, options) => {
      try {
        const task = await resolveTask(taskId);
        const updated = await api<Task>(`/api/tasks/${task.id}/verification`, {
          method: 'POST',
          body: JSON.stringify({ description }),
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          const latest = updated.verificationSteps?.[updated.verificationSteps.length - 1];
          console.log(chalk.green('✓ Verification step added'));
          if (latest) {
            console.log(renderStep(latest));
          }
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  verify
    .command('check <taskId> <stepId>')
    .description('Mark a verification step complete')
    .option('--json', 'Output as JSON')
    .action(async (taskId, stepId, options) => {
      try {
        const task = await resolveTask(taskId);
        const step = resolveStep(task, stepId);
        const updated = await api<Task>(`/api/tasks/${task.id}/verification/${step.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ checked: true }),
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(chalk.green('✓ Verification step completed'));
          console.log(renderStep(resolveStep(updated, step.id)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  verify
    .command('uncheck <taskId> <stepId>')
    .description('Mark a verification step incomplete')
    .option('--json', 'Output as JSON')
    .action(async (taskId, stepId, options) => {
      try {
        const task = await resolveTask(taskId);
        const step = resolveStep(task, stepId);
        const updated = await api<Task>(`/api/tasks/${task.id}/verification/${step.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ checked: false }),
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(chalk.green('✓ Verification step reopened'));
          console.log(renderStep(resolveStep(updated, step.id)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  verify
    .command('delete <taskId> <stepId>')
    .description('Delete a verification step')
    .option('--json', 'Output as JSON')
    .action(async (taskId, stepId, options) => {
      try {
        const task = await resolveTask(taskId);
        const step = resolveStep(task, stepId);
        const updated = await api<Task>(`/api/tasks/${task.id}/verification/${step.id}`, {
          method: 'DELETE',
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(chalk.green(`✓ Deleted verification step: ${step.description}`));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
