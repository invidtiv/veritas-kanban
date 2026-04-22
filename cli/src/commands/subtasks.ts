import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../utils/api.js';
import { findTask } from '../utils/find.js';
import type { Subtask, Task } from '../utils/types.js';

function collectValues(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

async function resolveTask(id: string): Promise<Task> {
  const task = await findTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }

  return task;
}

function resolveSubtask(task: Task, id: string): Subtask {
  const subtasks = task.subtasks || [];
  const exact = subtasks.find((subtask) => subtask.id === id);
  if (exact) {
    return exact;
  }

  const matches = subtasks.filter((subtask) => subtask.id.endsWith(id));
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`Multiple subtasks match: ${id}`);
  }

  throw new Error(`Subtask not found: ${id}`);
}

function renderSubtask(subtask: Subtask): string {
  const lines = [
    `${subtask.completed ? chalk.green('[x]') : chalk.dim('[ ]')} ${subtask.title} ${chalk.dim(`#${subtask.id.slice(-8)}`)}`,
  ];

  subtask.acceptanceCriteria?.forEach((criterion, index) => {
    const checked = subtask.criteriaChecked?.[index] ?? false;
    lines.push(`  ${checked ? chalk.green('[x]') : chalk.dim('[ ]')} ${criterion}`);
  });

  return lines.join('\n');
}

export function registerSubtaskCommands(program: Command): void {
  const subtask = program.command('subtask').description('Manage task subtasks');

  subtask
    .command('list <taskId>')
    .description('List subtasks for a task')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      try {
        const task = await resolveTask(taskId);
        const subtasks = task.subtasks || [];

        if (options.json) {
          console.log(JSON.stringify(subtasks, null, 2));
        } else if (subtasks.length === 0) {
          console.log(chalk.dim('No subtasks'));
        } else {
          subtasks.forEach((item) => console.log(renderSubtask(item)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  subtask
    .command('add <taskId> <title>')
    .description('Add a subtask to a task')
    .option(
      '-c, --criterion <text>',
      'Acceptance criterion to attach to the subtask (repeatable)',
      collectValues,
      [] as string[]
    )
    .option('--json', 'Output as JSON')
    .action(async (taskId, title, options) => {
      try {
        const task = await resolveTask(taskId);
        const updated = await api<Task>(`/api/tasks/${task.id}/subtasks`, {
          method: 'POST',
          body: JSON.stringify({
            title,
            acceptanceCriteria: options.criterion.length ? options.criterion : undefined,
          }),
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          const latest = updated.subtasks?.[updated.subtasks.length - 1];
          console.log(chalk.green('✓ Subtask added'));
          if (latest) {
            console.log(renderSubtask(latest));
          }
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  subtask
    .command('check <taskId> <subtaskId>')
    .description('Mark a subtask complete')
    .option('--json', 'Output as JSON')
    .action(async (taskId, subtaskId, options) => {
      try {
        const task = await resolveTask(taskId);
        const subtask = resolveSubtask(task, subtaskId);
        const updated = await api<Task>(`/api/tasks/${task.id}/subtasks/${subtask.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ completed: true }),
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(chalk.green('✓ Subtask completed'));
          console.log(renderSubtask(resolveSubtask(updated, subtask.id)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  subtask
    .command('uncheck <taskId> <subtaskId>')
    .description('Mark a subtask incomplete')
    .option('--json', 'Output as JSON')
    .action(async (taskId, subtaskId, options) => {
      try {
        const task = await resolveTask(taskId);
        const subtask = resolveSubtask(task, subtaskId);
        const updated = await api<Task>(`/api/tasks/${task.id}/subtasks/${subtask.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ completed: false }),
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(chalk.green('✓ Subtask reopened'));
          console.log(renderSubtask(resolveSubtask(updated, subtask.id)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  subtask
    .command('criterion <taskId> <subtaskId> <index>')
    .description('Toggle a subtask acceptance criterion by zero-based index')
    .option('--json', 'Output as JSON')
    .action(async (taskId, subtaskId, index, options) => {
      try {
        const task = await resolveTask(taskId);
        const subtask = resolveSubtask(task, subtaskId);
        const updated = await api<Task>(
          `/api/tasks/${task.id}/subtasks/${subtask.id}/criteria/${index}`,
          {
            method: 'PATCH',
          }
        );

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(chalk.green('✓ Criterion toggled'));
          console.log(renderSubtask(resolveSubtask(updated, subtask.id)));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  subtask
    .command('delete <taskId> <subtaskId>')
    .description('Delete a subtask')
    .option('--json', 'Output as JSON')
    .action(async (taskId, subtaskId, options) => {
      try {
        const task = await resolveTask(taskId);
        const subtask = resolveSubtask(task, subtaskId);
        const updated = await api<Task>(`/api/tasks/${task.id}/subtasks/${subtask.id}`, {
          method: 'DELETE',
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(chalk.green(`✓ Deleted subtask: ${subtask.title}`));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
