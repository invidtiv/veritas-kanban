import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../utils/api.js';
import { findTask } from '../utils/find.js';
import { formatDependencyGraph, formatTask } from '../utils/format.js';
import type { ResolvedTaskDependencies, Task, TaskDependencyGraph } from '../utils/types.js';

async function resolveTask(id: string): Promise<Task> {
  const task = await findTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }

  return task;
}

function printDependencyList(dependencies: ResolvedTaskDependencies): void {
  if (dependencies.depends_on.length === 0) {
    console.log(chalk.dim('Depends on: none'));
  } else {
    console.log(chalk.bold('Depends on'));
    dependencies.depends_on.forEach((task) => console.log(formatTask(task)));
  }

  console.log();

  if (dependencies.blocks.length === 0) {
    console.log(chalk.dim('Blocks: none'));
  } else {
    console.log(chalk.bold('Blocks'));
    dependencies.blocks.forEach((task) => console.log(formatTask(task)));
  }
}

export function registerDependencyCommands(program: Command): void {
  const dependency = program
    .command('dependency')
    .alias('dep')
    .description('Manage task dependencies');

  dependency
    .command('list <taskId>')
    .description('List upstream and downstream dependencies for a task')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      try {
        const task = await resolveTask(taskId);
        const dependencies = await api<ResolvedTaskDependencies>(
          `/api/tasks/${task.id}/dependencies`
        );

        if (options.json) {
          console.log(JSON.stringify(dependencies, null, 2));
        } else {
          printDependencyList(dependencies);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  dependency
    .command('add <taskId> <targetId>')
    .description('Add a dependency edge')
    .option('--blocks', 'Indicate that the current task blocks the target task')
    .option('--json', 'Output as JSON')
    .action(async (taskId, targetId, options) => {
      try {
        const task = await resolveTask(taskId);
        const target = await resolveTask(targetId);
        const body = options.blocks ? { blocks: target.id } : { depends_on: target.id };
        const updated = await api<Task>(`/api/tasks/${task.id}/dependencies`, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(
            chalk.green(
              options.blocks
                ? `✓ ${task.title} now blocks ${target.title}`
                : `✓ ${task.title} now depends on ${target.title}`
            )
          );
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  dependency
    .command('remove <taskId> <targetId>')
    .description('Remove a dependency edge')
    .option('--json', 'Output as JSON')
    .action(async (taskId, targetId, options) => {
      try {
        const task = await resolveTask(taskId);
        const target = await resolveTask(targetId);
        const updated = await api<Task>(`/api/tasks/${task.id}/dependencies/${target.id}`, {
          method: 'DELETE',
        });

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(
            chalk.green(`✓ Removed dependency between ${task.title} and ${target.title}`)
          );
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  dependency
    .command('graph <taskId>')
    .description('Show the recursive dependency graph for a task')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      try {
        const task = await resolveTask(taskId);
        const graph = await api<TaskDependencyGraph>(`/api/tasks/${task.id}/dependency-graph`);

        if (options.json) {
          console.log(JSON.stringify(graph, null, 2));
        } else {
          console.log(formatDependencyGraph(graph));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
