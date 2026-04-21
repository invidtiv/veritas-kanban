import chalk from 'chalk';
import type { Task } from './types.js';

export function formatTask(task: Task, verbose = false): string {
  const statusColors: Record<string, (s: string) => string> = {
    todo: chalk.gray,
    'in-progress': chalk.yellow,
    blocked: chalk.red,
    done: chalk.green,
  };

  const priorityColors: Record<string, (s: string) => string> = {
    low: chalk.dim,
    medium: chalk.white,
    high: chalk.red,
  };

  const typeIcons: Record<string, string> = {
    code: '💻',
    research: '🔍',
    content: '📝',
    automation: '⚡',
  };

  const statusColor = statusColors[task.status] || chalk.white;
  const priorityColor = priorityColors[task.priority] || chalk.white;

  let line = `${typeIcons[task.type] || '•'} ${chalk.cyan(task.id.slice(-8))} `;
  line += statusColor(`[${task.status}]`) + ' ';
  line += priorityColor(`(${task.priority})`) + ' ';
  line += chalk.bold(task.title);

  if (task.project) {
    line += chalk.dim(` #${task.project}`);
  }

  if (task.agent && task.agent !== 'auto') {
    line += chalk.magenta(` @${task.agent}`);
  }

  if (verbose) {
    line += '\n';
    if (task.description) {
      line += chalk.dim(
        `   ${task.description.slice(0, 80)}${task.description.length > 80 ? '...' : ''}\n`
      );
    }
    if (task.git?.branch) {
      line += chalk.dim(`   🌿 ${task.git.branch}\n`);
    }
    if (task.attempt?.status === 'running') {
      line += chalk.yellow(`   🤖 Agent running (${task.attempt.agent})\n`);
    }
    if (task.review?.decision) {
      const decisionColors: Record<string, (s: string) => string> = {
        approved: chalk.green,
        'changes-requested': chalk.yellow,
        rejected: chalk.red,
      };
      const color = decisionColors[task.review.decision] || chalk.white;
      line += color(`   ✓ ${task.review.decision}\n`);
    }
  }

  return line;
}

export function formatTaskJson(task: Task): string {
  return JSON.stringify(task, null, 2);
}

export function formatTasksJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}
